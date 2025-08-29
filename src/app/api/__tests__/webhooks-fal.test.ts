import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../webhooks/fal/route';

// Mock dependencies
const mockPrisma = {
  creator: {
    update: jest.fn(),
  },
};

const mockWebhookValidator = {
  validateFALSignature: jest.fn(),
};

const mockWebhookInfrastructure = {
  processWebhookWithRetry: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/webhook-infrastructure', () => ({
  WebhookValidator: mockWebhookValidator,
  processWebhookWithRetry: mockWebhookInfrastructure.processWebhookWithRetry,
}));

describe('/api/webhooks/fal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FAL_WEBHOOK_SECRET = 'fal_secret_123';
  });

  describe('POST /api/webhooks/fal', () => {
    it('should process successful LoRA training completion', async () => {
      const webhookPayload = {
        request_id: 'fal-job-123',
        status: 'completed',
        output: {
          lora_url: 'https://storage.googleapis.com/fal-flux-lora/test_lora.safetensors',
          trigger_word: 'testcreator_12345678',
        },
        metadata: {
          creator_id: 'creator-1',
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=valid_signature';

      // Mock signature validation
      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      // Mock successful processing
      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      // Mock creator update
      const mockUpdatedCreator = {
        id: 'creator-1',
        status: 'READY',
        lora_url: 'https://storage.googleapis.com/fal-flux-lora/test_lora.safetensors',
        trigger_word: 'testcreator_12345678',
      };
      mockPrisma.creator.update.mockResolvedValue(mockUpdatedCreator);

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': signature,
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockWebhookValidator.validateFALSignature).toHaveBeenCalledWith(
        payload,
        signature,
        'fal_secret_123'
      );
      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
        data: {
          status: 'READY',
          lora_url: 'https://storage.googleapis.com/fal-flux-lora/test_lora.safetensors',
          trigger_word: 'testcreator_12345678',
        },
      });
    });

    it('should process failed LoRA training', async () => {
      const webhookPayload = {
        request_id: 'fal-job-456',
        status: 'failed',
        error: {
          message: 'Training failed due to insufficient images',
          code: 'INSUFFICIENT_DATA',
        },
        metadata: {
          creator_id: 'creator-2',
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=valid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      const mockUpdatedCreator = {
        id: 'creator-2',
        status: 'FAILED',
        lora_url: null,
        trigger_word: null,
      };
      mockPrisma.creator.update.mockResolvedValue(mockUpdatedCreator);

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-2' },
        data: {
          status: 'FAILED',
          lora_url: null,
          trigger_word: null,
        },
      });
    });

    it('should return 400 when signature validation fails', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: false,
        error: 'Invalid signature',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': invalidSignature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when signature header is missing', async () => {
      const payload = JSON.stringify({ test: 'data' });

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        // Missing x-fal-signature header
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle missing creator_id in metadata', async () => {
      const webhookPayload = {
        request_id: 'fal-job-789',
        status: 'completed',
        output: {
          lora_url: 'https://example.com/lora.safetensors',
        },
        metadata: {
          // Missing creator_id
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=valid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // Should still return 200 but log error
    });

    it('should handle database errors gracefully', async () => {
      const webhookPayload = {
        request_id: 'fal-job-error',
        status: 'completed',
        output: {
          lora_url: 'https://example.com/lora.safetensors',
        },
        metadata: {
          creator_id: 'creator-error',
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=valid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      // Mock database error
      mockWebhookInfrastructure.processWebhookWithRetry.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON payload', async () => {
      const invalidPayload = 'invalid json';
      const signature = 'sha256=valid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: invalidPayload,
        headers: {
          'x-fal-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle training in progress status', async () => {
      const webhookPayload = {
        request_id: 'fal-job-progress',
        status: 'in_progress',
        progress: {
          percentage: 45,
          current_step: 'training',
        },
        metadata: {
          creator_id: 'creator-3',
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = 'sha256=valid_signature';

      mockWebhookValidator.validateFALSignature.mockReturnValue({
        isValid: true,
      });

      mockWebhookInfrastructure.processWebhookWithRetry.mockImplementation(
        async (source, eventType, data, processor) => {
          return await processor(data);
        }
      );

      const mockUpdatedCreator = {
        id: 'creator-3',
        status: 'TRAINING',
      };
      mockPrisma.creator.update.mockResolvedValue(mockUpdatedCreator);

      const request = new NextRequest('http://localhost:3000/api/webhooks/fal', {
        method: 'POST',
        body: payload,
        headers: {
          'x-fal-signature': signature,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-3' },
        data: {
          status: 'TRAINING',
        },
      });
    });
  });
});