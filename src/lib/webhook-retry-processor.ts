import { WebhookRetryManager } from './webhook-infrastructure';
import { prisma } from './prisma';

/**
 * Webhook retry processor for handling failed webhooks
 * This can be run as a cron job or background task
 */
export class WebhookRetryProcessor {
  private static isProcessing = false;

  /**
   * Process all retryable webhooks
   */
  static async processRetryableWebhooks(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (this.isProcessing) {
      console.log('Webhook retry processor already running, skipping...');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      console.log('Starting webhook retry processing...');
      
      const retryableWebhooks = await WebhookRetryManager.getRetryableWebhooks();
      console.log(`Found ${retryableWebhooks.length} webhooks to retry`);

      for (const webhook of retryableWebhooks) {
        try {
          processed++;
          console.log(`Retrying webhook ${webhook.id} (attempt ${webhook.retry_count + 1})`);

          // Mark as processing
          await WebhookRetryManager.markProcessing(webhook.id);

          // Process based on webhook source
          switch (webhook.source) {
            case 'FAL':
              await this.retryFALWebhook(webhook);
              break;
            case 'REPLICATE':
              await this.retryReplicateWebhook(webhook);
              break;
            case 'STRIPE':
              await this.retryStripeWebhook(webhook);
              break;
            default:
              throw new Error(`Unknown webhook source: ${webhook.source}`);
          }

          await WebhookRetryManager.markCompleted(webhook.id);
          succeeded++;
          console.log(`Successfully retried webhook ${webhook.id}`);

        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to retry webhook ${webhook.id}:`, errorMessage);
          
          await WebhookRetryManager.markFailed(webhook.id, errorMessage);
        }
      }

      console.log(`Webhook retry processing completed: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);
      
    } catch (error) {
      console.error('Error in webhook retry processor:', error);
    } finally {
      this.isProcessing = false;
    }

    return { processed, succeeded, failed };
  }

  /**
   * Retry FAL webhook processing
   */
  private static async retryFALWebhook(webhook: any): Promise<void> {
    const { processFALWebhook } = await import('./fal-service');
    const { updateCreatorLoRAStatus } = await import('./creator-service');

    const webhookData = processFALWebhook(webhook.payload);
    
    if (!webhookData.jobId) {
      throw new Error('Missing job ID in webhook payload');
    }

    const creator = await prisma.creator.findFirst({
      where: { fal_job_id: webhookData.jobId },
    });

    if (!creator) {
      throw new Error(`Creator not found for FAL job ID: ${webhookData.jobId}`);
    }

    if (webhookData.status === 'COMPLETED') {
      if (!webhookData.loraUrl) {
        await updateCreatorLoRAStatus(creator.id, 'FAILED');
        throw new Error('Completed webhook missing LoRA URL');
      }

      await updateCreatorLoRAStatus(
        creator.id,
        'READY',
        webhookData.loraUrl,
        webhookData.triggerWord
      );
    } else if (webhookData.status === 'FAILED') {
      await updateCreatorLoRAStatus(creator.id, 'FAILED');
    }
  }

  /**
   * Retry Replicate webhook processing
   */
  private static async retryReplicateWebhook(webhook: any): Promise<void> {
    const { uploadToS3 } = await import('./s3');
    const { applyWatermark } = await import('./watermark-service');

    const { id, status, output, error } = webhook.payload;

    if (!id) {
      throw new Error('Missing prediction ID');
    }

    const generation = await prisma.generation.findFirst({
      where: {
        replicate_prediction_id: id,
        status: 'PROCESSING',
      },
    });

    if (!generation) {
      // Not an error - might be a duplicate webhook or already processed
      return;
    }

    if (status === 'succeeded' && output && output.length > 0) {
      const imageUrl = output[0];
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error('Failed to download generated image');
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const key = `generations/${generation.id}-${Date.now()}.jpg`;
      
      const s3Url = await uploadToS3(imageBuffer, key, 'image/jpeg');
      const watermarkedUrl = await applyWatermark(s3Url, generation.id);

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          image_url: watermarkedUrl,
        },
      });
    } else if (status === 'failed') {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: 'FAILED' },
      });
    }
  }

  /**
   * Retry Stripe webhook processing
   */
  private static async retryStripeWebhook(webhook: any): Promise<void> {
    const { checkoutService } = await import('./checkout');
    const { royaltyService } = await import('./royalty-service');

    const eventType = webhook.event_type;
    const eventData = webhook.payload;

    switch (eventType) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(eventData);
        break;
      case 'transfer.created':
        await royaltyService.handleTransferUpdate(eventData.id, 'created');
        break;
      case 'transfer.paid':
        await royaltyService.handleTransferUpdate(eventData.id, 'paid');
        break;
      case 'transfer.failed':
        await royaltyService.handleTransferUpdate(eventData.id, 'failed');
        break;
      case 'account.updated':
        await this.handleAccountUpdated(eventData);
        break;
      default:
        console.log(`Unhandled Stripe event type in retry: ${eventType}`);
    }
  }

  private static async handleCheckoutSessionCompleted(session: any): Promise<void> {
    const { checkoutService } = await import('./checkout');
    const { royaltyService } = await import('./royalty-service');

    if (!session.payment_intent) {
      throw new Error('No payment intent in checkout session');
    }

    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent.id;

    const order = await checkoutService.processPaymentSuccess(session.id, paymentIntentId);
    
    if (order) {
      await royaltyService.processOrderRoyalties(order.id);
    }
  }

  private static async handleAccountUpdated(account: any): Promise<void> {
    const isOnboardingComplete = account.charges_enabled && 
                                account.payouts_enabled && 
                                account.details_submitted;

    // Update creator account
    const creator = await prisma.creator.findUnique({
      where: { stripe_account_id: account.id },
    });

    if (creator) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { stripe_onboarding_complete: isOnboardingComplete },
      });
    }

    // Update store account if applicable
    const store = await prisma.store.findUnique({
      where: { stripe_account_id: account.id },
    });

    if (store) {
      // Store onboarding status could be tracked similarly if needed
      console.log(`Store ${store.id} account updated`);
    }
  }
}

/**
 * API endpoint for manual webhook retry processing
 */
export async function processWebhookRetries() {
  return WebhookRetryProcessor.processRetryableWebhooks();
}