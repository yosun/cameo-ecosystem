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

    const creatorId = params.id;

    // Verify the creator exists and belongs to the user
    const creator = await prisma.creator.findFirst({
      where: {
        id: creatorId,
        email: session.user.email!,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Parse query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Get royalty summary
    const summary = await royaltyService.getCreatorRoyaltySummary(
      creatorId,
      startDate,
      endDate
    );

    // Format the response
    const formatPrice = (cents: number) => cents / 100;

    return NextResponse.json({
      summary: {
        totalEarned: formatPrice(summary.totalEarned),
        totalPaid: formatPrice(summary.totalPaid),
        totalPending: formatPrice(summary.totalPending),
      },
      royalties: summary.royalties.map(royalty => ({
        id: royalty.id,
        orderId: royalty.order_id,
        amount: formatPrice(royalty.amount_cents),
        status: royalty.status,
        createdAt: royalty.createdAt,
        order: {
          id: royalty.order.id,
          totalAmount: formatPrice(royalty.order.total_cents),
          items: royalty.order.items.map(item => ({
            productType: item.product.product_type,
            quantity: item.quantity,
            price: formatPrice(item.price_cents),
          })),
        },
      })),
      transfers: summary.transfers.map(transfer => ({
        id: transfer.id,
        stripeTransferId: transfer.stripe_transfer_id,
        amount: formatPrice(transfer.amount_cents),
        status: transfer.status,
        createdAt: transfer.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to get creator royalties:', error);
    return NextResponse.json(
      { error: 'Failed to get royalty information' },
      { status: 500 }
    );
  }
}