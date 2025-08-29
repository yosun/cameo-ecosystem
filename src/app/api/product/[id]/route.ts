import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProductStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        store: true,
        generation: true,
        creator: true
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
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
    const { status, price_cents } = body;

    // Get the product and verify permissions
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        store: true,
        creator: true
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this product
    if (product.store.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this product' },
        { status: 403 }
      );
    }

    const updateData: any = {};

    // Validate and update status
    if (status !== undefined) {
      if (!Object.values(ProductStatus).includes(status)) {
        return NextResponse.json(
          { error: 'Invalid product status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    // Validate and update price
    if (price_cents !== undefined) {
      if (typeof price_cents !== 'number' || price_cents < 0) {
        return NextResponse.json(
          { error: 'Invalid price' },
          { status: 400 }
        );
      }

      // Check against creator's minimum price
      if (price_cents < product.creator.min_price_cents) {
        return NextResponse.json(
          { error: `Price too low. Minimum price: $${product.creator.min_price_cents / 100}` },
          { status: 400 }
        );
      }

      updateData.price_cents = price_cents;
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      include: {
        store: true,
        generation: true,
        creator: true
      }
    });

    return NextResponse.json({ product: updatedProduct });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
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

    // Get the product and verify permissions
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        store: true
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete this product
    if (product.store.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this product' },
        { status: 403 }
      );
    }

    // Check if product has any orders
    const orderCount = await prisma.orderItem.count({
      where: { product_id: params.id }
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with existing orders' },
        { status: 400 }
      );
    }

    // Delete the product
    await prisma.product.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}