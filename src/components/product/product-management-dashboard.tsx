'use client';

import { useState, useEffect } from 'react';
import { ProductType } from '@prisma/client';
import { getProductTemplate } from '@/lib/product-templates';

interface Product {
  id: string;
  productType: ProductType;
  priceCents: number;
  status: string;
  previewUrl?: string;
  template: {
    name: string;
    dimensions: any;
  };
  store: {
    id: string;
    name: string;
  };
  creator: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface ProductManagementDashboardProps {
  storeId?: string;
  creatorId?: string;
}

export default function ProductManagementDashboard({
  storeId,
  creatorId
}: ProductManagementDashboardProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    productType?: ProductType;
    status?: string;
  }>({});

  useEffect(() => {
    fetchProducts();
  }, [storeId, creatorId, filter]);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (storeId) params.append('storeId', storeId);
      if (creatorId) params.append('creatorId', creatorId);
      if (filter.productType) params.append('productType', filter.productType);

      const response = await fetch(`/api/product?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch products');
      }

      setProducts(data.products);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/product/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update product status');
      }

      // Refresh products
      fetchProducts();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update product');
    }
  };

  const filteredProducts = products.filter(product => {
    if (filter.status && product.status !== filter.status) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <div className="text-red-800">{error}</div>
        <button
          onClick={fetchProducts}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
        <div className="text-sm text-gray-500">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Type
          </label>
          <select
            value={filter.productType || ''}
            onChange={(e) => setFilter(prev => ({
              ...prev,
              productType: e.target.value as ProductType || undefined
            }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {Object.values(ProductType).map(type => (
              <option key={type} value={type}>
                {getProductTemplate(type).name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter(prev => ({
              ...prev,
              status: e.target.value || undefined
            }))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setFilter({})}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No products found</div>
          <p className="text-sm text-gray-400">
            {products.length === 0
              ? 'Create your first product from a generated image'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onStatusChange: (productId: string, status: string) => void;
}

function ProductCard({ product, onStatusChange }: ProductCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await onStatusChange(product.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'OUT_OF_STOCK':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Product Preview */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {product.previewUrl ? (
          <img
            src={product.previewUrl}
            alt={`${product.template.name} preview`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-gray-500 text-sm">No preview</div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-gray-900">{product.template.name}</h3>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
              product.status
            )}`}
          >
            {product.status.toLowerCase().replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-1 text-sm text-gray-600 mb-3">
          <div>Price: ${(product.priceCents / 100).toFixed(2)}</div>
          <div>Store: {product.store.name}</div>
          <div>Creator: {product.creator.name}</div>
          <div>
            Created: {new Date(product.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <select
            value={product.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isUpdating}
            className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1 disabled:opacity-50"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <button
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
            onClick={() => {
              // Navigate to product edit page
              window.location.href = `/product/${product.id}/edit`;
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}