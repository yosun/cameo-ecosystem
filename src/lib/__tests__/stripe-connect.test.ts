import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Stripe
const mockStripe = {
  accounts: {
    create: jest.fn(),
    retrieve: jest.fn(),
    createLoginLink: jest.fn(),
  },
  accountLinks: {
    create: jest.fn(),
  },
  transfers: {
    create: jest.fn(),
  },
};

// Mock Prisma
const mockPrisma = {
  creator: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  store: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../stripe', () => ({
  stripe: mockStripe,
  STRIPE_CONNECT_CONFIG: {
    ACCOUNT_TYPE: 'express',
    BUSINESS_TYPE: 'individual',
    CAPABILITIES: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    PLATFORM_FEE_BPS: 250,
    MIN_TRANSFER_AMOUNT: 50,
  },
}));

jest.mock('../prisma', () => ({
  prisma: mockPrisma,
}));

import { StripeConnectService } from '../stripe-connect';

describe('StripeConnectService', () => {
  let service: StripeConnectService;

  beforeEach(() => {
    service = new StripeConnectService();
    jest.clearAllMocks();
  });

  describe('createCreatorAccount', () => {
    it('should create a Stripe Connect account for a creator', async () => {
      const mockCreator = {
        id: 'creator-1',
        email: 'creator@example.com',
        name: 'Test Creator',
      };

      const mockAccount = {
        id: 'acct_test123',
      };

      mockStripe.accounts.create.mockResolvedValue(mockAccount);
      mockPrisma.creator.update.mockResolvedValue({});

      const result = await service.createCreatorAccount(mockCreator as any);

      expect(mockStripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        country: 'US',
        email: 'creator@example.com',
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: {
          creator_id: 'creator-1',
          type: 'creator',
        },
      });

      expect(mockPrisma.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
        data: { stripe_account_id: 'acct_test123' },
      });

      expect(result).toBe('acct_test123');
    });

    it('should handle account creation errors', async () => {
      const mockCreator = {
        id: 'creator-1',
        email: 'creator@example.com',
        name: 'Test Creator',
      };

      mockStripe.accounts.create.mockRejectedValue(new Error('Stripe error'));

      await expect(service.createCreatorAccount(mockCreator as any))
        .rejects.toThrow('Failed to create payment account');
    });
  });

  describe('createOnboardingLink', () => {
    it('should create an onboarding link', async () => {
      const mockLink = {
        url: 'https://connect.stripe.com/setup/test',
      };

      mockStripe.accountLinks.create.mockResolvedValue(mockLink);

      const result = await service.createOnboardingLink('acct_test123', 'creator');

      expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_test123',
        refresh_url: 'http://localhost:3000/creator/onboarding/refresh',
        return_url: 'http://localhost:3000/creator/onboarding/complete',
        type: 'account_onboarding',
      });

      expect(result).toBe('https://connect.stripe.com/setup/test');
    });
  });

  describe('getAccountStatus', () => {
    it('should retrieve account status from Stripe', async () => {
      const mockAccount = {
        id: 'acct_test123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
        },
      };

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const result = await service.getAccountStatus('acct_test123');

      expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith('acct_test123');
      expect(result).toEqual({
        id: 'acct_test123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
        },
      });
    });
  });

  describe('isOnboardingComplete', () => {
    it('should return true when onboarding is complete', async () => {
      const mockAccount = {
        id: 'acct_test123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
        },
      };

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const result = await service.isOnboardingComplete('acct_test123');

      expect(result).toBe(true);
    });

    it('should return false when onboarding is incomplete', async () => {
      const mockAccount = {
        id: 'acct_test123',
        charges_enabled: false,
        payouts_enabled: true,
        details_submitted: true,
        requirements: {
          currently_due: ['individual.verification.document'],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
        },
      };

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const result = await service.isOnboardingComplete('acct_test123');

      expect(result).toBe(false);
    });
  });
});