import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../generate/route';

// Mock dependencies
const mockPrisma = {
  creator: {
    findUnique: jest.fn(),
  },
  generation: {
    create: jest.fn(),
  },
};

const mockReplicateService = {
  generateImage: jest.fn(),
};

const mockContentSafety = {
  validatePrompt: jest.fn(),
  isNSFW: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/replicate-service', () => ({
  ReplicateService: jest.fn().mockImplementation(() => mockReplicateService),
}));

jest.mock('@/lib/content-safety', () => ({
  ContentSafetyService: jest.fn().mockImplementation(() => mockContentSafety),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const { getServerSession } = require('next-auth');

describe('/api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/generate', () => {
    it('should generate image with text mode', async () => {
      // Mock authenticated session
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      // Mock creator lookup
      const mockCreator = {
        id: 'creator-1',
        name: 'Test Creator',
        status: 'READY',
        lora_url: 'https://example.com/lora.safetensors',
        trigger_word: 'testcreator',
      };
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      // Mock content safety validation
      mockContentSafety.validatePrompt.mockReturnValue({ isValid: true });
      mockContentSafety.isNSFW.mockReturnValue(false);

      // Mock Replicate generation
      mockReplicateService.generateImage.mockResolvedValue({
        id: 'replicate-job-123',
      });

      // Mock generation creation
      const mockGeneration = {
        id: 'generation-1',
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: 'TEXT',
        prompt: 'A portrait of testcreator',
        status: 'PROCESSING',
      };
      mockPrisma.generation.create.mockResolvedValue(mockGeneration);

      const requestBody = {
        creator_id: 'creator-1',
        mode: 'text',
        prompt: 'A portrait of testcreator',
        nsfw: false,
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.generation).toEqual(mockGeneration);
      expect(mockPrisma.generation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          creator_id: 'creator-1',
          user_id: 'user-1',
          mode: 'TEXT',
          prompt: 'A portrait of testcreator',
          status: 'PROCESSING',
        }),
      });
    });

    it('should generate image with photo mode', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockCreator = {
        id: 'creator-1',
        status: 'READY',
        lora_url: 'https://example.com/lora.safetensors',
        trigger_word: 'testcreator',
      };
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      mockContentSafety.validatePrompt.mockReturnValue({ isValid: true });
      mockContentSafety.isNSFW.mockReturnValue(false);

      mockReplicateService.generateImage.mockResolvedValue({
        id: 'replicate-job-456',
      });

      const mockGeneration = {
        id: 'generation-2',
        creator_id: 'creator-1',
        user_id: 'user-1',
        mode: 'PHOTO',
        scene_url: 'https://example.com/scene.jpg',
        status: 'PROCESSING',
      };
      mockPrisma.generation.create.mockResolvedValue(mockGeneration);

      const requestBody = {
        creator_id: 'creator-1',
        mode: 'photo',
        scene_url: 'https://example.com/scene.jpg',
        nsfw: false,
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.generation).toEqual(mockGeneration);
    });

    it('should return 401 when not authenticated', async () => {
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when creator not found', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      mockPrisma.creator.findUnique.mockResolvedValue(null);

      const requestBody = {
        creator_id: 'nonexistent-creator',
        mode: 'text',
        prompt: 'test prompt',
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when creator LoRA not ready', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockCreator = {
        id: 'creator-1',
        status: 'TRAINING', // Not ready
        lora_url: null,
      };
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      const requestBody = {
        creator_id: 'creator-1',
        mode: 'text',
        prompt: 'test prompt',
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when content safety validation fails', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockCreator = {
        id: 'creator-1',
        status: 'READY',
        lora_url: 'https://example.com/lora.safetensors',
      };
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      // Mock content safety failure
      mockContentSafety.validatePrompt.mockReturnValue({
        isValid: false,
        reason: 'Contains inappropriate content',
      });

      const requestBody = {
        creator_id: 'creator-1',
        mode: 'text',
        prompt: 'inappropriate content',
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when NSFW content detected but not allowed', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      const mockCreator = {
        id: 'creator-1',
        status: 'READY',
        lora_url: 'https://example.com/lora.safetensors',
      };
      mockPrisma.creator.findUnique.mockResolvedValue(mockCreator);

      mockContentSafety.validatePrompt.mockReturnValue({ isValid: true });
      mockContentSafety.isNSFW.mockReturnValue(true); // NSFW detected

      const requestBody = {
        creator_id: 'creator-1',
        mode: 'text',
        prompt: 'nsfw content',
        nsfw: false, // But not allowed
      };

      const request = new NextRequest('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});