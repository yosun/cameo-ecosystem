import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkoutService, type CheckoutItem } from '@/lib/checkout';
import { z } from 'zod';

const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1).max(10),
  })).min(1).max(20),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items, successUrl, cancelUrl } = checkoutSchema.parse(body);

    // Default URLs if not provided
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const defaultSuccessUrl = successUrl || `${baseUrl}/checkout/success`;
    const defaultCancelUrl = cancelUrl || `${baseUrl}/checkout/cancel`;

    // Create checkout session
    const checkoutSession = await checkoutService.createCheckoutSession(
      items as CheckoutItem[],
      session.user.id,
      defaultSuccessUrl,
      defaultCancelUrl
    );

    return NextResponse.json({
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
      orderId: checkoutSession.orderId,
    });
  } catch (error) {
    console.error('Checkout creation failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}