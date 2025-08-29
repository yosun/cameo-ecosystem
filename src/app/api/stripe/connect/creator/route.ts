import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripeConnect } from '@/lib/stripe-connect';
import { z } from 'zod';

const createAccountSchema = z.object({
  creatorId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { creatorId } = createAccountSchema.parse(body);

    // Verify the creator exists and belongs to the user
    const creator = await prisma.creator.findFirst({
      where: {
        id: creatorId,
        email: session.user.email!,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Check if account already exists
    if (creator.stripe_account_id) {
      // Create onboarding link for existing account
      const onboardingUrl = await stripeConnect.createOnboardingLink(
        creator.stripe_account_id,
        'creator'
      );
      
      return NextResponse.json({ 
        accountId: creator.stripe_account_id,
        onboardingUrl,
        existing: true,
      });
    }

    // Create new Stripe Connect account
    const accountId = await stripeConnect.createCreatorAccount(creator);
    const onboardingUrl = await stripeConnect.createOnboardingLink(accountId, 'creator');

    return NextResponse.json({
      accountId,
      onboardingUrl,
      existing: false,
    });
  } catch (error) {
    console.error('Stripe Connect creator account creation failed:', error);
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
    const creatorId = searchParams.get('creatorId');

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator ID required' }, { status: 400 });
    }

    // Verify the creator exists and belongs to the user
    const creator = await prisma.creator.findFirst({
      where: {
        id: creatorId,
        email: session.user.email!,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    if (!creator.stripe_account_id) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
      });
    }

    // Get account status from Stripe
    const accountStatus = await stripeConnect.getAccountStatus(creator.stripe_account_id);
    const onboardingComplete = await stripeConnect.isOnboardingComplete(creator.stripe_account_id);

    // Update local status
    await stripeConnect.updateCreatorOnboardingStatus(creator.id);

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete,
      accountStatus,
    });
  } catch (error) {
    console.error('Failed to get creator account status:', error);
    return NextResponse.json(
      { error: 'Failed to get account status' },
      { status: 500 }
    );
  }
}