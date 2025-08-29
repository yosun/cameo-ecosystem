import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { royaltyService } from '@/lib/royalty-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = params.id;

    // Verify the store exists and belongs to the user
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        owner_id: session.user.id,
      },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Parse query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Get revenue summary
    const summary = await royaltyService.getStoreRevenueSummary(
      storeId,
      startDate,
      endDate
    );

    // Get additional store metrics
    const [totalProducts, totalOrders] = await Promise.all([
      prisma.product.count({
        where: { store_id: storeId, status: 'ACTIVE' },
      }),
      prisma.order.count({
        where: {
          items: {
            some: {
              product: {
                store_id: storeId,
              },
            },
          },
          status: 'PAID',
        },
      }),
    ]);

    // Format the response
    const formatPrice = (cents: number) => cents / 100;

    return NextResponse.json({
      summary: {
        totalRevenue: formatPrice(summary.totalRevenue),
        totalPaid: formatPrice(summary.totalPaid),
        totalPending: formatPrice(summary.totalPending),
      },
      metrics: {
        totalProducts,
        totalOrders,
      },
      transfers: summary.transfers.map(transfer => ({
        id: transfer.id,
        stripeTransferId: transfer.stripe_transfer_id,
        amount: formatPrice(transfer.amount_cents),
        status: transfer.status,
        createdAt: transfer.createdAt,
        order: {
          id: transfer.order.id,
          totalAmount: formatPrice(transfer.order.total_cents),
          items: transfer.order.items.map(item => ({
            productType: item.product.product_type,
            quantity: item.quantity,
            price: formatPrice(item.price_cents),
            creator: item.product.creator.name,
          })),
        },
      })),
    });
  } catch (error) {
    console.error('Failed to get store revenue:', error);
    return NextResponse.json(
      { error: 'Failed to get revenue information' },
      { status: 500 }
    );
  }
}