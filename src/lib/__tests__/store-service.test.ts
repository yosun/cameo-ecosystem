import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StoreService } from '../store-service';
import { PolicyService } from '../policy-service';

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    store: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    generation: {
      findUnique: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock PolicyService
jest.mock('../policy-service', () => ({
  PolicyService: {
    validateProductPolicy: jest.fn(),
  },
}));

const { prisma } = require('../prisma');

describe('StoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStore', () => {
    it('should create a store with basic information', async () => {
      const mockStore = {
        id: 'store-1',
        name: 'Test Store',
        description: 'A test store',
        owner_id: 'user-1',
        owner: { id: 'user-1', name: 'Test User' },
        _count: { products: 0 },
      };

      prisma.store.create.mockResolvedValue(mockStore);

      const result = await StoreService.createStore('user-1', {
        name: 'Test Store',
        description: 'A test store',
      });

      expect(prisma.store.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Store',
          description: 'A test store',
          owner_id: 'user-1',
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      expect(result).toEqual(mockStore);
    });

    it('should create a store with branding options', async () => {
      const mockStore = {
        id: 'store-1',
        name: 'Branded Store',
        logo_url: 'https://example.com/logo.png',
        theme_color: '#FF0000',
        custom_domain: 'my-store',
        owner_id: 'user-1',
        owner: { id: 'user-1', name: 'Test User' },
        _count: { products: 0 },
      };

      prisma.store.create.mockResolvedValue(mockStore);

      const result = await StoreService.createStore('user-1', {
        name: 'Branded Store',
        logo_url: 'https://example.com/logo.png',
        theme_color: '#FF0000',
        custom_domain: 'my-store',
      });

      expect(prisma.store.create).toHaveBeenCalledWith({
        data: {
          name: 'Branded Store',
          logo_url: 'https://example.com/logo.png',
          theme_color: '#FF0000',
          custom_domain: 'my-store',
          owner_id: 'user-1',
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      expect(result).toEqual(mockStore);
    });

    it('should throw error for duplicate custom domain', async () => {
      prisma.store.findUnique.mockResolvedValue({ id: 'existing-store' });

      await expect(
        StoreService.createStore('user-1', {
          name: 'Test Store',
          custom_domain: 'taken-domain',
        })
      ).rejects.toThrow('Custom domain is already taken');
    });
  });

  describe('addProductToStore', () => {
    it('should add product with valid licensing', async () => {
      const mockStore = { id: 'store-1', owner_id: 'user-1' };
      const mockGeneration = {
        id: 'gen-1',
        user_id: 'user-1',
        user: { id: 'user-1' },
      };
      const mockProduct = {
        id: 'product-1',
        store_id: 'store-1',
        generation_id: 'gen-1',
        creator_id: 'creator-1',
        product_type: 'POSTCARD',
        price_cents: 1000,
      };

      prisma.store.findUnique.mockResolvedValue(mockStore);
      prisma.generation.findUnique.mockResolvedValue(mockGeneration);
      prisma.product.create.mockResolvedValue(mockProduct);

      // Mock PolicyService validation
      (PolicyService.validateProductPolicy as jest.Mock).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      const result = await StoreService.addProductToStore('store-1', 'user-1', {
        generation_id: 'gen-1',
        creator_id: 'creator-1',
        product_type: 'POSTCARD',
        price_cents: 1000,
      });

      expect(PolicyService.validateProductPolicy).toHaveBeenCalledWith({
        creator_id: 'creator-1',
        store_owner_id: 'user-1',
        generation_user_id: 'user-1',
        product_type: 'POSTCARD',
        price_cents: 1000,
      });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          store_id: 'store-1',
          generation_id: 'gen-1',
          creator_id: 'creator-1',
          product_type: 'POSTCARD',
          price_cents: 1000,
        },
      });

      expect(result).toEqual(mockProduct);
    });

    it('should reject product with policy violations', async () => {
      const mockStore = { id: 'store-1', owner_id: 'user-1' };
      const mockGeneration = {
        id: 'gen-1',
        user_id: 'user-2',
        user: { id: 'user-2' },
      };

      prisma.store.findUnique.mockResolvedValue(mockStore);
      prisma.generation.findUnique.mockResolvedValue(mockGeneration);

      // Mock PolicyService validation failure
      (PolicyService.validateProductPolicy as jest.Mock).mockResolvedValue({
        isValid: false,
        errors: ['Creator does not allow third-party store listings'],
        warnings: [],
      });

      await expect(
        StoreService.addProductToStore('store-1', 'user-1', {
          generation_id: 'gen-1',
          creator_id: 'creator-1',
          product_type: 'POSTCARD',
          price_cents: 1000,
        })
      ).rejects.toThrow('Policy violation: Creator does not allow third-party store listings');
    });

    it('should reject unauthorized store access', async () => {
      const mockStore = { id: 'store-1', owner_id: 'user-2' };

      prisma.store.findUnique.mockResolvedValue(mockStore);

      await expect(
        StoreService.addProductToStore('store-1', 'user-1', {
          generation_id: 'gen-1',
          creator_id: 'creator-1',
          product_type: 'POSTCARD',
          price_cents: 1000,
        })
      ).rejects.toThrow('Not authorized to add products to this store');
    });
  });

  describe('getPublicStores', () => {
    it('should return public stores with pagination', async () => {
      const mockStores = [
        {
          id: 'store-1',
          name: 'Public Store 1',
          is_public: true,
          owner: { id: 'user-1', name: 'User 1' },
          _count: { products: 5 },
        },
      ];

      prisma.store.findMany.mockResolvedValue(mockStores);
      prisma.store.count.mockResolvedValue(1);

      const result = await StoreService.getPublicStores({
        page: 1,
        limit: 20,
      });

      expect(prisma.store.findMany).toHaveBeenCalledWith({
        where: { is_public: true },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        skip: 0,
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual({
        stores: mockStores,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      });
    });

    it('should filter stores by search term', async () => {
      const mockStores = [];

      prisma.store.findMany.mockResolvedValue(mockStores);
      prisma.store.count.mockResolvedValue(0);

      await StoreService.getPublicStores({
        search: 'test store',
      });

      expect(prisma.store.findMany).toHaveBeenCalledWith({
        where: {
          is_public: true,
          OR: [
            { name: { contains: 'test store', mode: 'insensitive' } },
            { description: { contains: 'test store', mode: 'insensitive' } },
          ],
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        skip: 0,
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });
});