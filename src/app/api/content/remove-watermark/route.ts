import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processPaymentContentAccess } from '@/lib/content-moderation';

/**
 * POST /api/content/remove-watermark
 * Remove watermarks after successful payment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Process watermark removal for paid order
    const result = await processPaymentContentAccess(orderId, session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to remove watermarks' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      cleanUrls: result.cleanUrls,
      message: 'Watermarks removed successfully'
    });

  } catch (error) {
    console.error('Watermark removal API error:', error);
    return NextResponse.json(
      { error: 'Watermark removal failed' },
      { status: 500 }
    );
  }
}