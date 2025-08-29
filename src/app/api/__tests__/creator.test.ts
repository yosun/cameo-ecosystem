import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '../creator/route';

// Mock dependencies
const mockPrisma = {
  creator: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockFALService = {
  submitLoRATraining: jest.fn(),
};

const mockS3Service = {
  uploadFile: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/lib/fal-service', () => ({
  FALService: jest.fn().mockImplementation(() => mockFALService),
}));

jest.mock('@/lib/s3', () => ({
  S3Service: jest.fn().mockImplementation(() => mockS3Service),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const { getServerSession } = require('next-auth');

describe('/api/creator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/creator', () => {
    it('should create a creator with valid data', async () => {
      // Mock authenticated session
      getServerSession.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      // Mock file uploads
      mockS3Service.uploadFile.mockResolvedValue('https://s3.example.com/image1.jpg');

      // Mock FAL training submission
      mockFALService.submitLoRATraining.mockResolvedValue({
        request_id: 'fal-job-123',
      });

      // Mock creator creation
      const mockCreator = {
        id: 'creator-1',
        name: 'Test Creator',
        email: 'test@example.com',
        status: 'TRAINING',
      };
      mockPrisma.creator.create.mockResolvedValue(mockCreator);

      // Create form data
      const formData = new FormData();
      formData.append('name', 'Test Creator');
      formData.append('consent_given', 'true');
      formData.append('allow_third_party_stores', 'true');
      formData.append('royalty_bps', '1000');
      
      // Mock file
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      formData.append('images', mockFile);

      const request = new NextRequest('http://localhost:3000/api/creator', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.creator).toEqual(mockCreator);
      expect(mockPrisma.creator.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Creator',
          email: 'test@example.com',
          consent_given: true,
          allow_third_party_stores: true,
          royalty_bps: 1000,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      getServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/creator', {
        method: 'POST',
        body: new FormData(),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when consent not given', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      const formData = new FormData();
      formData.append('name', 'Test Creator');
      formData.append('consent_given', 'false');

      const request = new NextRequest('http://localhost:3000/api/creator', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when insufficient images provided', async () => {
      getServerSession.mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com' },
      });

      const formData = new FormData();
      formData.append('name', 'Test Creator');
      formData.append('consent_given', 'true');
      // No images provided

      const request = new NextRequest('http://localhost:3000/api/creator', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/creator', () => {
    it('should return list of ready creators', async () => {
      const mockCreators = [
        {
          id: 'creator-1',
          name: 'Creator 1',
          status: 'READY',
          lora_url: 'https://example.com/lora1.safetensors',
          trigger_word: 'creator1',
        },
        {
          id: 'creator-2',
          name: 'Creator 2',
          status: 'READY',
          lora_url: 'https://example.com/lora2.safetensors',
          trigger_word: 'creator2',
        },
      ];

      mockPrisma.creator.findMany.mockResolvedValue(mockCreators);

      const request = new NextRequest('http://localhost:3000/api/creator');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creators).toEqual(mockCreators);
      expect(mockPrisma.creator.findMany).toHaveBeenCalledWith({
        where: {
          status: 'READY',
          lora_url: { not: null },
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          status: true,
          lora_url: true,
          trigger_word: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.creator.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/creator');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});