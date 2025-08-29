import { stripe, STRIPE_CONNECT_CONFIG } from './stripe';
import { prisma } from './prisma';
import { processPaymentContentAccess } from './content-moderation';
import type { Product, Creator, Store, User } from '@prisma/client';

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
  orderId: string;
}

export interface PaymentSplit {
  creatorRoyalty: number;
  storeRevenue: number;
  platformFee: number;
}

export class CheckoutService {
  /**
   * Calculate payment splits for a product
   */
  calculatePaymentSplit(product: Product & { creator: Creator }, totalAmount: number): PaymentSplit {
    // Calculate creator royalty
    const creatorRoyalty = Math.floor((totalAmount * product.creator.royalty_bps) / 10000);
    
    // Calculate platform fee
    const platformFee = Math.floor((totalAmount * STRIPE_CONNECT_CONFIG.PLATFORM_FEE_BPS) / 10000);
    
    // Store gets the remainder
    const storeRevenue = totalAmount - creatorRoyalty - platformFee;
    
    return {
      creatorRoyalty: Math.max(0, creatorRoyalty),
      storeRevenue: Math.max(0, storeRevenue),
      platformFee: Math.max(0, platformFee),
    };
  }

  /**
   * Validate licensing constraints for a product
   */
  validateLicensing(product: Product & { creator: Creator }): void {
    const creator = product.creator;
    
    // Check if third-party stores are allowed
    if (!creator.allow_third_party_stores) {
      throw new Error('This creator does not allow third-party store sales');
    }
    
    // Check minimum price
    if (product.price_cents < creator.min_price_cents) {
      throw new Error(`Product price is below creator's minimum of $${creator.min_price_cents / 100}`);
    }
    
    // Note: Discount validation would be handled during product creation/updates
  }

  /**
   * Create a checkout session for multiple products
   */
  async createCheckoutSession(
    items: CheckoutItem[],
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    try {
      // Fetch products with related data
      const products = await prisma.product.findMany({
        where: {
          id: { in: items.map(item => item.productId) },
          status: 'ACTIVE',
        },
        include: {
          creator: true,
          store: true,
          generation: true,
        },
      });

      if (products.length !== items.length) {
        throw new Error('Some products were not found or are not available');
      }

      // Validate all products and licensing
      for (const product of products) {
        this.validateLicensing(product);
        
        // Ensure creator has completed Stripe onboarding
        if (!product.creator.stripe_account_id || !product.creator.stripe_onboarding_complete) {
          throw new Error(`Creator ${product.creator.name} has not completed payment setup`);
        }
      }

      // Calculate totals and create order
      let totalAmount = 0;
      let totalPlatformFee = 0;
      const orderItems: Array<{
        product_id: string;
        quantity: number;
        price_cents: number;
      }> = [];

      for (const item of items) {
        const product = products.find(p => p.id === item.productId)!;
        const itemTotal = product.price_cents * item.quantity;
        const split = this.calculatePaymentSplit(product, itemTotal);
        
        totalAmount += itemTotal;
        totalPlatformFee += split.platformFee;
        
        orderItems.push({
          product_id: product.id,
          quantity: item.quantity,
          price_cents: product.price_cents,
        });
      }

      // Create order in database
      const order = await prisma.order.create({
        data: {
          user_id: userId,
          status: 'PENDING',
          total_cents: totalAmount,
          platform_fee_cents: totalPlatformFee,
          items: {
            create: orderItems,
          },
        },
      });

      // Create Stripe line items
      const lineItems = products.map(product => {
        const item = items.find(i => i.productId === product.id)!;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${product.product_type} - ${product.creator.name}`,
              description: `Generated content by ${product.creator.name}`,
              images: product.generation.image_url ? [product.generation.image_url] : [],
              metadata: {
                product_id: product.id,
                creator_id: product.creator_id,
                store_id: product.store_id,
              },
            },
            unit_amount: product.price_cents,
          },
          quantity: item.quantity,
        };
      });

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        
        // Configure for Connect payments
        payment_intent_data: {
          application_fee_amount: totalPlatformFee,
          transfer_group: order.id,
        },
        
        // Metadata for webhook processing
        metadata: {
          order_id: order.id,
          user_id: userId,
        },
        
        // Customer information
        customer_email: undefined, // Will be filled by Stripe
        
        // Billing and shipping
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: ['US'], // TODO: Make configurable
        },
      });

      // Update order with Stripe session ID
      await prisma.order.update({
        where: { id: order.id },
        data: { stripe_session_id: session.id },
      });

      return {
        sessionId: session.id,
        url: session.url!,
        orderId: order.id,
      };
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  /**
   * Get order details by Stripe session ID
   */
  async getOrderBySessionId(sessionId: string) {
    return prisma.order.findUnique({
      where: { stripe_session_id: sessionId },
      include: {
        items: {
          include: {
            product: {
              include: {
                creator: true,
                store: true,
                generation: true,
              },
            },
          },
        },
        user: true,
      },
    });
  }

  /**
   * Mark order as paid and process post-payment actions
   */
  async processPaymentSuccess(sessionId: string, paymentIntentId: string) {
    try {
      const order = await this.getOrderBySessionId(sessionId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === 'PAID') {
        // Already processed
        return order;
      }

      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          stripe_payment_intent_id: paymentIntentId,
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  creator: true,
                  store: true,
                  generation: true,
                },
              },
            },
          },
        },
      });

      // Remove watermarks from generated content
      try {
        const watermarkResult = await processPaymentContentAccess(order.id, order.user_id);
        if (watermarkResult.success) {
          console.log(`Watermarks removed for order ${order.id}:`, watermarkResult.cleanUrls);
        } else {
          console.error(`Failed to remove watermarks for order ${order.id}`);
        }
      } catch (error) {
        console.error('Watermark removal failed:', error);
        // Don't fail the entire payment process if watermark removal fails
      }
      
      return updatedOrder;
    } catch (error) {
      console.error('Failed to process payment success:', error);
      throw error;
    }
  }
}

export const checkoutService = new CheckoutService();