import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { errorTrackingService } from '@/lib/error-tracking';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creatorId = params.id;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

    // Verify creator exists and user has access
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId }
    });

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // TODO: Add proper authorization check (creator owns this profile or is admin)

    // Get analytics data
    const [
      generations,
      sales,
      revenue,
      royalties,
      topProducts,
      revenueByStore,
      generationTrends
    ] = await Promise.all([
      // Total generations
      prisma.generation.count({
        where: {
          creator_id: creatorId,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Total sales
      prisma.orderItem.count({
        where: {
          product: {
            creator_id: creatorId
          },
          order: {
            status: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }),

      // Total revenue
      prisma.orderItem.aggregate({
        where: {
          product: {
            creator_id: creatorId
          },
          order: {
            status: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          price_cents: true
        }
      }),

      // Royalties earned
      prisma.royalty.aggregate({
        where: {
          creator_id: creatorId,
          status: 'PAID',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount_cents: true
        }
      }),

      // Top products by sales
      prisma.orderItem.groupBy({
        by: ['product_id'],
        where: {
          product: {
            creator_id: creatorId
          },
          order: {
            status: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _count: {
          product_id: true
        },
        _sum: {
          price_cents: true
        },
        orderBy: {
          _count: {
            product_id: 'desc'
          }
        },
        take: 5
      }),

      // Revenue by store
      prisma.orderItem.groupBy({
        by: ['product_id'],
        where: {
          product: {
            creator_id: creatorId
          },
          order: {
            status: 'PAID',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          price_cents: true
        }
      }),

      // Generation trends (daily)
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', g."createdAt") as date,
          COUNT(g.id) as generations,
          COALESCE(s.sales, 0) as sales
        FROM "Generation" g
        LEFT JOIN (
          SELECT 
            DATE_TRUNC('day', o."createdAt") as date,
            COUNT(oi.id) as sales
          FROM "OrderItem" oi
          JOIN "Order" o ON oi.order_id = o.id
          JOIN "Product" p ON oi.product_id = p.id
          WHERE p.creator_id = ${creatorId}
            AND o.status = 'PAID'
            AND o."createdAt" >= ${startDate}
            AND o."createdAt" <= ${endDate}
          GROUP BY DATE_TRUNC('day', o."createdAt")
        ) s ON DATE_TRUNC('day', g."createdAt") = s.date
        WHERE g.creator_id = ${creatorId}
          AND g.status = 'COMPLETED'
          AND g."createdAt" >= ${startDate}
          AND g."createdAt" <= ${endDate}
        GROUP BY DATE_TRUNC('day', g."createdAt")
        ORDER BY date
      `
    ]);

    // Get product details for top products
    const productIds = topProducts.map(p => p.product_id);
    const productDetails = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        product_type: true
      }
    });

    // Get store details for revenue by store
    const storeRevenue = await prisma.product.findMany({
      where: {
        creator_id: creatorId,
        orders: {
          some: {
            order: {
              status: 'PAID',
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          }
        }
      },
      include: {
        store: {
          select: {
            name: true
          }
        },
        orders: {
          where: {
            order: {
              status: 'PAID',
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          },
          select: {
            price_cents: true
          }
        }
      }
    });

    const totalRevenue = revenue._sum.price_cents || 0;
    const royaltiesEarned = royalties._sum.amount_cents || 0;
    const conversionRate = generations > 0 ? (sales / generations) * 100 : 0;

    const analytics = {
      totalGenerations: generations,
      totalSales: sales,
      totalRevenue: totalRevenue / 100, // Convert to dollars
      royaltiesEarned: royaltiesEarned / 100, // Convert to dollars
      conversionRate,
      topProducts: topProducts.map(tp => {
        const product = productDetails.find(p => p.id === tp.product_id);
        return {
          id: tp.product_id,
          type: product?.product_type || 'unknown',
          sales: tp._count.product_id,
          revenue: (tp._sum.price_cents || 0) / 100
        };
      }),
      revenueByStore: storeRevenue.reduce((acc, product) => {
        const storeName = product.store.name;
        const storeRevenue = product.orders.reduce((sum, order) => sum + order.price_cents, 0) / 100;
        
        const existing = acc.find(s => s.storeName === storeName);
        if (existing) {
          existing.revenue += storeRevenue;
        } else {
          acc.push({ storeName, revenue: storeRevenue });
        }
        return acc;
      }, [] as Array<{ storeName: string; revenue: number }>),
      generationTrends: (generationTrends as Array<{ date: Date; generations: number; sales: number }>).map(trend => ({
        date: trend.date.toISOString().split('T')[0],
        generations: Number(trend.generations),
        sales: Number(trend.sales)
      }))
    };

    return NextResponse.json(analytics);
  } catch (error) {
    await errorTrackingService.logError('error', 'Failed to fetch creator analytics', {
      error: error instanceof Error ? error : new Error(String(error)),
      endpoint: `/api/creator/${params.id}/analytics`,
      creatorId: params.id
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}