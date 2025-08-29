import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { checkoutService } from '@/lib/checkout';
import { royaltyService } from '@/lib/royalty-service';
import { 
  WebhookValidator, 
  processWebhookWithRetry 
} from '@/lib/webhook-infrastructure';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe signature or webhook secret');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Validate Stripe webhook signature
    const validation = WebhookValidator.validateStripeSignature(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    if (!validation.isValid) {
      console.error('Stripe webhook signature validation failed:', validation.error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Processing Stripe webhook: ${event.type}`);

    // Process webhook with retry infrastructure
    await processWebhookWithRetry(
      'STRIPE',
      event.type,
      event.data.object,
      async () => {
        switch (event.type) {
          case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
            break;

          case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
            break;

          case 'transfer.created':
            await handleTransferCreated(event.data.object as Stripe.Transfer);
            break;

          case 'transfer.paid':
            await handleTransferPaid(event.data.object as Stripe.Transfer);
            break;

          case 'transfer.failed':
            await handleTransferFailed(event.data.object as Stripe.Transfer);
            break;

          case 'account.updated':
            await handleAccountUpdated(event.data.object as Stripe.Account);
            break;

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }
      },
      signature
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log(`Processing checkout session completed: ${session.id}`);

    if (!session.payment_intent) {
      console.error('No payment intent in checkout session');
      return;
    }

    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent.id;

    // Process payment success
    const order = await checkoutService.processPaymentSuccess(session.id, paymentIntentId);
    
    if (order) {
      console.log(`Order ${order.id} marked as paid, processing royalties...`);
      
      // Process royalty transfers
      await royaltyService.processOrderRoyalties(order.id);
      
      console.log(`Royalties processed for order ${order.id}`);
    }
  } catch (error) {
    console.error('Failed to handle checkout session completed:', error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log(`Payment intent succeeded: ${paymentIntent.id}`);
    
    // Additional payment processing if needed
    // The main processing is handled in checkout.session.completed
  } catch (error) {
    console.error('Failed to handle payment intent succeeded:', error);
    throw error;
  }
}

/**
 * Handle transfer creation
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  try {
    console.log(`Transfer created: ${transfer.id}`);
    await royaltyService.handleTransferUpdate(transfer.id, 'created');
  } catch (error) {
    console.error('Failed to handle transfer created:', error);
    throw error;
  }
}

/**
 * Handle successful transfer
 */
async function handleTransferPaid(transfer: Stripe.Transfer) {
  try {
    console.log(`Transfer paid: ${transfer.id}`);
    await royaltyService.handleTransferUpdate(transfer.id, 'paid');
  } catch (error) {
    console.error('Failed to handle transfer paid:', error);
    throw error;
  }
}

/**
 * Handle failed transfer
 */
async function handleTransferFailed(transfer: Stripe.Transfer) {
  try {
    console.log(`Transfer failed: ${transfer.id}`);
    await royaltyService.handleTransferUpdate(transfer.id, 'failed');
  } catch (error) {
    console.error('Failed to handle transfer failed:', error);
    throw error;
  }
}

/**
 * Handle Connect account updates
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    console.log(`Account updated: ${account.id}`);
    
    // Update creator or store onboarding status based on account changes
    const isOnboardingComplete = account.charges_enabled && 
                                account.payouts_enabled && 
                                account.details_submitted;

    // Check if this is a creator account
    const creator = await prisma.creator.findUnique({
      where: { stripe_account_id: account.id },
    });

    if (creator) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { stripe_onboarding_complete: isOnboardingComplete },
      });
      console.log(`Updated creator ${creator.id} onboarding status: ${isOnboardingComplete}`);
    }

    // Check if this is a store account
    const store = await prisma.store.findUnique({
      where: { stripe_account_id: account.id },
    });

    if (store) {
      // Store onboarding status could be tracked similarly if needed
      console.log(`Store ${store.id} account updated`);
    }
  } catch (error) {
    console.error('Failed to handle account updated:', error);
    throw error;
  }
}

// Import prisma here to avoid circular dependencies
import { prisma } from '@/lib/prisma';