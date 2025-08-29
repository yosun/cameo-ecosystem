import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  generation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { 
  GenerationService,
  createGeneration,
  getGenerationById,
  updateGenerationStatus,
  getUserGenerations
} from '../generation-service';
import { GenerationMode, JobStatus } from '@prisma/client';

describe('GenerationService', () => {
  let service: GenerationService;

  beforeEach(() => {
    service = new GenerationService();
    jest.clearAllMocks();
  });

  describe('createGeneration', () => {
    it('should create text mode generation', async () => {
      const mockGeneration = {
        id: 'generation-1',
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: GenerationMode.TEXT,
        prompt: 'A portrait of testcreator',
        status: JobStatus.PENDING,
      };

      mockPrisma.generation.create.mockResolvedValue(mockGeneration);

      const result = await createGeneration({
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: 'text',
        prompt: 'A portrait of testcreator',
      });

      expect(mockPrisma.generation.create).toHaveBeenCalledWith({
        data: {
          creator_id: 'creator-1',
          user_id: 'user-1',
          mode: GenerationMode.TEXT,
          prompt: 'A portrait of testcreator',
          scene_url: undefined,
          status: JobStatus.PENDING,
        },
      });

      expect(result).toEqual(mockGeneration);
    });

    it('should create photo mode generation', async () => {
      const mockGeneration = {
        id: 'generation-2',
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: GenerationMode.PHOTO,
        scene_url: 'https://example.com/scene.jpg',
        status: JobStatus.PENDING,
      };

      mockPrisma.generation.create.mockResolvedValue(mockGeneration);

      const result = await createGeneration({
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: 'photo',
        scene_url: 'https://example.com/scene.jpg',
      });

      expect(mockPrisma.generation.create).toHaveBeenCalledWith({
        data: {
          creator_id: 'creator-1',
          user_id: 'user-1',
          mode: GenerationMode.PHOTO,
          prompt: undefined,
          scene_url: 'https://example.com/scene.jpg',
          status: JobStatus.PENDING,
        },
      });

      expect(result).toEqual(mockGeneration);
    });
  });

  describe('getGenerationById', () => {
    it('should return generation with relations', async () => {
      const mockGeneration = {
        id: 'generation-1',
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: GenerationMode.TEXT,
        status: JobStatus.COMPLETED,
        image_url: 'https://example.com/generated.jpg',
        creator: {
          id: 'creator-1',
          name: 'Test Creator',
          trigger_word: 'testcreator',
        },
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
      };

      mockPrisma.generation.findUnique.mockResolvedValue(mockGeneration);

      const result = await getGenerationById('generation-1');

      expect(mockPrisma.generation.findUnique).toHaveBeenCalledWith({
        where: { id: 'generation-1' },
        include: {
          creator: true,
          user: true,
        },
      });

      expect(result).toEqual(mockGeneration);
    });

    it('should return null if generation not found', async () => {
      mockPrisma.generation.findUnique.mockResolvedValue(null);

      const result = await getGenerationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateGenerationStatus', () => {
    it('should update generation status to completed with image URL', async () => {
      const mockUpdatedGeneration = {
        id: 'generation-1',
        status: JobStatus.COMPLETED,
        image_url: 'https://example.com/completed.jpg',
      };

      mockPrisma.generation.update.mockResolvedValue(mockUpdatedGeneration);

      const result = await updateGenerationStatus(
        'generation-1',
        JobStatus.COMPLETED,
        'https://example.com/completed.jpg'
      );

      expect(mockPrisma.generation.update).toHaveBeenCalledWith({
        where: { id: 'generation-1' },
        data: {
          status: JobStatus.COMPLETED,
          image_url: 'https://example.com/completed.jpg',
        },
      });

      expect(result).toEqual(mockUpdatedGeneration);
    });

    it('should update generation status to failed without image URL', async () => {
      const mockUpdatedGeneration = {
        id: 'generation-1',
        status: JobStatus.FAILED,
        image_url: null,
      };

      mockPrisma.generation.update.mockResolvedValue(mockUpdatedGeneration);

      const result = await updateGenerationStatus('generation-1', JobStatus.FAILED);

      expect(mockPrisma.generation.update).toHaveBeenCalledWith({
        where: { id: 'generation-1' },
        data: {
          status: JobStatus.FAILED,
          image_url: undefined,
        },
      });

      expect(result).toEqual(mockUpdatedGeneration);
    });
  });

  describe('getUserGenerations', () => {
    it('should return user generations ordered by creation date', async () => {
      const mockGenerations = [
        {
          id: 'generation-1',
          user_id: 'user-1',
          status: JobStatus.COMPLETED,
          createdAt: new Date('2023-01-02'),
        },
        {
          id: 'generation-2',
          user_id: 'user-1',
          status: JobStatus.PROCESSING,
          createdAt: new Date('2023-01-01'),
        },
      ];

      mockPrisma.generation.findMany.mockResolvedValue(mockGenerations);

      const result = await getUserGenerations('user-1');

      expect(mockPrisma.generation.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              trigger_word: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockGenerations);
    });

    it('should filter by status when provided', async () => {
      const mockGenerations = [
        {
          id: 'generation-1',
          user_id: 'user-1',
          status: JobStatus.COMPLETED,
        },
      ];

      mockPrisma.generation.findMany.mockResolvedValue(mockGenerations);

      const result = await getUserGenerations('user-1', JobStatus.COMPLETED);

      expect(mockPrisma.generation.findMany).toHaveBeenCalledWith({
        where: { 
          user_id: 'user-1',
          status: JobStatus.COMPLETED,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockGenerations);
    });
  });

  describe('GenerationService class methods', () => {
    describe('validateGenerationRequest', () => {
      it('should validate text mode request', () => {
        const request = {
          mode: 'text' as const,
          prompt: 'A portrait of testcreator',
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(true);
      });

      it('should validate photo mode request', () => {
        const request = {
          mode: 'photo' as const,
          scene_url: 'https://example.com/scene.jpg',
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(true);
      });

      it('should reject text mode without prompt', () => {
        const request = {
          mode: 'text' as const,
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Prompt is required for text mode');
      });

      it('should reject photo mode without scene_url', () => {
        const request = {
          mode: 'photo' as const,
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Scene URL is required for photo mode');
      });

      it('should reject empty prompt', () => {
        const request = {
          mode: 'text' as const,
          prompt: '',
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Prompt cannot be empty');
      });

      it('should reject prompt that is too long', () => {
        const longPrompt = 'a'.repeat(1001); // Assuming 1000 char limit
        const request = {
          mode: 'text' as const,
          prompt: longPrompt,
          creator_id: 'creator-1',
        };

        const result = service.validateGenerationRequest(request);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Prompt is too long (max 1000 characters)');
      });
    });

    describe('buildReplicatePrompt', () => {
      it('should build prompt with trigger word for text mode', () => {
        const creator = {
          id: 'creator-1',
          trigger_word: 'testcreator',
          lora_url: 'https://example.com/lora.safetensors',
        };

        const result = service.buildReplicatePrompt(
          'text',
          creator,
          'A portrait',
          undefined
        );

        expect(result).toContain('testcreator');
        expect(result).toContain('A portrait');
      });

      it('should build prompt for photo mode', () => {
        const creator = {
          id: 'creator-1',
          trigger_word: 'testcreator',
          lora_url: 'https://example.com/lora.safetensors',
        };

        const result = service.buildReplicatePrompt(
          'photo',
          creator,
          undefined,
          'https://example.com/scene.jpg'
        );

        expect(result).toContain('testcreator');
      });
    });

    describe('estimateGenerationTime', () => {
      it('should estimate time for text mode', () => {
        const time = service.estimateGenerationTime('text');
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(300); // Should be under 5 minutes
      });

      it('should estimate time for photo mode', () => {
        const time = service.estimateGenerationTime('photo');
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(300);
      });
    });
  });
});