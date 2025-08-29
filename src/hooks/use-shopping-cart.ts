import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '@/components/checkout/shopping-cart';

const CART_STORAGE_KEY = 'cameo-shopping-cart';

interface CartState {
  [productId: string]: number; // productId -> quantity
}

interface UseShoppingCartResult {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  checkout: () => Promise<void>;
}

export function useShoppingCart(): UseShoppingCartResult {
  const [cartState, setCartState] = useState<CartState>({});
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        setCartState(parsed);
      } catch (err) {
        console.error('Failed to parse saved cart:', err);
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  }, [cartState]);

  // Fetch product details when cart state changes
  useEffect(() => {
    const fetchCartItems = async () => {
      const productIds = Object.keys(cartState);
      if (productIds.length === 0) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch product details for all items in cart
        const promises = productIds.map(async (productId) => {
          const response = await fetch(`/api/product/${productId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch product ${productId}`);
          }
          return response.json();
        });

        const products = await Promise.all(promises);
        
        const cartItems: CartItem[] = products.map((product) => ({
          productId: product.id,
          quantity: cartState[product.id],
          product,
        }));

        setItems(cartItems);
      } catch (err) {
        console.error('Failed to fetch cart items:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cart items');
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, [cartState]);

  const addItem = useCallback(async (productId: string, quantity: number = 1) => {
    setError(null);
    
    try {
      // Verify product exists and is available
      const response = await fetch(`/api/product/${productId}`);
      if (!response.ok) {
        throw new Error('Product not found or unavailable');
      }

      const product = await response.json();
      if (product.status !== 'ACTIVE') {
        throw new Error('Product is not available for purchase');
      }

      setCartState(prev => ({
        ...prev,
        [productId]: (prev[productId] || 0) + quantity,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item to cart');
      throw err;
    }
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setCartState(prev => ({
      ...prev,
      [productId]: Math.min(10, quantity), // Max 10 items per product
    }));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCartState(prev => {
      const newState = { ...prev };
      delete newState[productId];
      return newState;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartState({});
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const checkout = useCallback(async () => {
    if (items.length === 0) {
      throw new Error('Cart is empty');
    }

    setLoading(true);
    setError(null);

    try {
      const checkoutItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: checkoutItems,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proceed to checkout');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [items]);

  return {
    items,
    loading,
    error,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    checkout,
  };
}