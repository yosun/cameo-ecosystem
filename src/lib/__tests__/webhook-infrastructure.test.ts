import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';

// Mock Prisma before importing the module
const mockPrisma = {
  webhookEvent: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  deadLetterQueue: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

// Mock the entire prisma module
jest.mock('../prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

// Now import the module after mocking
import { 
  WebhookValidator, 
  WebhookRetryManager, 
  WebhookMonitor,
  processWebhookWithRetry 
} from '../webhook-infrastructure';

describe('WebhookValidator', () => {
  describe('validateStripeSignature', () => {
    it('should validate correct Stripe signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      
      const stripeSignature = `t=${timestamp},v1=${signature}`;
      
      const result = WebhookValidator.validateStripeSignature(
        payload,
        stripeSignature,
        secret
      );
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid Stripe signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = `t=${timestamp},v1=invalid_signature`;
      
      const result = WebhookValidator.validateStripeSignature(
        payload,
        invalidSignature,
        secret
      );
      
      expect(result.isValid).toBe(false);
      // The error might be present due to signature validation failure
    });

    it('should reject old timestamp', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      
      const signedPayload = `${oldTimestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      
      const stripeSignature = `t=${oldTimestamp},v1=${signature}`;
      
      const result = WebhookValidator.validateStripeSignature(
        payload,
        stripeSignature,
        secret
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Timestamp too old');
    });

    it('should handle malformed signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const malformedSignature = 'invalid_format';
      
      const result = WebhookValidator.validateStripeSignature(
        payload,
        malformedSignature,
        secret
      );
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature format');
    });
  });

  describe('validateFALSignature', () => {
    it('should validate correct FAL signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      const falSignature = `sha256=${expectedSignature}`;
      
      const result = WebhookValidator.validateFALSignature(
        payload,
        falSignature,
        secret
      );
      
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid FAL signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const invalidSignature = 'sha256=invalid_signature';
      
      const result = WebhookValidator.validateFALSignature(
        payload,
        invalidSignature,
        secret
      );
      
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateReplicateSignature', () => {
    it('should validate correct Replicate signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      const replicateSignature = `sha1=${expectedSignature}`;
      
      const result = WebhookValidator.validateReplicateSignature(
        payload,
        replicateSignature,
        secret
      );
      
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid Replicate signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_secret';
      const invalidSignature = 'sha1=invalid_signature';
      
      const result = WebhookValidator.validateReplicateSignature(
        payload,
        invalidSignature,
        secret
      );
      
      expect(result.isValid).toBe(false);
    });
  });
});

describe('WebhookRetryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logWebhookEvent', () => {
    it('should create webhook event record', async () => {
      const mockWebhookEvent = {
        id: 'test-webhook-id',
        source: 'STRIPE',
        event_type: 'checkout.session.completed',
        payload: { test: 'data' },
        signature: 'test-signature',
        retry_count: 0,
        status: 'pending',
        created_at: new Date(),
      };

      mockPrisma.webhookEvent.create.mockResolvedValue(mockWebhookEvent);

      const webhookId = await WebhookRetryManager.logWebhookEvent(
        'STRIPE',
        'checkout.session.completed',
        { test: 'data' },
        'test-signature'
      );

      expect(webhookId).toBe('test-webhook-id');
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'STRIPE',
          event_type: 'checkout.session.completed',
          payload: { test: 'data' },
          signature: 'test-signature',
          retry_count: 0,
          status: 'pending',
        }),
      });
    });
  });

  describe('markFailed', () => {
    it('should mark webhook as failed and allow retry', async () => {
      const mockWebhookEvent = {
        id: 'test-webhook-id',
        retry_count: 0,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(mockWebhookEvent);
      mockPrisma.webhookEvent.update.mockResolvedValue({});

      const result = await WebhookRetryManager.markFailed(
        'test-webhook-id',
        'Test error'
      );

      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfter).toBe(1000); // First retry delay
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'test-webhook-id' },
        data: expect.objectContaining({
          status: 'failed',
          retry_count: 1,
          error_message: 'Test error',
        }),
      });
    });

    it('should move to dead letter queue after max retries', async () => {
      const mockWebhookEvent = {
        id: 'test-webhook-id',
        retry_count: 3, // Already at max retries
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(mockWebhookEvent);
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockPrisma.deadLetterQueue.create.mockResolvedValue({});

      const result = await WebhookRetryManager.markFailed(
        'test-webhook-id',
        'Final error'
      );

      expect(result.shouldRetry).toBe(false);
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'test-webhook-id' },
        data: expect.objectContaining({
          status: 'dead_letter',
          retry_count: 4,
        }),
      });
      expect(mockPrisma.deadLetterQueue.create).toHaveBeenCalled();
    });
  });

  describe('getRetryableWebhooks', () => {
    it('should return failed webhooks ready for retry', async () => {
      const mockWebhooks = [
        {
          id: 'webhook-1',
          source: 'STRIPE',
          status: 'failed',
          retry_count: 1,
        },
        {
          id: 'webhook-2',
          source: 'FAL',
          status: 'failed',
          retry_count: 2,
        },
      ];

      mockPrisma.webhookEvent.findMany.mockResolvedValue(mockWebhooks);

      const result = await WebhookRetryManager.getRetryableWebhooks();

      expect(result).toEqual(mockWebhooks);
      expect(mockPrisma.webhookEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'failed',
          retry_count: { lt: 3 },
          updated_at: { lt: expect.any(Date) },
        },
        orderBy: { created_at: 'asc' },
        take: 10,
      });
    });
  });
});

describe('WebhookMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebhookStats', () => {
    it('should return webhook statistics', async () => {
      mockPrisma.webhookEvent.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // completed
        .mockResolvedValueOnce(10)  // failed
        .mockResolvedValueOnce(3)   // dead_letter
        .mockResolvedValueOnce(2);  // processing

      const stats = await WebhookMonitor.getWebhookStats();

      expect(stats).toEqual({
        total: 100,
        completed: 85,
        failed: 10,
        deadLetter: 3,
        processing: 2,
        successRate: 85,
      });
    });

    it('should filter by source', async () => {
      mockPrisma.webhookEvent.count.mockResolvedValue(50);

      await WebhookMonitor.getWebhookStats('STRIPE');

      expect(mockPrisma.webhookEvent.count).toHaveBeenCalledWith({
        where: { source: 'STRIPE' },
      });
    });

    it('should filter by time range', async () => {
      const timeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-31'),
      };

      mockPrisma.webhookEvent.count.mockResolvedValue(25);

      await WebhookMonitor.getWebhookStats(undefined, timeRange);

      expect(mockPrisma.webhookEvent.count).toHaveBeenCalledWith({
        where: {
          created_at: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });
    });
  });

  describe('getRecentFailures', () => {
    it('should return recent webhook failures', async () => {
      const mockFailures = [
        {
          id: 'failure-1',
          source: 'STRIPE',
          event_type: 'checkout.session.completed',
          status: 'failed',
          error_message: 'Connection timeout',
        },
      ];

      mockPrisma.webhookEvent.findMany.mockResolvedValue(mockFailures);

      const result = await WebhookMonitor.getRecentFailures(10);

      expect(result).toEqual(mockFailures);
      expect(mockPrisma.webhookEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['failed', 'dead_letter'] },
        },
        orderBy: { updated_at: 'desc' },
        take: 10,
        select: expect.any(Object),
      });
    });
  });
});

describe('processWebhookWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process webhook successfully', async () => {
    const mockProcessor = jest.fn().mockResolvedValue('success');
    
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'webhook-id' });
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    const result = await processWebhookWithRetry(
      'STRIPE',
      'test.event',
      { test: 'data' },
      mockProcessor
    );

    expect(result).toBe('success');
    expect(mockProcessor).toHaveBeenCalled();
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalled();
    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'webhook-id' },
      data: expect.objectContaining({
        status: 'completed',
        processed_at: expect.any(Date),
      }),
    });
  });

  it('should handle processor failure', async () => {
    const mockProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));
    
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'webhook-id' });
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({ id: 'webhook-id', retry_count: 0 });
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await expect(
      processWebhookWithRetry(
        'STRIPE',
        'test.event',
        { test: 'data' },
        mockProcessor
      )
    ).rejects.toThrow('Processing failed');

    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'webhook-id' },
      data: expect.objectContaining({
        status: 'failed',
        retry_count: 1,
        error_message: 'Processing failed',
      }),
    });
  });
});