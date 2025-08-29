import { ProductType } from '@prisma/client';
import { ProductService } from '../product-service';
import { getProductTemplate } from '../product-templates';

// Mock the product templates
jest.mock('../product-templates', () => ({
  getProductTemplate: jest.fn(),
  validateImageForProduct: jest.fn()
}));

const mockGetProductTemplate = getProductTemplate as jest.MockedFunction<typeof getProductTemplate>;

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateProductPrice', () => {
    beforeEach(() => {
      mockGetProductTemplate.mockReturnValue({
        type: ProductType.SHIRT,
        name: 'T-Shirt',
        basePrice: 1999,
        // ... other template properties
      } as any);
    });

    it('should return base price with no customizations', () => {
      const price = ProductService.calculateProductPrice(ProductType.SHIRT);
      expect(price).toBe(1999);
    });

    it('should add extra cost for large size', () => {
      const price = ProductService.calculateProductPrice(ProductType.SHIRT, {
        size: 'large'
      });
      expect(price).toBe(2499); // 1999 + 500
    });

    it('should add extra cost for colored products', () => {
      const price = ProductService.calculateProductPrice(ProductType.SHIRT, {
        color: 'black'
      });
      expect(price).toBe(2199); // 1999 + 200
    });

    it('should not add extra cost for white color', () => {
      const price = ProductService.calculateProductPrice(ProductType.SHIRT, {
        color: 'white'
      });
      expect(price).toBe(1999);
    });

    it('should combine multiple customization costs', () => {
      const price = ProductService.calculateProductPrice(ProductType.SHIRT, {
        size: 'large',
        color: 'black'
      });
      expect(price).toBe(2699); // 1999 + 500 + 200
    });
  });

  describe('getCustomizationOptions', () => {
    it('should return correct options for shirt', () => {
      const options = ProductService.getCustomizationOptions(ProductType.SHIRT);
      expect(options).toEqual({
        placements: ['center', 'top', 'bottom'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: ['white', 'black', 'navy', 'gray']
      });
    });

    it('should return correct options for leggings', () => {
      const options = ProductService.getCustomizationOptions(ProductType.LEGGINGS);
      expect(options).toEqual({
        placements: ['center', 'top', 'bottom'],
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['black', 'navy', 'gray']
      });
    });

    it('should return correct options for postcard', () => {
      const options = ProductService.getCustomizationOptions(ProductType.POSTCARD);
      expect(options).toEqual({
        placements: ['center']
      });
    });

    it('should return correct options for sticker', () => {
      const options = ProductService.getCustomizationOptions(ProductType.STICKER);
      expect(options).toEqual({
        sizes: ['small', 'medium', 'large']
      });
    });

    it('should return correct options for figurine', () => {
      const options = ProductService.getCustomizationOptions(ProductType.FIGURINE);
      expect(options).toEqual({
        sizes: ['4inch', '6inch', '8inch']
      });
    });
  });

  describe('validateProductSpecs', () => {
    beforeEach(() => {
      mockGetProductTemplate.mockReturnValue({
        type: ProductType.SHIRT,
        name: 'T-Shirt',
        // ... other template properties
      } as any);
    });

    it('should validate valid product specs', () => {
      const result = ProductService.validateProductSpecs(
        'https://example.com/image.jpg',
        ProductType.SHIRT,
        {
          size: 'L',
          color: 'black',
          placement: 'center'
        }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid image URL', () => {
      const result = ProductService.validateProductSpecs(
        'invalid-url',
        ProductType.SHIRT
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid image URL provided');
    });

    it('should reject invalid size', () => {
      const result = ProductService.validateProductSpecs(
        'https://example.com/image.jpg',
        ProductType.SHIRT,
        {
          size: 'XXXL' // Invalid size
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid size. Available sizes: S, M, L, XL, XXL');
    });

    it('should reject invalid color', () => {
      const result = ProductService.validateProductSpecs(
        'https://example.com/image.jpg',
        ProductType.SHIRT,
        {
          color: 'purple' // Invalid color
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid color. Available colors: white, black, navy, gray');
    });

    it('should reject invalid placement', () => {
      const result = ProductService.validateProductSpecs(
        'https://example.com/image.jpg',
        ProductType.SHIRT,
        {
          placement: 'left' as any // Invalid placement
        }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid placement. Available placements: center, top, bottom');
    });

    it('should handle empty image URL', () => {
      const result = ProductService.validateProductSpecs(
        '',
        ProductType.SHIRT
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid image URL provided');
    });
  });

  describe('generateProductPreview', () => {
    it('should generate preview URL with correct parameters', async () => {
      mockGetProductTemplate.mockReturnValue({
        type: ProductType.SHIRT,
        mockupTemplate: '/templates/shirt-mockup.png'
      } as any);

      const previewUrl = await ProductService.generateProductPreview({
        imageUrl: 'https://example.com/image.jpg',
        productType: ProductType.SHIRT,
        customizations: {
          size: 'L',
          color: 'black',
          placement: 'center'
        }
      });

      expect(previewUrl).toContain('/api/product/preview');
      expect(previewUrl).toContain('image=https%3A%2F%2Fexample.com%2Fimage.jpg');
      expect(previewUrl).toContain('type=SHIRT');
      expect(previewUrl).toContain('size=L');
      expect(previewUrl).toContain('color=black');
      expect(previewUrl).toContain('placement=center');
    });

    it('should use default values for missing customizations', async () => {
      mockGetProductTemplate.mockReturnValue({
        type: ProductType.SHIRT,
        mockupTemplate: '/templates/shirt-mockup.png'
      } as any);

      const previewUrl = await ProductService.generateProductPreview({
        imageUrl: 'https://example.com/image.jpg',
        productType: ProductType.SHIRT
      });

      expect(previewUrl).toContain('placement=center');
      expect(previewUrl).toContain('size=medium');
      expect(previewUrl).toContain('color=white');
    });
  });
});