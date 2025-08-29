import crypto from 'crypto';
import { prisma } from './prisma';

export interface WebhookEvent {
  id: string;
  source: 'stripe' | 'fal' | 'replicate';
  event_type: string;
  payload: any;
  signature?: string;
  processed_at?: Date;
  retry_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  error_message?: string;
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Webhook validation and security utilities
 */
export class WebhookValidator {
  /**
   * Validate Stripe webhook signature
   */
  static validateStripeSignature(
    payload: string,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    try {
      const elements = signature.split(',');
      const signatureElements: { [key: string]: string } = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureElements[key] = value;
      }

      if (!signatureElements.t || !signatureElements.v1) {
        return { isValid: false, error: 'Invalid signature format' };
      }

      const timestamp = parseInt(signatureElements.t, 10);
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if timestamp is within 5 minutes
      if (Math.abs(currentTime - timestamp) > 300) {
        return { isValid: false, error: 'Timestamp too old' };
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signatureElements.v1, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      return { isValid };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate FAL webhook signature (if they provide one)
   */
  static validateFALSignature(
    payload: string,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      return { isValid };
    } catch (error) {
      return { 
        isValid: false, 
        error: `FAL signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate Replicate webhook signature
   */
  static validateReplicateSignature(
    payload: string,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    try {
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const providedSignature = signature.replace('sha1=', '');
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      return { isValid };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Replicate signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

/**
 * Webhook retry and dead letter queue management
 */
export class WebhookRetryManager {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

  /**
   * Log webhook event for processing and retry management
   */
  static async logWebhookEvent(
    source: WebhookEvent['source'],
    eventType: string,
    payload: any,
    signature?: string
  ): Promise<string> {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        id: crypto.randomUUID(),
        source,
        event_type: eventType,
        payload,
        signature,
        retry_count: 0,
        status: 'pending',
        created_at: new Date(),
      },
    });

    return webhookEvent.id;
  }

  /**
   * Mark webhook as processing
   */
  static async markProcessing(webhookId: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status: 'processing',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark webhook as completed
   */
  static async markCompleted(webhookId: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status: 'completed',
        processed_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Mark webhook as failed and handle retry logic
   */
  static async markFailed(
    webhookId: string,
    error: string
  ): Promise<{ shouldRetry: boolean; retryAfter?: number }> {
    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: { id: webhookId },
    });

    if (!webhookEvent) {
      throw new Error(`Webhook event ${webhookId} not found`);
    }

    const newRetryCount = webhookEvent.retry_count + 1;
    const shouldRetry = newRetryCount <= this.MAX_RETRIES;
    const status = shouldRetry ? 'failed' : 'dead_letter';

    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status,
        retry_count: newRetryCount,
        error_message: error,
        updated_at: new Date(),
      },
    });

    if (shouldRetry) {
      const retryAfter = this.RETRY_DELAYS[newRetryCount - 1] || 15000;
      return { shouldRetry: true, retryAfter };
    }

    // Move to dead letter queue
    await this.moveToDeadLetterQueue(webhookId, error);
    return { shouldRetry: false };
  }

  /**
   * Move failed webhook to dead letter queue for manual review
   */
  private static async moveToDeadLetterQueue(
    webhookId: string,
    finalError: string
  ): Promise<void> {
    await prisma.deadLetterQueue.create({
      data: {
        webhook_event_id: webhookId,
        final_error: finalError,
        created_at: new Date(),
      },
    });

    console.error(`Webhook ${webhookId} moved to dead letter queue: ${finalError}`);
  }

  /**
   * Get failed webhooks ready for retry
   */
  static async getRetryableWebhooks(): Promise<WebhookEvent[]> {
    const cutoffTime = new Date(Date.now() - 60000); // 1 minute ago

    const events = await prisma.webhookEvent.findMany({
      where: {
        status: 'failed',
        retry_count: { lt: this.MAX_RETRIES },
        updated_at: { lt: cutoffTime },
      },
      orderBy: { created_at: 'asc' },
      take: 10, // Process 10 at a time
    });

    return events;
  }

  /**
   * Retry a failed webhook
   */
  static async retryWebhook(webhookId: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status: 'pending',
        updated_at: new Date(),
      },
    });
  }
}

/**
 * Webhook monitoring and metrics
 */
export class WebhookMonitor {
  /**
   * Get webhook processing statistics
   */
  static async getWebhookStats(
    source?: WebhookEvent['source'],
    timeRange?: { start: Date; end: Date }
  ) {
    const whereClause: any = {};
    
    if (source) {
      whereClause.source = source;
    }
    
    if (timeRange) {
      whereClause.created_at = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const [total, completed, failed, deadLetter, processing] = await Promise.all([
      prisma.webhookEvent.count({ where: whereClause }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, status: 'completed' } 
      }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, status: 'failed' } 
      }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, status: 'dead_letter' } 
      }),
      prisma.webhookEvent.count({ 
        where: { ...whereClause, status: 'processing' } 
      }),
    ]);

    return {
      total,
      completed,
      failed,
      deadLetter,
      processing,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  /**
   * Get recent webhook failures for monitoring
   */
  static async getRecentFailures(limit = 50) {
    return prisma.webhookEvent.findMany({
      where: {
        status: { in: ['failed', 'dead_letter'] },
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
      select: {
        id: true,
        source: true,
        event_type: true,
        retry_count: true,
        status: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  /**
   * Get dead letter queue items for manual review
   */
  static async getDeadLetterQueue() {
    return prisma.deadLetterQueue.findMany({
      include: {
        webhook_event: {
          select: {
            id: true,
            source: true,
            event_type: true,
            payload: true,
            retry_count: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}

/**
 * Webhook processing wrapper with built-in retry and monitoring
 */
export async function processWebhookWithRetry<T>(
  source: WebhookEvent['source'],
  eventType: string,
  payload: any,
  processor: () => Promise<T>,
  signature?: string
): Promise<T> {
  const webhookId = await WebhookRetryManager.logWebhookEvent(
    source,
    eventType,
    payload,
    signature
  );

  try {
    await WebhookRetryManager.markProcessing(webhookId);
    const result = await processor();
    await WebhookRetryManager.markCompleted(webhookId);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { shouldRetry, retryAfter } = await WebhookRetryManager.markFailed(
      webhookId,
      errorMessage
    );

    if (shouldRetry && retryAfter) {
      // In a production environment, you might want to use a job queue
      // For now, we'll just log the retry information
      console.log(`Webhook ${webhookId} will be retried after ${retryAfter}ms`);
    }

    throw error;
  }
}