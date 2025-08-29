import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '../product/route';

// Mock dependencies
const mockPrisma = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  generation: {
    findUnique: jest.fn(),
  },
  store: {
    findUnique: jest.fn(),
  },
};

const mockProductService = {
  createProduct: jest.fn(),
  validateProductSpecs: jest.fn(),
  generateProductPreview: jest.fn(),
};

const mockPolicyService = {
  validateLicensing: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/product-service', () => ({
  ProductService: jest.fn().mockImplementation(() => mockProductService),
}));

jest.mock('@/lib/policy-service', () => ({
  PolicyService: jest.fn().mockImplementation(() => mockPolicyService),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const { getServerSession } = require('next-auth');

describe('/api/product', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/product', () => {
    it('should create product successfully', async () => {
      // Mock authenticated session
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      // Mock generation lookup
      const mockGeneration = {
        id: 'generation-1',
        creator_id: 'creator-1',
        user_id: 'user-1',
        image_url: 'https://example.com/image.jpg',
        creator: {
          id: 'creator-1',
          allow_third_party_stores: true,
          min_price_cents: 500,
          royalty_bps: 1000,
        },
      };
      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);

      // Mock store lookup
      const mockStore = {
        id: 'store-1',
        owner_id: 'user-1',
      };
      mockPrisma.store.findUnique.mockResolvedValue(mockStore);

      // Mock policy validation
      mockPolicyService.validateLicensing.mockReturnValue({ isValid: true });

      // Mock product specs validation
      mockProductService.validateProductSpecs.mockReturnValue({ isValid: true });

      // Mock product creation
      const mockProduct = {
        id: 'product-1',
        store_id: 'store-1',
        generation_id: 'generation-1',
        creator_id: 'creator-1',
        product_type: 'POSTCARD',
        price_cents: 1000,
        status: 'ACTIVE',
      };
      mockProductService.createProduct.mockResolvedValue(mockProduct);

      const requestBody = {
        generation_id: 'generation-1',
        store_id: 'store-1',
        product_type: 'postcard',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.product).toEqual(mockProduct);
      expect(mockProductService.createProduct).toHaveBeenCalledWith({
        generation_id: 'generation-1',
        store_id: 'store-1',
        creator_id: 'creator-1',
        product_type: 'POSTCARD',
        price_cents: 1000,
      });
    });

    it('should return 401 when not authenticated', async () => {
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when generation not found', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      mockPrisma.generation.findUnique.mockResolvedValue(null);

      const requestBody = {
        generation_id: 'nonexistent-generation',
        store_id: 'store-1',
        product_type: 'postcard',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 403 when user does not own the generation', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockGeneration = {
        id: 'generation-1',
        user_id: 'different-user', // Different user
        creator_id: 'creator-1',
      };
      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);

      const requestBody = {
        generation_id: 'generation-1',
        store_id: 'store-1',
        product_type: 'postcard',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should return 400 when store not found', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockGeneration = {
        id: 'generation-1',
        user_id: 'user-1',
        creator_id: 'creator-1',
        creator: {
          allow_third_party_stores: true,
        },
      };
      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);
      mockPrisma.store.findUnique.mockResolvedValue(null);

      const requestBody = {
        generation_id: 'generation-1',
        store_id: 'nonexistent-store',
        product_type: 'postcard',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when licensing validation fails', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockGeneration = {
        id: 'generation-1',
        user_id: 'user-1',
        creator_id: 'creator-1',
        creator: {
          allow_third_party_stores: false, // Not allowed
          min_price_cents: 500,
        },
      };
      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);

      const mockStore = {
        id: 'store-1',
        owner_id: 'different-user', // Third-party store
      };
      mockPrisma.store.findUnique.mockResolvedValue(mockStore);

      mockPolicyService.validateLicensing.mockReturnValue({
        isValid: false,
        reason: 'Creator does not allow third-party stores',
      });

      const requestBody = {
        generation_id: 'generation-1',
        store_id: 'store-1',
        product_type: 'postcard',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when product specs validation fails', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockGeneration = {
        id: 'generation-1',
        user_id: 'user-1',
        creator_id: 'creator-1',
        image_url: 'https://example.com/image.jpg',
        creator: {
          allow_third_party_stores: true,
          min_price_cents: 500,
        },
      };
      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);

      const mockStore = {
        id: 'store-1',
        owner_id: 'user-1',
      };
      mockPrisma.store.findUnique.mockResolvedValue(mockStore);

      mockPolicyService.validateLicensing.mockReturnValue({ isValid: true });

      // Mock product specs validation failure
      mockProductService.validateProductSpecs.mockReturnValue({
        isValid: false,
        reason: 'Image resolution too low for shirt printing',
      });

      const requestBody = {
        generation_id: 'generation-1',
        store_id: 'store-1',
        product_type: 'shirt',
        price_cents: 1000,
      };

      const request = new NextRequest('http://localhost:3000/api/product', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/product', () => {
    it('should return products with filters', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          product_type: 'POSTCARD',
          price_cents: 1000,
          status: 'ACTIVE',
          store: {
            id: 'store-1',
            name: 'Test Store',
          },
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
          },
          generation: {
            image_url: 'https://example.com/image1.jpg',
          },
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const request = new NextRequest(
        'http://localhost:3000/api/product?store_id=store-1&product_type=postcard'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toEqual(mockProducts);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          store_id: 'store-1',
          product_type: 'POSTCARD',
          status: 'ACTIVE',
        },
        include: expect.objectContaining({
          store: true,
          creator: true,
          generation: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return all active products when no filters provided', async () => {
      const mockProducts = [];
      mockPrisma.product.findMany.mockResolvedValue(mockProducts);

      const request = new NextRequest('http://localhost:3000/api/product');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.product.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/product');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});