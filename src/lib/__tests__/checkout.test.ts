import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
};

// Mock Prisma
const mockPrisma = {
  product: {
    findMany: jest.fn(),
  },
  order: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock('../stripe', () => ({
  stripe: mockStripe,
  STRIPE_CONNECT_CONFIG: {
    PLATFORM_FEE_BPS: 250,
    MIN_TRANSFER_AMOUNT: 50,
  },
}));

jest.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

import { CheckoutService } from '../checkout';

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(() => {
    service = new CheckoutService();
    jest.clearAllMocks();
  });

  describe('calculatePaymentSplit', () => {
    it('should calculate payment splits correctly', () => {
      const mockProduct = {
        id: 'product-1',
        price_cents: 1000,
        creator: {
          royalty_bps: 1000, // 10%
        },
      };

      const result = service.calculatePaymentSplit(mockProduct as any, 1000);

      expect(result).toEqual({
        creatorRoyalty: 100, // 10% of 1000
        storeRevenue: 875,   // 1000 - 100 - 25
        platformFee: 25,     // 2.5% of 1000
      });
    });

    it('should handle zero amounts', () => {
      const mockProduct = {
        id: 'product-1',
        price_cents: 1000,
        creator: {
          royalty_bps: 1000,
        },
      };

      const result = service.calculatePaymentSplit(mockProduct as any, 0);

      expect(result).toEqual({
        creatorRoyalty: 0,
        storeRevenue: 0,
        platformFee: 0,
      });
    });
  });

  describe('validateLicensing', () => {
    it('should pass validation for valid licensing', () => {
      const mockProduct = {
        id: 'product-1',
        price_cents: 1000,
        creator: {
          allow_third_party_stores: true,
          min_price_cents: 500,
        },
      };

      expect(() => service.validateLicensing(mockProduct as any)).not.toThrow();
    });

    it('should throw error when third-party stores not allowed', () => {
      const mockProduct = {
        id: 'product-1',
        price_cents: 1000,
        creator: {
          allow_third_party_stores: false,
          min_price_cents: 500,
        },
      };

      expect(() => service.validateLicensing(mockProduct as any))
        .toThrow('This creator does not allow third-party store sales');
    });

    it('should throw error when price is below minimum', () => {
      const mockProduct = {
        id: 'product-1',
        price_cents: 400,
        creator: {
          allow_third_party_stores: true,
          min_price_cents: 500,
        },
      };

      expect(() => service.validateLicensing(mockProduct as any))
        .toThrow('Product price is below creator\'s minimum of $5');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session successfully', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          price_cents: 1000,
          product_type: 'POSTCARD',
          status: 'ACTIVE',
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
            allow_third_party_stores: true,
            min_price_cents: 500,
            royalty_bps: 1000,
            stripe_account_id: 'acct_test123',
            stripe_onboarding_complete: true,
          },
          store: {
            id: 'store-1',
          },
          generation: {
            image_url: 'https://example.com/image.jpg',
          },
        },
      ];

      const mockOrder = {
        id: 'order-1',
      };

      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      };

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue(mockOrder);
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const items = [{ productId: 'product-1', quantity: 1 }];
      const result = await service.createCheckoutSession(
        items,
        'user-1',
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        orderId: 'order-1',
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          status: 'PENDING',
          total_cents: 1000,
          platform_fee_cents: 25,
          items: {
            create: [
              {
                product_id: 'product-1',
                quantity: 1,
                price_cents: 1000,
              },
            ],
          },
        },
      });
    });

    it('should throw error when products not found', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const items = [{ productId: 'product-1', quantity: 1 }];

      await expect(service.createCheckoutSession(
        items,
        'user-1',
        'https://example.com/success',
        'https://example.com/cancel'
      )).rejects.toThrow('Some products were not found or are not available');
    });
  });
});