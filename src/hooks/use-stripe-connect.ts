import { useState, useCallback } from 'react';

interface StripeConnectAccount {
  hasAccount: boolean;
  onboardingComplete: boolean;
  accountStatus?: {
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements: {
      currently_due: string[];
      eventually_due: string[];
      past_due: string[];
      pending_verification: string[];
    };
  };
}

interface UseStripeConnectResult {
  account: StripeConnectAccount | null;
  loading: boolean;
  error: string | null;
  createAccount: (id: string, type: 'creator' | 'store') => Promise<void>;
  checkAccountStatus: (id: string, type: 'creator' | 'store') => Promise<void>;
  startOnboarding: (id: string, type: 'creator' | 'store') => Promise<void>;
}

export function useStripeConnect(): UseStripeConnectResult {
  const [account, setAccount] = useState<StripeConnectAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = useCallback(async (id: string, type: 'creator' | 'store') => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'creator' ? '/api/stripe/connect/creator' : '/api/stripe/connect/store';
      const body = type === 'creator' ? { creatorId: id } : { storeId: id };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Store ID for onboarding completion tracking
      localStorage.setItem(`onboarding_${type}_id`, id);

      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAccountStatus = useCallback(async (id: string, type: 'creator' | 'store') => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'creator' ? '/api/stripe/connect/creator' : '/api/stripe/connect/store';
      const param = type === 'creator' ? 'creatorId' : 'storeId';

      const response = await fetch(`${endpoint}?${param}=${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check account status');
      }

      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check account status');
    } finally {
      setLoading(false);
    }
  }, []);

  const startOnboarding = useCallback(async (id: string, type: 'creator' | 'store') => {
    // Check if account exists first
    await checkAccountStatus(id, type);
    
    // If no account exists, create one
    if (!account?.hasAccount) {
      await createAccount(id, type);
    } else {
      // If account exists but onboarding is incomplete, restart onboarding
      if (!account.onboardingComplete) {
        await createAccount(id, type);
      }
    }
  }, [account, createAccount, checkAccountStatus]);

  return {
    account,
    loading,
    error,
    createAccount,
    checkAccountStatus,
    startOnboarding,
  };
}