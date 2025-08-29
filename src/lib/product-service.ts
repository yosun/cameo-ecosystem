import { ProductType } from '@prisma/client';
import { getProductTemplate, validateImageForProduct, ProductTemplate } from './product-templates';

export interface ProductApplicationResult {
  success: boolean;
  previewUrl?: string;
  errors?: string[];
  productId?: string;
}

export interface ProductPreviewOptions {
  imageUrl: string;
  productType: ProductType;
  customizations?: {
    size?: string;
    color?: string;
    placement?: 'center' | 'top' | 'bottom';
  };
}

export class ProductService {
  /**
   * Apply an image to a product template and generate preview
   */
  static async applyImageToProduct(
    imageUrl: string,
    productType: ProductType,
    options?: ProductPreviewOptions['customizations']
  ): Promise<ProductApplicationResult> {
    try {
      const template = getProductTemplate(productType);
      
      // Validate image dimensions and format
      const imageInfo = await this.getImageInfo(imageUrl);
      const validation = validateImageForProduct(
        imageInfo.width,
        imageInfo.height,
        imageInfo.fileSizeMB,
        imageInfo.format,
        productType
      );

      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Generate product preview
      const previewUrl = await this.generateProductPreview({
        imageUrl,
        productType,
        customizations: options
      });

      return {
        success: true,
        previewUrl
      };
    } catch (error) {
      console.error('Error applying image to product:', error);
      return {
        success: false,
        errors: ['Failed to process image for product application']
      };
    }
  }

  /**
   * Generate a product preview with the applied image
   */
  static async generateProductPreview(options: ProductPreviewOptions): Promise<string> {
    const template = getProductTemplate(options.productType);
    
    // For now, we'll use a simple preview generation
    // In a real implementation, this would use image processing libraries
    // like Sharp or Canvas API to composite the image onto the product template
    
    const previewParams = new URLSearchParams({
      image: options.imageUrl,
      template: template.mockupTemplate,
      type: options.productType,
      placement: options.customizations?.placement || 'center',
      size: options.customizations?.size || 'medium',
      color: options.customizations?.color || 'white'
    });

    // Return a URL to our preview generation endpoint
    return `/api/product/preview?${previewParams.toString()}`;
  }

  /**
   * Get image information (dimensions, format, file size)
   */
  private static async getImageInfo(imageUrl: string): Promise<{
    width: number;
    height: number;
    format: string;
    fileSizeMB: number;
  }> {
    // In a real implementation, this would fetch the image and analyze it
    // For now, we'll return mock data that passes validation
    return {
      width: 2400,
      height: 2400,
      format: 'png',
      fileSizeMB: 5
    };
  }

  /**
   * Calculate product price including customizations
   */
  static calculateProductPrice(
    productType: ProductType,
    customizations?: ProductPreviewOptions['customizations']
  ): number {
    const template = getProductTemplate(productType);
    let price = template.basePrice;

    // Add customization costs
    if (customizations?.size === 'large') {
      price += 500; // $5.00 extra for large size
    }
    if (customizations?.color && customizations.color !== 'white') {
      price += 200; // $2.00 extra for colored products
    }

    return price;
  }

  /**
   * Get available customization options for a product type
   */
  static getCustomizationOptions(productType: ProductType): {
    sizes?: string[];
    colors?: string[];
    placements?: string[];
  } {
    const baseOptions = {
      placements: ['center', 'top', 'bottom']
    };

    switch (productType) {
      case ProductType.SHIRT:
        return {
          ...baseOptions,
          sizes: ['S', 'M', 'L', 'XL', 'XXL'],
          colors: ['white', 'black', 'navy', 'gray']
        };
      
      case ProductType.LEGGINGS:
        return {
          ...baseOptions,
          sizes: ['XS', 'S', 'M', 'L', 'XL'],
          colors: ['black', 'navy', 'gray']
        };
      
      case ProductType.POSTCARD:
        return {
          placements: ['center']
        };
      
      case ProductType.STICKER:
        return {
          sizes: ['small', 'medium', 'large']
        };
      
      case ProductType.FIGURINE:
        return {
          sizes: ['4inch', '6inch', '8inch']
        };
      
      default:
        return baseOptions;
    }
  }

  /**
   * Validate product specifications before creation
   */
  static validateProductSpecs(
    imageUrl: string,
    productType: ProductType,
    customizations?: ProductPreviewOptions['customizations']
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const template = getProductTemplate(productType);
    const options = this.getCustomizationOptions(productType);

    // Validate customizations
    if (customizations?.size && options.sizes && !options.sizes.includes(customizations.size)) {
      errors.push(`Invalid size. Available sizes: ${options.sizes.join(', ')}`);
    }

    if (customizations?.color && options.colors && !options.colors.includes(customizations.color)) {
      errors.push(`Invalid color. Available colors: ${options.colors.join(', ')}`);
    }

    if (customizations?.placement && options.placements && !options.placements.includes(customizations.placement)) {
      errors.push(`Invalid placement. Available placements: ${options.placements.join(', ')}`);
    }

    // Validate image URL
    if (!imageUrl || !this.isValidImageUrl(imageUrl)) {
      errors.push('Invalid image URL provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static isValidImageUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }
}