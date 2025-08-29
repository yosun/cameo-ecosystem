import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripeConnect } from '@/lib/stripe-connect';
import { z } from 'zod';

const createAccountSchema = z.object({
  storeId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storeId } = createAccountSchema.parse(body);

    // Verify the store exists and belongs to the user
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        owner_id: session.user.id,
      },
      include: {
        owner: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Check if account already exists
    if (store.stripe_account_id) {
      // Create onboarding link for existing account
      const onboardingUrl = await stripeConnect.createOnboardingLink(
        store.stripe_account_id,
        'store'
      );
      
      return NextResponse.json({ 
        accountId: store.stripe_account_id,
        onboardingUrl,
        existing: true,
      });
    }

    // Create new Stripe Connect account
    const accountId = await stripeConnect.createStoreAccount(store, store.owner.email);
    const onboardingUrl = await stripeConnect.createOnboardingLink(accountId, 'store');

    return NextResponse.json({
      accountId,
      onboardingUrl,
      existing: false,
    });
  } catch (error) {
    console.error('Stripe Connect store account creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create payment account' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    // Verify the store exists and belongs to the user
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        owner_id: session.user.id,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!store.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
      });
    }

    // Get account status from Stripe
    const accountStatus = await stripeConnect.getAccountStatus(store.stripe_account_id);
    const onboardingComplete = await stripeConnect.isOnboardingComplete(store.stripe_account_id);

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete,
      accountStatus,
    });
  } catch (error) {
    console.error('Failed to get store account status:', error);
    return NextResponse.json(
      { error: 'Failed to get account status' },
      { status: 500 }
    );
  }
}