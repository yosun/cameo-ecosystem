'use client';

import { useState, useEffect } from 'react';
import { ProductType } from '@prisma/client';

interface Generation {
  id: string;
  image_url: string;
  prompt: string;
  mode: string;
  creator: {
    id: string;
    name: string;
    royalty_bps: number;
    min_price_cents: number;
  };
}

interface ProductCurationProps {
  storeId: string;
  onProductAdded?: () => void;
}

export default function ProductCuration({ storeId, onProductAdded }: ProductCurationProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [productType, setProductType] = useState<ProductType>('POSTCARD');
  const [price, setPrice] = useState<number>(500); // $5.00 default
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableGenerations();
  }, []);

  const fetchAvailableGenerations = async () => {
    try {
      const response = await fetch('/api/generations?available_for_products=true');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch generations');
      }

      setGenerations(data.generations || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch generations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerationSelect = (generation: Generation) => {
    setSelectedGeneration(generation);
    // Set minimum price based on creator's requirements
    setPrice(Math.max(generation.creator.min_price_cents, 500));
    setError(null);
    setSuccess(null);
  };

  const handleAddProduct = async () => {
    if (!selectedGeneration) return;

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/store/${storeId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generation_id: selectedGeneration.id,
          creator_id: selectedGeneration.creator.id,
          product_type: productType,
          price_cents: price
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add product');
      }

      setSuccess('Product added to store successfully');
      setSelectedGeneration(null);
      onProductAdded?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add product');
    } finally {
      setIsAdding(false);
    }
  };

  const calculateRoyalty = () => {
    if (!selectedGeneration) return 0;
    return Math.floor(price * selectedGeneration.creator.royalty_bps / 10000);
  };

  const calculateStoreRevenue = () => {
    if (!selectedGeneration) return 0;
    const platformFee = Math.floor(price * 0.1); // 10% platform fee
    const royalty = calculateRoyalty();
    return price - platformFee - royalty;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500">Loading available generations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Add Products to Store</h3>
        <p className="text-sm text-gray-600">
          Select from your generations or those you have permission to use
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800">{success}</div>
        </div>
      )}

      {generations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-500 mb-2">No generations available</div>
          <p className="text-sm text-gray-400">
            Create some generations first or ensure you have permission to use creator LoRAs
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generation Selection */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Select Generation</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {generations.map((generation) => (
                <div
                  key={generation.id}
                  onClick={() => handleGenerationSelect(generation)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedGeneration?.id === generation.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex space-x-3">
                    {generation.image_url && (
                      <img
                        src={generation.image_url}
                        alt="Generation"
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {generation.prompt || 'No prompt'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Creator: {generation.creator.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Mode: {generation.mode}
                      </div>
                      <div className="text-xs text-gray-500">
                        Min Price: ${(generation.creator.min_price_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Configuration */}
          {selectedGeneration && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Product Configuration</h4>
              <div className="space-y-4">
                {/* Product Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Type
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProductType)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="POSTCARD">Postcard</option>
                    <option value="SHIRT">T-Shirt</option>
                    <option value="STICKER">Sticker</option>
                    <option value="LEGGINGS">Leggings</option>
                    <option value="FIGURINE">Figurine</option>
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price: ${(price / 100).toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={selectedGeneration.creator.min_price_cents}
                    max="10000"
                    step="100"
                    value={price}
                    onChange={(e) => setPrice(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>${(selectedGeneration.creator.min_price_cents / 100).toFixed(2)}</span>
                    <span>$100.00</span>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Revenue Breakdown</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Sale Price:</span>
                      <span>${(price / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Creator Royalty ({(selectedGeneration.creator.royalty_bps / 100).toFixed(1)}%):</span>
                      <span>-${(calculateRoyalty() / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform Fee (10%):</span>
                      <span>-${(price * 0.1 / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-gray-300 pt-1">
                      <span>Your Revenue:</span>
                      <span>${(calculateStoreRevenue() / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleAddProduct}
                  disabled={isAdding}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdding ? 'Adding Product...' : 'Add to Store'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}