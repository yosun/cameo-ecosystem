import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProductType } from '@prisma/client';
import { ProductService } from '@/lib/product-service';
import { getProductTemplate } from '@/lib/product-templates';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      generationId,
      storeId,
      productType,
      customizations,
      priceCents
    } = body;

    // Validate required fields
    if (!generationId || !storeId || !productType) {
      return NextResponse.json(
        { error: 'Missing required fields: generationId, storeId, productType' },
        { status: 400 }
      );
    }

    // Validate product type
    if (!Object.values(ProductType).includes(productType)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      );
    }

    // Get the generation and verify it exists and has an image
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { creator: true }
    });

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    if (!generation.image_url) {
      return NextResponse.json(
        { error: 'Generation does not have an image' },
        { status: 400 }
      );
    }

    // Verify the store exists and user has permission
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    if (store.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized to add products to this store' },
        { status: 403 }
      );
    }

    // Validate product specifications
    const validation = ProductService.validateProductSpecs(
      generation.image_url,
      productType,
      customizations
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Product validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Calculate price if not provided
    let finalPrice = priceCents;
    if (!finalPrice) {
      finalPrice = ProductService.calculateProductPrice(productType, customizations);
    }

    // Validate price against creator licensing
    const template = getProductTemplate(productType);
    if (finalPrice < generation.creator.min_price_cents) {
      return NextResponse.json(
        { error: `Price too low. Minimum price: $${generation.creator.min_price_cents / 100}` },
        { status: 400 }
      );
    }

    // Generate product preview
    const previewResult = await ProductService.applyImageToProduct(
      generation.image_url,
      productType,
      customizations
    );

    if (!previewResult.success) {
      return NextResponse.json(
        { error: 'Failed to generate product preview', details: previewResult.errors },
        { status: 400 }
      );
    }

    // Create the product
    const product = await prisma.product.create({
      data: {
        store_id: storeId,
        generation_id: generationId,
        creator_id: generation.creator_id,
        product_type: productType,
        price_cents: finalPrice,
        status: 'ACTIVE'
      },
      include: {
        store: true,
        generation: true,
        creator: true
      }
    });

    return NextResponse.json({
      product: {
        id: product.id,
        productType: product.product_type,
        priceCents: product.price_cents,
        status: product.status,
        previewUrl: previewResult.previewUrl,
        template: {
          name: template.name,
          dimensions: template.dimensions
        },
        customizations,
        store: {
          id: product.store.id,
          name: product.store.name
        },
        creator: {
          id: product.creator.id,
          name: product.creator.name
        }
      }
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const productType = searchParams.get('productType');
    const creatorId = searchParams.get('creatorId');

    const where: any = {};
    
    if (storeId) where.store_id = storeId;
    if (productType) where.product_type = productType;
    if (creatorId) where.creator_id = creatorId;

    const products = await prisma.product.findMany({
      where,
      include: {
        store: true,
        generation: true,
        creator: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const productsWithPreviews = await Promise.all(
      products.map(async (product) => {
        const template = getProductTemplate(product.product_type);
        let previewUrl = null;

        if (product.generation.image_url) {
          const previewResult = await ProductService.generateProductPreview({
            imageUrl: product.generation.image_url,
            productType: product.product_type
          });
          previewUrl = previewResult;
        }

        return {
          id: product.id,
          productType: product.product_type,
          priceCents: product.price_cents,
          status: product.status,
          previewUrl,
          template: {
            name: template.name,
            dimensions: template.dimensions
          },
          store: {
            id: product.store.id,
            name: product.store.name
          },
          creator: {
            id: product.creator.id,
            name: product.creator.name
          },
          createdAt: product.createdAt
        };
      })
    );

    return NextResponse.json({ products: productsWithPreviews });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}