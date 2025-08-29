import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    creator: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { 
  createCreator, 
  getCreatorById, 
  getCreatorByEmail, 
  updateCreator,
  updateCreatorLoRAStatus,
  getAllCreators,
  getReadyCreators
} from '../creator-service';
import { LoRAStatus } from '@prisma/client';

// Get the mocked prisma
const { prisma } = require('@/lib/prisma');
const mockPrisma = prisma;

describe('Creator Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCreator', () => {
    it('should create a creator with default values', async () => {
      const mockCreator = {
        id: 'creator-1',
        name: 'Test Creator',
        email: 'test@example.com',
        training_images: ['image1.jpg', 'image2.jpg'],
        consent_given: true,
        status: LoRAStatus.PENDING,
        allow_third_party_stores: true,
        royalty_bps: 1000,
        min_price_cents: 500,
        max_discount_bps: 2000,
      };

      mockPrisma.creator.create.mockResolvedValue(mockCreator);

      const result = await createCreator({
        name: 'Test Creator',
        email: 'test@example.com',
        training_images: ['image1.jpg', 'image2.jpg'],
        consent_given: true,
      });

      expect(mockPrisma.creator.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Creator',
          email: 'test@example.com',
          training_images: ['image1.jpg', 'image2.jpg'],
          consent_given: true,
          allow_third_party_stores: true,
          royalty_bps: 1000,
          min_price_cents: 500,
          max_discount_bps: 2000,
        },
      });

      expect(result).toEqual(mockCreator);
    });

    it('should create a creator with custom licensing values', async () => {
      const mockCreator = {
        id: 'creator-1',
        name: 'Test Creator',
        email: 'test@example.com',
        training_images: ['image1.jpg'],
        consent_given: true,
        status: LoRAStatus.PENDING,
        allow_third_party_stores: false,
        royalty_bps: 1500,
        min_price_cents: 1000,
        max_discount_bps: 1000,
      };

      mockPrisma.creator.create.mockResolvedValue(mockCreator);

      const result = await createCreator({
        name: 'Test Creator',
        email: 'test@example.com',
        training_images: ['image1.jpg'],
        consent_given: true,
        allow_third_party_stores: false,
        royalty_bps: 1500,
        min_price_cents: 1000,
        max_discount_bps: 1000,
      });

      expect(mockPrisma.creator.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Creator',
          email: 'test@example.com',
          training_images: ['image1.jpg'],
          consent_given: true,
          allow_third_party_stores: false,
          royalty_bps: 1500,
          min_price_cents: 1000,
          max_discount_bps: 1000,
        },
      });

      expect(result).toEqual(mockCreator);
    });
  });

  describe('getCreatorById', () => {
    it('should return a creator by ID', async () => {
      const mockCreator = {
        id: 'creator-1',
        name: 'Test Creator',
        email: 'test@example.com',
      };

      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      const result = await getCreatorById('creator-1');

      expect(mockPrisma.creator.findUnique).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
      });

      expect(result).toEqual(mockCreator);
    });

    it('should return null if creator not found', async () => {
      mockPrisma.creator.findUnique.mockResolvedValue(null);

      const result = await getCreatorById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateCreatorLoRAStatus', () => {
    it('should update creator LoRA status to READY with URLs', async () => {
      const mockUpdatedCreator = {
        id: 'creator-1',
        status: LoRAStatus.READY,
        lora_url: 'https://example.com/lora.safetensors',
        trigger_word: 'creator_12345678',
      };

      mockPrisma.creator.update.mockResolvedValue(mockUpdatedCreator);

      const result = await updateCreatorLoRAStatus(
        'creator-1',
        LoRAStatus.READY,
        'https://example.com/lora.safetensors',
        'creator_12345678'
      );

      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
        data: {
          status: LoRAStatus.READY,
          lora_url: 'https://example.com/lora.safetensors',
          trigger_word: 'creator_12345678',
        },
      });

      expect(result).toEqual(mockUpdatedCreator);
    });

    it('should update creator LoRA status to FAILED', async () => {
      const mockUpdatedCreator = {
        id: 'creator-1',
        status: LoRAStatus.FAILED,
        lora_url: null,
        trigger_word: null,
      };

      mockPrisma.creator.update.mockResolvedValue(mockUpdatedCreator);

      const result = await updateCreatorLoRAStatus('creator-1', LoRAStatus.FAILED);

      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
        data: {
          status: LoRAStatus.FAILED,
          lora_url: undefined,
          trigger_word: undefined,
        },
      });

      expect(result).toEqual(mockUpdatedCreator);
    });
  });

  describe('getReadyCreators', () => {
    it('should return only creators with READY status and lora_url', async () => {
      const mockCreators = [
        {
          id: 'creator-1',
          name: 'Ready Creator 1',
          status: LoRAStatus.READY,
          lora_url: 'https://example.com/lora1.safetensors',
        },
        {
          id: 'creator-2',
          name: 'Ready Creator 2',
          status: LoRAStatus.READY,
          lora_url: 'https://example.com/lora2.safetensors',
        },
      ];

      mockPrisma.creator.findMany.mockResolvedValue(mockCreators);

      const result = await getReadyCreators();

      expect(mockPrisma.creator.findMany).toHaveBeenCalledWith({
        where: {
          status: LoRAStatus.READY,
          lora_url: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockCreators);
    });
  });
});