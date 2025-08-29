import { stripe, STRIPE_CONNECT_CONFIG, type StripeConnectAccount } from './stripe';
import { prisma } from './prisma';
import type { Creator, Store } from '@prisma/client';

export class StripeConnectService {
  /**
   * Create a Stripe Connect account for a creator
   */
  async createCreatorAccount(creator: Creator): Promise<string> {
    try {
      const account = await stripe.accounts.create({
        type: STRIPE_CONNECT_CONFIG.ACCOUNT_TYPE,
        country: 'US', // TODO: Make this configurable based on creator location
        email: creator.email,
        business_type: STRIPE_CONNECT_CONFIG.BUSINESS_TYPE,
        capabilities: STRIPE_CONNECT_CONFIG.CAPABILITIES,
        metadata: {
          creator_id: creator.id,
          type: 'creator',
        },
      });

      // Update creator with Stripe account ID
      await prisma.creator.update({
        where: { id: creator.id },
        data: { stripe_account_id: account.id },
      });

      return account.id;
    } catch (error) {
      console.error('Failed to create Stripe Connect account for creator:', error);
      throw new Error('Failed to create payment account');
    }
  }

  /**
   * Create a Stripe Connect account for a store owner
   */
  async createStoreAccount(store: Store, ownerEmail: string): Promise<string> {
    try {
      const account = await stripe.accounts.create({
        type: STRIPE_CONNECT_CONFIG.ACCOUNT_TYPE,
        country: 'US', // TODO: Make this configurable based on store location
        email: ownerEmail,
        business_type: STRIPE_CONNECT_CONFIG.BUSINESS_TYPE,
        capabilities: STRIPE_CONNECT_CONFIG.CAPABILITIES,
        metadata: {
          store_id: store.id,
          type: 'store',
        },
      });

      // Update store with Stripe account ID
      await prisma.store.update({
        where: { id: store.id },
        data: { stripe_account_id: account.id },
      });

      return account.id;
    } catch (error) {
      console.error('Failed to create Stripe Connect account for store:', error);
      throw new Error('Failed to create payment account');
    }
  }

  /**
   * Create an onboarding link for a Stripe Connect account
   */
  async createOnboardingLink(accountId: string, type: 'creator' | 'store'): Promise<string> {
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/${type}/onboarding/refresh`,
        return_url: `${baseUrl}/${type}/onboarding/complete`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      console.error('Failed to create onboarding link:', error);
      throw new Error('Failed to create onboarding link');
    }
  }

  /**
   * Get account status and requirements
   */
  async getAccountStatus(accountId: string): Promise<StripeConnectAccount> {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      
      return {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          past_due: account.requirements?.past_due || [],
          pending_verification: account.requirements?.pending_verification || [],
        },
      };
    } catch (error) {
      console.error('Failed to get account status:', error);
      throw new Error('Failed to get account status');
    }
  }

  /**
   * Check if account onboarding is complete
   */
  async isOnboardingComplete(accountId: string): Promise<boolean> {
    try {
      const account = await this.getAccountStatus(accountId);
      return account.charges_enabled && account.payouts_enabled && account.details_submitted;
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      return false;
    }
  }

  /**
   * Update creator onboarding status
   */
  async updateCreatorOnboardingStatus(creatorId: string): Promise<boolean> {
    try {
      const creator = await prisma.creator.findUnique({
        where: { id: creatorId },
      });

      if (!creator?.stripe_account_id) {
        return false;
      }

      const isComplete = await this.isOnboardingComplete(creator.stripe_account_id);
      
      await prisma.creator.update({
        where: { id: creatorId },
        data: { stripe_onboarding_complete: isComplete },
      });

      return isComplete;
    } catch (error) {
      console.error('Failed to update creator onboarding status:', error);
      return false;
    }
  }

  /**
   * Create a login link for existing Connect accounts
   */
  async createLoginLink(accountId: string): Promise<string> {
    try {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return loginLink.url;
    } catch (error) {
      console.error('Failed to create login link:', error);
      throw new Error('Failed to create login link');
    }
  }
}

export const stripeConnect = new StripeConnectService();