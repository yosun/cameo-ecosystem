import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const availableForProducts = searchParams.get('available_for_products') === 'true';

    // For available_for_products, we don't require userId match since we need to show
    // generations from creators that allow third-party stores
    if (!availableForProducts && (!userId || userId !== session.user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    let whereClause: any = {};

    if (availableForProducts) {
      // Show generations that can be used for products:
      // 1. User's own generations
      // 2. Generations from creators that allow third-party stores
      whereClause = {
        OR: [
          { user_id: session.user.id },
          {
            creator: {
              allow_third_party_stores: true
            }
          }
        ],
        status: 'COMPLETED', // Only completed generations
        image_url: { not: null } // Only generations with images
      };
    } else {
      whereClause = {
        user_id: userId || session.user.id,
      };
    }

    const generations = await prisma.generation.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            trigger_word: true,
            royalty_bps: true,
            min_price_cents: true,
            allow_third_party_stores: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: availableForProducts ? 50 : 20, // More results for product selection
    });

    return NextResponse.json({
      generations: generations.map(gen => ({
        id: gen.id,
        mode: gen.mode.toLowerCase(),
        prompt: gen.prompt,
        scene_url: gen.scene_url,
        image_url: gen.image_url,
        status: gen.status.toLowerCase(),
        createdAt: gen.createdAt.toISOString(),
        creator: {
          id: gen.creator.id,
          name: gen.creator.name,
          trigger_word: gen.creator.trigger_word,
          royalty_bps: gen.creator.royalty_bps,
          min_price_cents: gen.creator.min_price_cents,
          allow_third_party_stores: gen.creator.allow_third_party_stores,
        },
      })),
    });

  } catch (error) {
    console.error('Generations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}