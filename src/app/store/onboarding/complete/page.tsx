'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function StoreOnboardingComplete() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // Get store ID from URL params or session storage
        const storeId = searchParams.get('store_id') || localStorage.getItem('onboarding_store_id');
        
        if (!storeId) {
          setStatus('error');
          setMessage('Store ID not found. Please try the onboarding process again.');
          return;
        }

        // Check if onboarding is complete
        const response = await fetch(`/api/stripe/connect/store?storeId=${storeId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check onboarding status');
        }

        if (data.onboardingComplete) {
          setStatus('success');
          setMessage('Your payment account has been successfully set up! You can now receive payments from your store sales.');
          
          // Clean up session storage
          localStorage.removeItem('onboarding_store_id');
          
          // Redirect to store dashboard after 3 seconds
          setTimeout(() => {
            router.push(`/store/${storeId}`);
          }, 3000);
        } else {
          setStatus('error');
          setMessage('Onboarding is not yet complete. Please finish the setup process or contact support if you need help.');
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        setStatus('error');
        setMessage('Failed to verify your account setup. Please try again or contact support.');
      }
    };

    checkOnboardingStatus();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Verifying Your Account
              </h1>
              <p className="text-gray-600">
                Please wait while we confirm your payment account setup...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="rounded-full bg-green-100 p-3 mx-auto mb-4 w-12 h-12 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Account Setup Complete!
              </h1>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">
                Redirecting to your store dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="rounded-full bg-red-100 p-3 mx-auto mb-4 w-12 h-12 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Setup Incomplete
              </h1>
              <p className="text-gray-600 mb-4">{message}</p>
              <button
                onClick={() => router.back()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Go Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}