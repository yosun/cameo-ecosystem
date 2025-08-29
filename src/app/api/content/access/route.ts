import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getContentForUser } from '@/lib/content-moderation';

/**
 * GET /api/content/access?generationId=xxx
 * Get content with appropriate access level for user
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

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    if (!generationId) {
      return NextResponse.json(
        { error: 'generationId parameter is required' },
        { status: 400 }
      );
    }

    // Get content with appropriate access level
    const contentAccess = await getContentForUser(generationId, session.user.id);

    return NextResponse.json({
      success: true,
      ...contentAccess
    });

  } catch (error) {
    console.error('Content access API error:', error);
    return NextResponse.json(
      { error: 'Failed to get content access' },
      { status: 500 }
    );
  }
}