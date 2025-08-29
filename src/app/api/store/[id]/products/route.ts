import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { StoreService, ProductListingData } from '@/lib/store-service';
import { ProductType } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const product_type = searchParams.get('product_type') as ProductType | null;
    const status = searchParams.get('status');

    const result = await StoreService.getStoreProducts(params.id, {
      page,
      limit,
      product_type: product_type || undefined,
      status: status || undefined
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching store products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store products' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { generation_id, creator_id, product_type, price_cents } = body;

    if (!generation_id || !creator_id || !product_type || !price_cents) {
      return NextResponse.json(
        { error: 'Missing required fields: generation_id, creator_id, product_type, price_cents' },
        { status: 400 }
      );
    }

    if (price_cents < 100) {
      return NextResponse.json(
        { error: 'Price must be at least $1.00' },
        { status: 400 }
      );
    }

    const productData: ProductListingData = {
      generation_id,
      creator_id,
      product_type,
      price_cents
    };

    const product = await StoreService.addProductToStore(
      params.id,
      session.user.id,
      productData
    );

    return NextResponse.json({ product });

  } catch (error) {
    console.error('Error adding product to store:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add product to store' },
      { status: 500 }
    );
  }
}