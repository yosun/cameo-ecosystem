import { stripe, STRIPE_CONNECT_CONFIG } from './stripe';
import { prisma } from './prisma';
import type { Order, OrderItem, Product, Creator, Store } from '@prisma/client';

export interface RoyaltyCalculation {
  creatorRoyalty: number;
  storeRevenue: number;
  platformFee: number;
}

export interface TransferResult {
  transferId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class RoyaltyService {
  /**
   * Calculate royalty distribution for an order item
   */
  calculateRoyalties(
    product: Product & { creator: Creator },
    itemTotal: number
  ): RoyaltyCalculation {
    // Calculate creator royalty based on their configured rate
    const creatorRoyalty = Math.floor((itemTotal * product.creator.royalty_bps) / 10000);
    
    // Calculate platform fee
    const platformFee = Math.floor((itemTotal * STRIPE_CONNECT_CONFIG.PLATFORM_FEE_BPS) / 10000);
    
    // Store gets the remainder after creator royalty and platform fee
    const storeRevenue = itemTotal - creatorRoyalty - platformFee;
    
    return {
      creatorRoyalty: Math.max(0, creatorRoyalty),
      storeRevenue: Math.max(0, storeRevenue),
      platformFee: Math.max(0, platformFee),
    };
  }

  /**
   * Process royalty transfers for a completed order
   */
  async processOrderRoyalties(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  creator: true,
                  store: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'PAID') {
        throw new Error('Order is not paid');
      }

      // Check if transfers have already been processed
      const existingTransfers = await prisma.transfer.findMany({
        where: { order_id: orderId },
      });

      if (existingTransfers.length > 0) {
        console.log(`Transfers already processed for order ${orderId}`);
        return;
      }

      // Process transfers for each item
      for (const item of order.items) {
        await this.processItemRoyalties(order, item);
      }

      console.log(`Successfully processed royalties for order ${orderId}`);
    } catch (error) {
      console.error(`Failed to process royalties for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Process royalties for a single order item
   */
  private async processItemRoyalties(
    order: Order,
    item: OrderItem & {
      product: Product & {
        creator: Creator;
        store: Store;
      };
    }
  ): Promise<void> {
    const itemTotal = item.price_cents * item.quantity;
    const royalties = this.calculateRoyalties(item.product, itemTotal);

    // Create royalty record
    await prisma.royalty.create({
      data: {
        order_id: order.id,
        creator_id: item.product.creator_id,
        amount_cents: royalties.creatorRoyalty,
        status: 'PENDING',
      },
    });

    // Transfer to creator if they have a Stripe account and amount is above minimum
    if (
      item.product.creator.stripe_account_id &&
      item.product.creator.stripe_onboarding_complete &&
      royalties.creatorRoyalty >= STRIPE_CONNECT_CONFIG.MIN_TRANSFER_AMOUNT
    ) {
      await this.createCreatorTransfer(order, item.product.creator, royalties.creatorRoyalty);
    }

    // Transfer to store owner if they have a Stripe account and amount is above minimum
    if (
      item.product.store.stripe_account_id &&
      royalties.storeRevenue >= STRIPE_CONNECT_CONFIG.MIN_TRANSFER_AMOUNT
    ) {
      await this.createStoreTransfer(order, item.product.store, royalties.storeRevenue);
    }
  }

  /**
   * Create a transfer to a creator
   */
  private async createCreatorTransfer(
    order: Order,
    creator: Creator,
    amount: number
  ): Promise<TransferResult> {
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: creator.stripe_account_id!,
        transfer_group: order.id,
        metadata: {
          order_id: order.id,
          creator_id: creator.id,
          type: 'creator_royalty',
        },
      });

      // Record transfer in database
      await prisma.transfer.create({
        data: {
          order_id: order.id,
          stripe_transfer_id: transfer.id,
          recipient_type: 'CREATOR',
          creator_id: creator.id,
          amount_cents: amount,
          status: 'PROCESSING',
        },
      });

      // Update royalty status
      await prisma.royalty.updateMany({
        where: {
          order_id: order.id,
          creator_id: creator.id,
        },
        data: {
          status: 'PAID',
        },
      });

      return {
        transferId: transfer.id,
        amount,
        status: 'processing',
      };
    } catch (error) {
      console.error(`Failed to create creator transfer for ${creator.id}:`, error);
      
      // Update royalty status to failed
      await prisma.royalty.updateMany({
        where: {
          order_id: order.id,
          creator_id: creator.id,
        },
        data: {
          status: 'FAILED',
        },
      });

      throw error;
    }
  }

  /**
   * Create a transfer to a store owner
   */
  private async createStoreTransfer(
    order: Order,
    store: Store,
    amount: number
  ): Promise<TransferResult> {
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: store.stripe_account_id!,
        transfer_group: order.id,
        metadata: {
          order_id: order.id,
          store_id: store.id,
          type: 'store_revenue',
        },
      });

      // Record transfer in database
      await prisma.transfer.create({
        data: {
          order_id: order.id,
          stripe_transfer_id: transfer.id,
          recipient_type: 'STORE_OWNER',
          store_id: store.id,
          amount_cents: amount,
          status: 'PROCESSING',
        },
      });

      return {
        transferId: transfer.id,
        amount,
        status: 'processing',
      };
    } catch (error) {
      console.error(`Failed to create store transfer for ${store.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle transfer status updates from Stripe webhooks
   */
  async handleTransferUpdate(transferId: string, status: string): Promise<void> {
    try {
      const transfer = await prisma.transfer.findUnique({
        where: { stripe_transfer_id: transferId },
      });

      if (!transfer) {
        console.log(`Transfer ${transferId} not found in database`);
        return;
      }

      let newStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      
      switch (status) {
        case 'paid':
          newStatus = 'COMPLETED';
          break;
        case 'failed':
          newStatus = 'FAILED';
          break;
        case 'in_transit':
          newStatus = 'PROCESSING';
          break;
        default:
          newStatus = 'PROCESSING';
      }

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: newStatus },
      });

      console.log(`Updated transfer ${transferId} status to ${newStatus}`);
    } catch (error) {
      console.error(`Failed to update transfer ${transferId}:`, error);
      throw error;
    }
  }

  /**
   * Get royalty summary for a creator
   */
  async getCreatorRoyaltySummary(creatorId: string, startDate?: Date, endDate?: Date) {
    const whereClause: any = {
      creator_id: creatorId,
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [royalties, transfers] = await Promise.all([
      prisma.royalty.findMany({
        where: whereClause,
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      }),
      prisma.transfer.findMany({
        where: {
          creator_id: creatorId,
          ...whereClause,
        },
      }),
    ]);

    const totalEarned = royalties.reduce((sum, royalty) => sum + royalty.amount_cents, 0);
    const totalPaid = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, transfer) => sum + transfer.amount_cents, 0);
    const totalPending = transfers
      .filter(t => t.status === 'PROCESSING' || t.status === 'PENDING')
      .reduce((sum, transfer) => sum + transfer.amount_cents, 0);

    return {
      totalEarned,
      totalPaid,
      totalPending,
      royalties,
      transfers,
    };
  }

  /**
   * Get store revenue summary
   */
  async getStoreRevenueSummary(storeId: string, startDate?: Date, endDate?: Date) {
    const whereClause: any = {
      store_id: storeId,
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const transfers = await prisma.transfer.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    creator: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const totalRevenue = transfers.reduce((sum, transfer) => sum + transfer.amount_cents, 0);
    const totalPaid = transfers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, transfer) => sum + transfer.amount_cents, 0);
    const totalPending = transfers
      .filter(t => t.status === 'PROCESSING' || t.status === 'PENDING')
      .reduce((sum, transfer) => sum + transfer.amount_cents, 0);

    return {
      totalRevenue,
      totalPaid,
      totalPending,
      transfers,
    };
  }
}

export const royaltyService = new RoyaltyService();