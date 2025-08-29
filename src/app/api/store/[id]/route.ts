import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StoreService, UpdateStoreData } from '@/lib/store-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const store = await StoreService.getStoreById(params.id);

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ store });

  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (name !== undefined && (!name || name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Store name is required' },
        { status: 400 }
      );
    }

    const updateData: UpdateStoreData = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || undefined;
    if (logo_url !== undefined) updateData.logo_url = logo_url?.trim() || undefined;
    if (banner_url !== undefined) updateData.banner_url = banner_url?.trim() || undefined;
    if (theme_color !== undefined) updateData.theme_color = theme_color;
    if (custom_domain !== undefined) updateData.custom_domain = custom_domain?.trim() || undefined;
    if (is_public !== undefined) updateData.is_public = is_public;
    if (allow_reviews !== undefined) updateData.allow_reviews = allow_reviews;
    if (auto_approve_products !== undefined) updateData.auto_approve_products = auto_approve_products;

    const updatedStore = await StoreService.updateStore(params.id, session.user.id, updateData);

    return NextResponse.json({ store: updatedStore });

  } catch (error) {
    console.error('Error updating store:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update store' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await StoreService.deleteStore(params.id, session.user.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting store:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete store' },
      { status: 500 }
    );
  }
}