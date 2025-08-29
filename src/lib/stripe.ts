import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe Connect configuration
export const STRIPE_CONNECT_CONFIG = {
  // Platform application fee (in basis points, e.g., 250 = 2.5%)
  PLATFORM_FEE_BPS: 250,
  
  // Minimum transfer amount (in cents)
  MIN_TRANSFER_AMOUNT: 50, // $0.50
  
  // Connect account types
  ACCOUNT_TYPE: 'express' as const,
  
  // Required capabilities for Connect accounts
  CAPABILITIES: {
    transfers: { requested: true },
    card_payments: { requested: true },
  },
  
  // Business type for individual creators
  BUSINESS_TYPE: 'individual' as const,
} as const;

export type StripeConnectAccount = {
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