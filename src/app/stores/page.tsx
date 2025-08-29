'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainNavigation from '@/components/navigation/main-nav';

interface Store {
  id: string;
  name: string;
  description?: string;
  banner_url?: string;
  logo_url?: string;
  theme_color?: string;
  createdAt: string;
  owner: {
    name: string;
  };
  _count: {
    products: number;
  };
}

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, [searchTerm]);

  const fetchStores = async () => {
    try {
      const params = new URLSearchParams({
        public: 'true',
        page: '1',
        limit: '20'
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/store?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch stores');
      }

      setStores(data.stores || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch stores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStores();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading stores...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Browse Stores</h1>
          <p className="mt-2 text-gray-600">
            Discover unique merchandise from creators around the world
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="max-w-md">
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search stores..."
                className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Stores Grid */}
        {stores.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              {searchTerm ? 'No stores found matching your search' : 'No public stores available'}
            </div>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  fetchStores();
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div
                key={store.id}
                onClick={() => router.push(`/store/${store.id}`)}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Store Banner */}
                {store.banner_url && (
                  <div className="h-32 bg-gray-200 rounded-t-lg overflow-hidden">
                    <img
                      src={store.banner_url}
                      alt={`${store.name} banner`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-6">
                  {/* Store Header */}
                  <div className="flex items-start space-x-3 mb-4">
                    {store.logo_url && (
                      <img
                        src={store.logo_url}
                        alt={`${store.name} logo`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {store.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        by {store.owner.name}
                      </p>
                    </div>
                  </div>

                  {/* Store Description */}
                  {store.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {store.description}
                    </p>
                  )}

                  {/* Store Stats */}
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{store._count.products} products</span>
                    <span>Created {new Date(store.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Theme Color Indicator */}
                  {store.theme_color && (
                    <div className="mt-4 flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: store.theme_color }}
                      />
                      <span className="text-xs text-gray-500">Store theme</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Store CTA */}
        <div className="mt-12 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">
              Want to create your own store?
            </h2>
            <p className="text-blue-800 mb-4">
              Start selling merchandise created from AI-generated content
            </p>
            <button
              onClick={() => router.push('/store/new')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}