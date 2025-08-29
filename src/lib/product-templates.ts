import { ProductType } from '@prisma/client';

export interface ProductDimensions {
  width: number;
  height: number;
  unit: 'inches' | 'cm';
}

export interface ProductTemplate {
  type: ProductType;
  name: string;
  description: string;
  dimensions: ProductDimensions;
  imageArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  minResolution: {
    width: number;
    height: number;
  };
  maxFileSize: number; // in MB
  supportedFormats: string[];
  basePrice: number; // in cents
  mockupTemplate: string; // Path to mockup template image
}

export const PRODUCT_TEMPLATES: Record<ProductType, ProductTemplate> = {
  [ProductType.POSTCARD]: {
    type: ProductType.POSTCARD,
    name: 'Postcard',
    description: 'High-quality printed postcard',
    dimensions: {
      width: 6,
      height: 4,
      unit: 'inches'
    },
    imageArea: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    minResolution: {
      width: 1800,
      height: 1200
    },
    maxFileSize: 10,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    basePrice: 299, // $2.99
    mockupTemplate: '/templates/postcard-mockup.png'
  },
  
  [ProductType.SHIRT]: {
    type: ProductType.SHIRT,
    name: 'T-Shirt',
    description: 'Premium cotton t-shirt with custom print',
    dimensions: {
      width: 12,
      height: 16,
      unit: 'inches'
    },
    imageArea: {
      x: 25,
      y: 20,
      width: 50,
      height: 60
    },
    minResolution: {
      width: 2400,
      height: 3200
    },
    maxFileSize: 15,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    basePrice: 1999, // $19.99
    mockupTemplate: '/templates/shirt-mockup.png'
  },
  
  [ProductType.STICKER]: {
    type: ProductType.STICKER,
    name: 'Vinyl Sticker',
    description: 'Durable vinyl sticker with glossy finish',
    dimensions: {
      width: 3,
      height: 3,
      unit: 'inches'
    },
    imageArea: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    minResolution: {
      width: 900,
      height: 900
    },
    maxFileSize: 5,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    basePrice: 199, // $1.99
    mockupTemplate: '/templates/sticker-mockup.png'
  },
  
  [ProductType.LEGGINGS]: {
    type: ProductType.LEGGINGS,
    name: 'Leggings',
    description: 'Comfortable stretch leggings with all-over print',
    dimensions: {
      width: 14,
      height: 40,
      unit: 'inches'
    },
    imageArea: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    minResolution: {
      width: 2800,
      height: 8000
    },
    maxFileSize: 25,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    basePrice: 2999, // $29.99
    mockupTemplate: '/templates/leggings-mockup.png'
  },
  
  [ProductType.FIGURINE]: {
    type: ProductType.FIGURINE,
    name: '3D Figurine',
    description: 'Custom 3D printed figurine',
    dimensions: {
      width: 4,
      height: 6,
      unit: 'inches'
    },
    imageArea: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    minResolution: {
      width: 1024,
      height: 1024
    },
    maxFileSize: 10,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    basePrice: 4999, // $49.99
    mockupTemplate: '/templates/figurine-mockup.png'
  }
};

export function getProductTemplate(type: ProductType): ProductTemplate {
  return PRODUCT_TEMPLATES[type];
}

export function getAllProductTemplates(): ProductTemplate[] {
  return Object.values(PRODUCT_TEMPLATES);
}

export function validateImageForProduct(
  imageWidth: number,
  imageHeight: number,
  fileSizeMB: number,
  format: string,
  productType: ProductType
): { valid: boolean; errors: string[] } {
  const template = getProductTemplate(productType);
  const errors: string[] = [];

  // Check resolution
  if (imageWidth < template.minResolution.width || imageHeight < template.minResolution.height) {
    errors.push(
      `Image resolution too low. Minimum required: ${template.minResolution.width}x${template.minResolution.height}px`
    );
  }

  // Check file size
  if (fileSizeMB > template.maxFileSize) {
    errors.push(`File size too large. Maximum allowed: ${template.maxFileSize}MB`);
  }

  // Check format
  if (!template.supportedFormats.includes(format.toLowerCase())) {
    errors.push(`Unsupported format. Supported formats: ${template.supportedFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}