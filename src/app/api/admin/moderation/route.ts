import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getModerationQueue, processManualReview } from '@/lib/content-moderation';

/**
 * GET /api/admin/moderation
 * Get content moderation queue for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check
    // if (!session.user.isAdmin) {
    //   return NextResponse.json(
    //     { error: 'Admin access required' },
    //     { status: 403 }
    //   );
    // }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const moderationQueue = await getModerationQueue(limit, offset);

    return NextResponse.json({
      success: true,
      ...moderationQueue
    });

  } catch (error) {
    console.error('Moderation queue API error:', error);
    return NextResponse.json(
      { error: 'Failed to get moderation queue' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation
 * Process manual review decision
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

    // TODO: Add admin role check
    // if (!session.user.isAdmin) {
    //   return NextResponse.json(
    //     { error: 'Admin access required' },
    //     { status: 403 }
    //   );
    // }

    const body = await request.json();
    const { contentId, approved, reason } = body;

    if (!contentId || typeof approved !== 'boolean' || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: contentId, approved, reason' },
        { status: 400 }
      );
    }

    const decision = {
      contentId,
      approved,
      reason,
      reviewerId: session.user.id
    };

    const result = await processManualReview(decision);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to process manual review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Manual review processed successfully'
    });

  } catch (error) {
    console.error('Manual review API error:', error);
    return NextResponse.json(
      { error: 'Manual review processing failed' },
      { status: 500 }
    );
  }
}