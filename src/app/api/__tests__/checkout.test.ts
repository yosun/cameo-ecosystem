import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../checkout/route';

// Mock dependencies
const mockPrisma = {
  product: {
    findMany: jest.fn(),
  },
  order: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
};

const mockCheckoutService = {
  createCheckoutSession: jest.fn(),
  validateLicensing: jest.fn(),
  calculatePaymentSplit: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/stripe', () => ({
  stripe: mockStripe,
}));

jest.mock('@/lib/checkout', () => ({
  CheckoutService: jest.fn().mockImplementation(() => mockCheckoutService),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const { getServerSession } = require('next-auth');

describe('/api/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/checkout', () => {
    it('should create checkout session successfully', async () => {
      // Mock authenticated session
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      // Mock checkout service response
      const mockCheckoutResponse = {
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        orderId: 'order-1',
      };
      mockCheckoutService.createCheckoutSession.mockResolvedValue(mockCheckoutResponse);

      const requestBody = {
        items: [
          { productId: 'product-1', quantity: 1 },
          { productId: 'product-2', quantity: 2 },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockCheckoutResponse);
      expect(mockCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
        requestBody.items,
        'user-1',
        requestBody.success_url,
        requestBody.cancel_url
      );
    });

    it('should return 401 when not authenticated', async () => {
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when items array is empty', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const requestBody = {
        items: [], // Empty items
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when required URLs are missing', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const requestBody = {
        items: [{ productId: 'product-1', quantity: 1 }],
        // Missing success_url and cancel_url
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle licensing validation errors', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      // Mock licensing validation failure
      mockCheckoutService.createCheckoutSession.mockRejectedValue(
        new Error('This creator does not allow third-party store sales')
      );

      const requestBody = {
        items: [{ productId: 'product-1', quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle Stripe errors gracefully', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      // Mock Stripe error
      mockCheckoutService.createCheckoutSession.mockRejectedValue(
        new Error('Stripe API error')
      );

      const requestBody = {
        items: [{ productId: 'product-1', quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should validate item quantities', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const requestBody = {
        items: [
          { productId: 'product-1', quantity: 0 }, // Invalid quantity
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate product IDs format', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const requestBody = {
        items: [
          { productId: '', quantity: 1 }, // Empty product ID
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      };

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});