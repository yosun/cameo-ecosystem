import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StoreService, CreateStoreData } from '@/lib/store-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      logo_url,
      banner_url,
      theme_color,
      custom_domain,
      is_public,
      allow_reviews,
      auto_approve_products
    } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Store name is required' },
        { status: 400 }
      );
    }

    const storeData: CreateStoreData = {
      name: name.trim(),
      description: description?.trim() || undefined,
      logo_url: logo_url?.trim() || undefined,
      banner_url: banner_url?.trim() || undefined,
      theme_color: theme_color || undefined,
      custom_domain: custom_domain?.trim() || undefined,
      is_public: is_public ?? true,
      allow_reviews: allow_reviews ?? true,
      auto_approve_products: auto_approve_products ?? false
    };

    const store = await StoreService.createStore(session.user.id, storeData);

    return NextResponse.json({ store });

  } catch (error) {
    console.error('Error creating store:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');
    const isPublic = searchParams.get('public') === 'true';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (isPublic) {
      // Public store browsing - no authentication required
      const result = await StoreService.getPublicStores({
        page,
        limit,
        search: search || undefined
      });
      return NextResponse.json(result);
    }

    // Private store access - authentication required
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetOwnerId = ownerId || session.user.id;
    const stores = await StoreService.getStoresByOwner(targetOwnerId);

    return NextResponse.json({ stores });

  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}