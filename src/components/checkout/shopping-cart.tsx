'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface CartItem {
  productId: string;
  quantity: number;
  product: {
    id: string;
    product_type: string;
    price_cents: number;
    creator: {
      name: string;
    };
    generation: {
      image_url: string | null;
    };
  };
}

interface ShoppingCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  loading?: boolean;
}

export function ShoppingCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  loading = false,
}: ShoppingCartProps) {
  const router = useRouter();
  
  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.price_cents * item.quantity,
    0
  );

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.2M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Your cart is empty</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start shopping to add items to your cart.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/stores')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Browse Stores
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Shopping Cart</h2>
        <p className="text-sm text-gray-500">{items.length} item(s)</p>
      </div>

      <div className="divide-y divide-gray-200">
        {items.map((item) => (
          <div key={item.productId} className="p-6">
            <div className="flex items-center space-x-4">
              {/* Product Image */}
              <div className="flex-shrink-0 w-16 h-16">
                {item.product.generation.image_url ? (
                  <img
                    src={item.product.generation.image_url}
                    alt={`${item.product.product_type} by ${item.product.creator.name}`}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900">
                  {item.product.product_type.charAt(0).toUpperCase() + 
                   item.product.product_type.slice(1).toLowerCase()}
                </h3>
                <p className="text-sm text-gray-500">by {item.product.creator.name}</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatPrice(item.product.price_cents)}
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onUpdateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                  className="p-1 rounded-md hover:bg-gray-100"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.productId, Math.min(10, item.quantity + 1))}
                  className="p-1 rounded-md hover:bg-gray-100"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              {/* Remove Button */}
              <button
                onClick={() => onRemoveItem(item.productId)}
                className="p-1 text-red-600 hover:text-red-800"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Item Total */}
            <div className="mt-2 text-right">
              <span className="text-sm font-medium text-gray-900">
                Subtotal: {formatPrice(item.product.price_cents * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <span className="text-base font-medium text-gray-900">Total</span>
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(totalAmount)}
          </span>
        </div>

        <button
          onClick={onCheckout}
          disabled={loading || items.length === 0}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Proceed to Checkout'}
        </button>

        <p className="mt-2 text-xs text-gray-500 text-center">
          Secure checkout powered by Stripe
        </p>
      </div>
    </div>
  );
}