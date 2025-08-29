'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProductManagementDashboard from '@/components/product/product-management-dashboard';
import ProductCuration from '@/components/store/product-curation';

interface Store {
  id: string;
  name: string;
  description: string | null;
  owner: {
    id: string;
    name: string;
  };
  _count: {
    products: number;
  };
  createdAt: string;
}

export default function StorePage() {
  const params = useParams();
  const { data: session } = useSession();
  const [store, setStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'add-products'>('products');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchStore();
    }
  }, [params.id]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/store/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch store');
      }

      setStore(data.store);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch store');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading store...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Store not found</div>
      </div>
    );
  }

  const isOwner = session?.user?.id === store.owner.id;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Store Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
              {store.description && (
                <p className="mt-2 text-gray-600">{store.description}</p>
              )}
              <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                <div>Owner: {store.owner.name}</div>
                <div>{store._count.products} products</div>
                <div>Created: {new Date(store.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            
            {isOwner && (
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    // Navigate to store settings
                    window.location.href = `/store/${store.id}/settings`;
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    // Navigate to add product from generations
                    window.location.href = `/dashboard?tab=generations`;
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Products
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Store Management Tabs */}
        {isOwner ? (
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'products'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Manage Products
                </button>
                <button
                  onClick={() => setActiveTab('add-products')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'add-products'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Add Products
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'products' && (
                <ProductManagementDashboard storeId={store.id} />
              )}
              {activeTab === 'add-products' && (
                <ProductCuration 
                  storeId={store.id} 
                  onProductAdded={() => setActiveTab('products')}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Store Products</h2>
            {/* Public product view - would show products available for purchase */}
            <div className="text-gray-500 text-center py-8">
              Public store view coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}