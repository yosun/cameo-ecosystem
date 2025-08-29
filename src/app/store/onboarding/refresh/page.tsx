'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function StoreOnboardingRefresh() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const refreshOnboarding = async () => {
      try {
        // Get store ID from URL params or session storage
        const storeId = searchParams.get('store_id') || localStorage.getItem('onboarding_store_id');
        
        if (!storeId) {
          router.push('/stores');
          return;
        }

        // Create a new onboarding link
        const response = await fetch('/api/stripe/connect/store', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ storeId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to refresh onboarding');
        }

        // Redirect to the new onboarding URL
        window.location.href = data.onboardingUrl;
      } catch (error) {
        console.error('Failed to refresh onboarding:', error);
        // Redirect back to stores page on error
        router.push('/stores');
      }
    };

    refreshOnboarding();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Refreshing Setup
          </h1>
          <p className="text-gray-600">
            Please wait while we prepare your account setup...
          </p>
        </div>
      </div>
    </div>
  );
}