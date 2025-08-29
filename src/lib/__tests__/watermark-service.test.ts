import {
  applyWatermark,
  removeWatermark,
  removeWatermarksBatch,
  checkContentAccess,
  getImageUrlForAccess,
  generateProtectedImageUrl,
  DEFAULT_WATERMARK_OPTIONS
} from '../watermark-service';

// Mock the S3 service
jest.mock('../s3', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    key: 'watermarked/gen-123.jpg',
    url: 'https://s3.example.com/watermarked-image.jpg'
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('Watermark Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyWatermark', () => {
    it('should apply watermark to image', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageBuffer.buffer)
      });

      const result = await applyWatermark(
        'https://example.com/original.jpg',
        'gen-123'
      );

      expect(result).toBe('https://s3.example.com/watermarked-image.jpg');
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/original.jpg');
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await applyWatermark(
        'https://example.com/missing.jpg',
        'gen-123'
      );

      // Should return original URL on error
      expect(result).toBe('https://example.com/missing.jpg');
    });

    it('should use custom watermark options', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageBuffer.buffer)
      });

      const customOptions = {
        text: 'CUSTOM WATERMARK',
        opacity: 0.5,
        position: 'bottom-right' as const
      };

      const result = await applyWatermark(
        'https://example.com/original.jpg',
        'gen-123',
        customOptions
      );

      expect(result).toBe('https://s3.example.com/watermarked-image.jpg');
    });
  });

  describe('removeWatermark', () => {
    it('should remove watermark from image', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageBuffer.buffer)
      });

      const result = await removeWatermark(
        'https://s3.example.com/watermarked-image.jpg',
        'gen-123'
      );

      expect(result).toBe('https://s3.example.com/watermarked-image.jpg');
      expect(global.fetch).toHaveBeenCalledWith('https://s3.example.com/watermarked-image.jpg');
    });

    it('should handle removal errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const originalUrl = 'https://s3.example.com/watermarked-image.jpg';
      const result = await removeWatermark(originalUrl, 'gen-123');

      // Should return original URL on error
      expect(result).toBe(originalUrl);
    });
  });

  describe('removeWatermarksBatch', () => {
    it('should remove watermarks from multiple images', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageBuffer.buffer)
      });

      const imageUrls = [
        'https://s3.example.com/watermarked-1.jpg',
        'https://s3.example.com/watermarked-2.jpg'
      ];

      const result = await removeWatermarksBatch('order-123', imageUrls);

      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch processing', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('image1').buffer)
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const imageUrls = [
        'https://s3.example.com/watermarked-1.jpg',
        'https://s3.example.com/watermarked-2.jpg'
      ];

      const result = await removeWatermarksBatch('order-123', imageUrls);

      expect(result).toHaveLength(2);
      // Second URL should be returned as-is due to error
      expect(result[1]).toBe('https://s3.example.com/watermarked-2.jpg');
    });
  });

  describe('checkContentAccess', () => {
    it('should grant access to paid users', () => {
      const access = {
        userId: 'user-123',
        generationId: 'gen-123',
        hasPaid: true,
        accessLevel: 'full' as const
      };

      const result = checkContentAccess(access);
      expect(result).toBe(true);
    });

    it('should deny access to unpaid users', () => {
      const access = {
        userId: 'user-123',
        generationId: 'gen-123',
        hasPaid: false,
        accessLevel: 'preview' as const
      };

      const result = checkContentAccess(access);
      expect(result).toBe(false);
    });

    it('should deny access even if paid but access level is preview', () => {
      const access = {
        userId: 'user-123',
        generationId: 'gen-123',
        hasPaid: true,
        accessLevel: 'preview' as const
      };

      const result = checkContentAccess(access);
      expect(result).toBe(false);
    });
  });

  describe('getImageUrlForAccess', () => {
    const originalUrl = 'https://s3.example.com/original.jpg';
    const watermarkedUrl = 'https://s3.example.com/watermarked.jpg';

    it('should return original URL for paid users', () => {
      const access = {
        userId: 'user-123',
        generationId: 'gen-123',
        hasPaid: true,
        accessLevel: 'full' as const
      };

      const result = getImageUrlForAccess(originalUrl, watermarkedUrl, access);
      expect(result).toBe(originalUrl);
    });

    it('should return watermarked URL for unpaid users', () => {
      const access = {
        userId: 'user-123',
        generationId: 'gen-123',
        hasPaid: false,
        accessLevel: 'preview' as const
      };

      const result = getImageUrlForAccess(originalUrl, watermarkedUrl, access);
      expect(result).toBe(watermarkedUrl);
    });
  });

  describe('generateProtectedImageUrl', () => {
    it('should generate protected URL with query parameters', () => {
      const originalUrl = 'https://s3.example.com/image.jpg';
      const result = generateProtectedImageUrl(
        originalUrl,
        'gen-123',
        'user-123',
        3600
      );

      expect(result).toContain('user=user-123');
      expect(result).toContain('generation=gen-123');
      expect(result).toContain('expires=');
    });

    it('should use default expiration time', () => {
      const originalUrl = 'https://s3.example.com/image.jpg';
      const result = generateProtectedImageUrl(
        originalUrl,
        'gen-123',
        'user-123'
      );

      // Should contain expiration parameter
      expect(result).toContain('expires=');
    });
  });
});