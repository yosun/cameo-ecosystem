import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../webhooks/stripe/route';
import crypto from 'crypto';

// Mock dependencies
const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transfer: {
    update: jest.fn(),
  },
};

const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
};

const mockWebhookInfrastructure = {
  processWebhookWithRetry: jest.fn(),
};

const mockRoyaltyService = {
  processRoyaltyTransfers: jest.fn(),
};

const mockWatermarkService = {
  removeWatermarks: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/stripe', () => ({
  stripe: mockStripe,
}));

jest.mock('@/lib/webhook-infrastructure', () => ({
  processWebhookWithRetry: mockWebhookInfrastructure.processWebhookWithRetry,
}));

jest.mock('@/lib/royalty-service', () => ({
  RoyaltyService: jest.fn().mockImplementation(() => mockRoyaltyService),
}));

jest.mock('@/lib/watermark-service', () => ({
  WatermarkService: jest.fn().mockImplementation(() => mockWatermarkService),
}));

describe('/api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
  });

  describe('POST /api/webhooks/stripe', () => {
    it('should process checkout.session.completed webhook', async () => {
      const webhookPayload = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            payment_intent: 'pi_test123',
            metadata: {
              order_id: 'order-1',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'test_signature';

      // Mock Stripe webhook verification
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      // Mock order lookup
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        items: [
          {
            product: {
              creator_id: 'creator-1',
              generation: {
                image_url: 'https://example.com/image.jpg',
              },
            },
          },
        ],
      };
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Mock successful processing
      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'PAID',
      });

      mockWatermarkService.removeWatermarks.mockResolvedValue(undefined);
      mockRoyaltyService.processRoyaltyTransfers.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test123'
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'PAID',
          stripe_payment_intent_id: 'pi_test123',
        },
      });
      expect(mockWatermarkService.removeWatermarks).toHaveBeenCalledWith('order-1');
      expect(mockRoyaltyService.processRoyaltyTransfers).toHaveBeenCalledWith(
        'order-1',
        'pi_test123'
      );
    });

    it('should process transfer.created webhook', async () => {
      const webhookPayload = {
        id: 'evt_test456',
        type: 'transfer.created',
        data: {
          object: {
            id: 'tr_test123',
            metadata: {
              order_id: 'order-1',
              creator_id: 'creator-1',
              type: 'royalty',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'test_signature';

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      mockPrisma.transfer.update.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.transfer.update).toHaveBeenCalledWith({
        where: { stripe_transfer_id: 'tr_test123' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should return 400 when signature verification fails', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid_signature';

      // Mock Stripe signature verification failure
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': invalidSignature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when stripe-signature header is missing', async () => {
      const payload = JSON.stringify({ test: 'data' });

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        // Missing stripe-signature header
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle order not found gracefully', async () => {
      const webhookPayload = {
        id: 'evt_test789',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test456',
            metadata: {
              order_id: 'nonexistent-order',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'test_signature';

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);
      mockPrisma.order.findUnique.mockResolvedValue(null);

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // Should still return 200 for webhook
    });

    it('should handle unsupported event types gracefully', async () => {
      const webhookPayload = {
        id: 'evt_unsupported',
        type: 'unsupported.event.type',
        data: {
          object: {},
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'test_signature';

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should handle processing errors with retry mechanism', async () => {
      const webhookPayload = {
        id: 'evt_error',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_error',
            metadata: {
              order_id: 'order-error',
            },
          },
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'test_signature';

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload);

      // Mock processing error
      mockWebhookInfrastructure.processWebhookWithRetry.mockRejectedValue(
        new Error('Processing failed')
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});