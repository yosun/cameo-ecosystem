import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { moderateContent, ModerationRequest } from '@/lib/content-moderation';
import { DEFAULT_CONTENT_POLICY } from '@/lib/content-safety';

/**
 * POST /api/content/moderate
 * Moderate content for safety and apply watermarks
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
    const {
      contentId,
      contentType,
      content,
      creatorId,
      consent,
      policy = DEFAULT_CONTENT_POLICY
    } = body;

    // Validate required fields
    if (!contentId || !contentType || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: contentId, contentType, content' },
        { status: 400 }
      );
    }

    // Create moderation request
    const moderationRequest: ModerationRequest = {
      contentId,
      contentType,
      content,
      userId: session.user.id,
      creatorId,
      consent,
      policy
    };

    // Process content moderation
    const result = await moderateContent(moderationRequest);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Content moderation API error:', error);
    return NextResponse.json(
      { error: 'Content moderation failed' },
      { status: 500 }
    );
  }
}