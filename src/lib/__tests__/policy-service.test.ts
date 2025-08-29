import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PolicyService } from '../policy-service';

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    creator: {
      findUnique: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require('../prisma');

describe('PolicyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProductPolicy', () => {
    it('should allow product from same user', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: false,
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: 2000,
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-1', // Same user
        product_type: 'POSTCARD',
        price_cents: 1000,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject third-party store when not allowed', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: false,
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: 2000,
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-2', // Different user
        product_type: 'POSTCARD',
        price_cents: 1000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Creator does not allow third-party store listings');
    });

    it('should reject price below minimum', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: true,
        royalty_bps: 1000,
        min_price_cents: 1000,
        max_discount_bps: 2000,
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-2',
        product_type: 'POSTCARD',
        price_cents: 500, // Below minimum
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price $5 is below creator\'s minimum of $10');
    });

    it('should reject discount above maximum', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: true,
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: 1000, // 10%
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-2',
        product_type: 'POSTCARD',
        price_cents: 1000,
        discount_bps: 2000, // 20% - above maximum
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Discount 20% exceeds creator\'s maximum of 10%');
    });

    it('should reject effective price below minimum after discount', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: true,
        royalty_bps: 1000,
        min_price_cents: 800,
        max_discount_bps: 2000, // 20%
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-2',
        product_type: 'POSTCARD',
        price_cents: 1000,
        discount_bps: 2000, // 20% discount = $8 final price, below $8 minimum
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price after discount ($8) is below creator\'s minimum of $8');
    });

    it('should add warnings for high royalty rates', async () => {
      const mockCreator = {
        id: 'creator-1',
        allow_third_party_stores: true,
        royalty_bps: 3000, // 30% - high
        min_price_cents: 500,
        max_discount_bps: 2000,
      };

      prisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await PolicyService.validateProductPolicy({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-2',
        product_type: 'POSTCARD',
        price_cents: 1000,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High royalty rate (30%) may reduce store owner profit margins');
    });
  });

  describe('calculateRevenueSplit', () => {
    it('should calculate correct revenue split', async () => {
      const mockProduct = {
        id: 'product-1',
        creator: {
          id: 'creator-1',
          name: 'Test Creator',
          royalty_bps: 1500, // 15%
        },
        store: {
          id: 'store-1',
          name: 'Test Store',
        },
      };

      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await PolicyService.calculateRevenueSplit('product-1', 2000); // $20

      expect(result).toEqual({
        salePrice: 2000,
        platformFee: 200, // 10%
        creatorRoyalty: 300, // 15%
        storeRevenue: 1500, // Remaining
        splits: {
          platform: {
            amount: 200,
            percentage: 10,
          },
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
            amount: 300,
            percentage: 15,
          },
          store: {
            id: 'store-1',
            name: 'Test Store',
            amount: 1500,
            percentage: 75,
          },
        },
      });
    });
  });

  describe('validateCreatorLicensing', () => {
    it('should validate correct licensing configuration', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 1000, // 10%
        min_price_cents: 500, // $5
        max_discount_bps: 2000, // 20%
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject royalty rate below minimum', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 50, // 0.5% - below 1% minimum
        min_price_cents: 500,
        max_discount_bps: 2000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Royalty rate must be at least 1%');
    });

    it('should reject royalty rate above maximum', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 6000, // 60% - above 50% maximum
        min_price_cents: 500,
        max_discount_bps: 2000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Royalty rate cannot exceed 50%');
    });

    it('should reject minimum price below threshold', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 1000,
        min_price_cents: 50, // $0.50 - below $1 minimum
        max_discount_bps: 2000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum price must be at least $1.00');
    });

    it('should reject minimum price above threshold', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 1000,
        min_price_cents: 60000, // $600 - above $500 maximum
        max_discount_bps: 2000,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum price cannot exceed $500.00');
    });

    it('should reject negative discount', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: -100, // Negative discount
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum discount cannot be negative');
    });

    it('should reject discount above maximum', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: 8000, // 80% - above 75% maximum
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum discount cannot exceed 75%');
    });

    it('should add warnings for high values', () => {
      const result = PolicyService.validateCreatorLicensing({
        royalty_bps: 3500, // 35% - high
        min_price_cents: 6000, // $60 - high
        max_discount_bps: 6000, // 60% - high
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High royalty rates may discourage store owners from listing your products');
      expect(result.warnings).toContain('High minimum prices may limit product accessibility');
      expect(result.warnings).toContain('High maximum discounts may devalue your brand');
    });
  });
});