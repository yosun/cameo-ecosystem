'use client';

import { useState } from 'react';
import { ProductType } from '@prisma/client';
import { ProductService } from '@/lib/product-service';
import { getProductTemplate, getAllProductTemplates } from '@/lib/product-templates';

interface ProductCreationWizardProps {
  generationId: string;
  imageUrl: string;
  storeId: string;
  onProductCreated?: (product: any) => void;
  onCancel?: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  completed: boolean;
}

export default function ProductCreationWizard({
  generationId,
  imageUrl,
  storeId,
  onProductCreated,
  onCancel
}: ProductCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [customizations, setCustomizations] = useState<any>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const steps: WizardStep[] = [
    { id: 'select-product', title: 'Select Product Type', completed: !!selectedProductType },
    { id: 'customize', title: 'Customize Product', completed: false },
    { id: 'preview', title: 'Preview & Confirm', completed: false }
  ];

  const productTemplates = getAllProductTemplates();

  const handleProductTypeSelect = async (productType: ProductType) => {
    setSelectedProductType(productType);
    setErrors([]);
    
    // Generate initial preview
    setIsLoading(true);
    try {
      const result = await ProductService.applyImageToProduct(imageUrl, productType);
      if (result.success && result.previewUrl) {
        setPreviewUrl(result.previewUrl);
      } else {
        setErrors(result.errors || ['Failed to generate preview']);
      }
    } catch (error) {
      setErrors(['Failed to generate preview']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomizationChange = async (key: string, value: string) => {
    const newCustomizations = { ...customizations, [key]: value };
    setCustomizations(newCustomizations);

    if (selectedProductType) {
      setIsLoading(true);
      try {
        const result = await ProductService.applyImageToProduct(
          imageUrl,
          selectedProductType,
          newCustomizations
        );
        if (result.success && result.previewUrl) {
          setPreviewUrl(result.previewUrl);
        }
      } catch (error) {
        console.error('Error updating preview:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCreateProduct = async () => {
    if (!selectedProductType) return;

    setIsLoading(true);
    setErrors([]);

    try {
      const response = await fetch('/api/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId,
          storeId,
          productType: selectedProductType,
          customizations
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors([data.error || 'Failed to create product']);
        return;
      }

      onProductCreated?.(data.product);
    } catch (error) {
      setErrors(['Failed to create product']);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${
                index < steps.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800">
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {currentStep === 0 && (
          <ProductTypeSelection
            templates={productTemplates}
            selectedType={selectedProductType}
            onSelect={handleProductTypeSelect}
            isLoading={isLoading}
          />
        )}

        {currentStep === 1 && selectedProductType && (
          <ProductCustomization
            productType={selectedProductType}
            customizations={customizations}
            onChange={handleCustomizationChange}
            previewUrl={previewUrl}
            isLoading={isLoading}
          />
        )}

        {currentStep === 2 && selectedProductType && (
          <ProductPreview
            productType={selectedProductType}
            customizations={customizations}
            previewUrl={previewUrl}
            onConfirm={handleCreateProduct}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <div>
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
          )}
          <button
            onClick={onCancel}
            className="ml-4 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>

        <div>
          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              disabled={!selectedProductType}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateProduct}
              disabled={isLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Product'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductTypeSelectionProps {
  templates: any[];
  selectedType: ProductType | null;
  onSelect: (type: ProductType) => void;
  isLoading: boolean;
}

function ProductTypeSelection({
  templates,
  selectedType,
  onSelect,
  isLoading
}: ProductTypeSelectionProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Choose a Product Type</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.type}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedType === template.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !isLoading && onSelect(template.type)}
          >
            <div className="aspect-square bg-gray-100 rounded-md mb-3 flex items-center justify-center">
              <span className="text-gray-500 text-sm">{template.name}</span>
            </div>
            <h4 className="font-medium">{template.name}</h4>
            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
            <p className="text-sm font-medium text-green-600">
              ${(template.basePrice / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              {template.dimensions.width}" × {template.dimensions.height}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProductCustomizationProps {
  productType: ProductType;
  customizations: any;
  onChange: (key: string, value: string) => void;
  previewUrl: string | null;
  isLoading: boolean;
}

function ProductCustomization({
  productType,
  customizations,
  onChange,
  previewUrl,
  isLoading
}: ProductCustomizationProps) {
  const options = ProductService.getCustomizationOptions(productType);
  const template = getProductTemplate(productType);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Customize Your {template.name}</h3>
        
        {options.sizes && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Size
            </label>
            <select
              value={customizations.size || ''}
              onChange={(e) => onChange('size', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select size</option>
              {options.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {options.colors && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <select
              value={customizations.color || ''}
              onChange={(e) => onChange('color', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select color</option>
              {options.colors.map((color) => (
                <option key={color} value={color}>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {options.placements && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placement
            </label>
            <select
              value={customizations.placement || 'center'}
              onChange={(e) => onChange('placement', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {options.placements.map((placement) => (
                <option key={placement} value={placement}>
                  {placement.charAt(0).toUpperCase() + placement.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Preview</h3>
        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
          {isLoading ? (
            <div className="text-gray-500">Generating preview...</div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Product preview"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-gray-500">No preview available</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductPreviewProps {
  productType: ProductType;
  customizations: any;
  previewUrl: string | null;
  onConfirm: () => void;
  isLoading: boolean;
}

function ProductPreview({
  productType,
  customizations,
  previewUrl,
  onConfirm,
  isLoading
}: ProductPreviewProps) {
  const template = getProductTemplate(productType);
  const price = ProductService.calculateProductPrice(productType, customizations);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Final Preview</h3>
        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Final product preview"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-gray-500">No preview available</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Product Details</h3>
        <div className="space-y-3">
          <div>
            <span className="font-medium">Product:</span> {template.name}
          </div>
          <div>
            <span className="font-medium">Dimensions:</span>{' '}
            {template.dimensions.width}" × {template.dimensions.height}"
          </div>
          {customizations.size && (
            <div>
              <span className="font-medium">Size:</span> {customizations.size}
            </div>
          )}
          {customizations.color && (
            <div>
              <span className="font-medium">Color:</span>{' '}
              {customizations.color.charAt(0).toUpperCase() + customizations.color.slice(1)}
            </div>
          )}
          {customizations.placement && (
            <div>
              <span className="font-medium">Placement:</span>{' '}
              {customizations.placement.charAt(0).toUpperCase() + customizations.placement.slice(1)}
            </div>
          )}
          <div className="pt-3 border-t">
            <span className="font-medium text-lg">Price: ${(price / 100).toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full mt-6 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Product...' : 'Confirm & Create Product'}
        </button>
      </div>
    </div>
  );
}