'use client';

import { useState, useEffect } from 'react';
import { ProductType } from '@prisma/client';
import { validateImageForProduct, getProductTemplate } from '@/lib/product-templates';
import { ProductService } from '@/lib/product-service';

interface ProductValidatorProps {
  imageUrl: string;
  productType: ProductType;
  customizations?: any;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export default function ProductValidator({
  imageUrl,
  productType,
  customizations,
  onValidationChange
}: ProductValidatorProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: [],
    warnings: [],
    suggestions: []
  });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    validateProduct();
  }, [imageUrl, productType, customizations]);

  const validateProduct = async () => {
    setIsValidating(true);

    try {
      const template = getProductTemplate(productType);
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Validate product specifications
      const specValidation = ProductService.validateProductSpecs(
        imageUrl,
        productType,
        customizations
      );

      if (!specValidation.valid) {
        errors.push(...specValidation.errors);
      }

      // Get image information for detailed validation
      const imageInfo = await getImageInfo(imageUrl);
      
      if (imageInfo) {
        // Validate image dimensions and quality
        const imageValidation = validateImageForProduct(
          imageInfo.width,
          imageInfo.height,
          imageInfo.fileSizeMB,
          imageInfo.format,
          productType
        );

        if (!imageValidation.valid) {
          errors.push(...imageValidation.errors);
        }

        // Add warnings for suboptimal settings
        if (imageInfo.width < template.minResolution.width * 1.5) {
          warnings.push('Image resolution is low. Higher resolution recommended for best quality.');
        }

        if (imageInfo.fileSizeMB > template.maxFileSize * 0.8) {
          warnings.push('Large file size may slow down processing.');
        }

        // Add suggestions for improvement
        if (productType === ProductType.SHIRT && imageInfo.width / imageInfo.height < 0.7) {
          suggestions.push('Consider using a more vertical image for better shirt placement.');
        }

        if (productType === ProductType.STICKER && imageInfo.width !== imageInfo.height) {
          suggestions.push('Square images work best for stickers.');
        }

        if (productType === ProductType.POSTCARD && imageInfo.width / imageInfo.height < 1.3) {
          suggestions.push('Landscape orientation recommended for postcards.');
        }
      }

      // Validate customizations
      if (customizations) {
        const customizationOptions = ProductService.getCustomizationOptions(productType);
        
        if (customizations.size && customizationOptions.sizes && 
            !customizationOptions.sizes.includes(customizations.size)) {
          errors.push(`Invalid size selection: ${customizations.size}`);
        }

        if (customizations.color && customizationOptions.colors && 
            !customizationOptions.colors.includes(customizations.color)) {
          errors.push(`Invalid color selection: ${customizations.color}`);
        }
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

      setValidation(result);
      onValidationChange?.(result.isValid, result.errors);

    } catch (error) {
      const errorResult: ValidationResult = {
        isValid: false,
        errors: ['Failed to validate product'],
        warnings: [],
        suggestions: []
      };
      
      setValidation(errorResult);
      onValidationChange?.(false, errorResult.errors);
    } finally {
      setIsValidating(false);
    }
  };

  const getImageInfo = async (url: string): Promise<{
    width: number;
    height: number;
    format: string;
    fileSizeMB: number;
  } | null> => {
    try {
      // In a real implementation, this would analyze the actual image
      // For now, return mock data that represents a valid image
      return {
        width: 2400,
        height: 2400,
        format: 'png',
        fileSizeMB: 5
      };
    } catch (error) {
      return null;
    }
  };

  if (isValidating) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-gray-600">Validating product...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      <div className={`p-4 rounded-lg ${
        validation.isValid 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full mr-2 ${
            validation.isValid ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className={`font-medium ${
            validation.isValid ? 'text-green-800' : 'text-red-800'
          }`}>
            {validation.isValid ? 'Product is valid' : 'Product has issues'}
          </span>
        </div>
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">Errors (must fix):</h4>
          <ul className="list-disc list-inside space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index} className="text-red-700 text-sm">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
          <ul className="list-disc list-inside space-y-1">
            {validation.warnings.map((warning, index) => (
              <li key={index} className="text-yellow-700 text-sm">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {validation.suggestions.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Suggestions:</h4>
          <ul className="list-disc list-inside space-y-1">
            {validation.suggestions.map((suggestion, index) => (
              <li key={index} className="text-blue-700 text-sm">{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Product Requirements */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">Product Requirements:</h4>
        <ProductRequirements productType={productType} />
      </div>
    </div>
  );
}

interface ProductRequirementsProps {
  productType: ProductType;
}

function ProductRequirements({ productType }: ProductRequirementsProps) {
  const template = getProductTemplate(productType);

  return (
    <div className="space-y-2 text-sm text-gray-600">
      <div>
        <span className="font-medium">Minimum Resolution:</span>{' '}
        {template.minResolution.width} × {template.minResolution.height} pixels
      </div>
      <div>
        <span className="font-medium">Maximum File Size:</span> {template.maxFileSize} MB
      </div>
      <div>
        <span className="font-medium">Supported Formats:</span>{' '}
        {template.supportedFormats.join(', ').toUpperCase()}
      </div>
      <div>
        <span className="font-medium">Product Dimensions:</span>{' '}
        {template.dimensions.width}" × {template.dimensions.height}"
      </div>
      <div>
        <span className="font-medium">Base Price:</span> ${(template.basePrice / 100).toFixed(2)}
      </div>
    </div>
  );
}