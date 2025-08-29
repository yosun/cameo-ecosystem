import { prisma } from './prisma';

export interface BusinessMetrics {
  totalGenerations: number;
  totalSales: number;
  totalRevenue: number;
  activeCreators: number;
  activeStores: number;
  conversionRate: number;
  averageOrderValue: number;
}

export interface CreatorMetrics {
  id: string;
  name: string;
  totalGenerations: number;
  totalSales: number;
  totalRevenue: number;
  royaltiesEarned: number;
  conversionRate: number;
}

export interface StoreMetrics {
  id: string;
  name: string;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface TimeSeriesMetric {
  date: string;
  value: number;
}

export class MetricsService {
  /**
   * Get overall platform business metrics
   */
  async getBusinessMetrics(startDate?: Date, endDate?: Date): Promise<BusinessMetrics> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const [
      totalGenerations,
      totalSales,
      revenueData,
      activeCreators,
      activeStores,
      totalOrders
    ] = await Promise.all([
      // Total generations
      prisma.generation.count({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        }
      }),

      // Total sales (completed orders)
      prisma.order.count({
        where: {
          status: 'PAID',
          ...dateFilter
        }
      }),

      // Total revenue
      prisma.order.aggregate({
        where: {
          status: 'PAID',
          ...dateFilter
        },
        _sum: {
          total_cents: true
        }
      }),

      // Active creators (with at least one generation)
      prisma.creator.count({
        where: {
          generations: {
            some: {
              status: 'COMPLETED',
              ...dateFilter
            }
          }
        }
      }),

      // Active stores (with at least one product)
      prisma.store.count({
        where: {
          products: {
            some: {
              status: 'ACTIVE'
            }
          }
        }
      }),

      // Total orders for conversion calculation
      prisma.generation.count({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        }
      })
    ]);

    const totalRevenue = revenueData._sum.total_cents || 0;
    const conversionRate = totalOrders > 0 ? (totalSales / totalOrders) * 100 : 0;
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      totalGenerations,
      totalSales,
      totalRevenue: totalRevenue / 100, // Convert to dollars
      activeCreators,
      activeStores,
      conversionRate,
      averageOrderValue: averageOrderValue / 100 // Convert to dollars
    };
  }

  /**
   * Get metrics for all creators
   */
  async getCreatorMetrics(startDate?: Date, endDate?: Date): Promise<CreatorMetrics[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const creators = await prisma.creator.findMany({
      include: {
        generations: {
          where: {
            status: 'COMPLETED',
            ...dateFilter
          }
        },
        products: {
          include: {
            orders: {
              where: {
                order: {
                  status: 'PAID',
                  ...dateFilter
                }
              }
            }
          }
        },
        royalties: {
          where: {
            status: 'PAID',
            order: dateFilter
          }
        }
      }
    });

    return creators.map(creator => {
      const totalGenerations = creator.generations.length;
      const totalSales = creator.products.reduce(
        (sum, product) => sum + product.orders.length, 0
      );
      const totalRevenue = creator.products.reduce(
        (sum, product) => sum + product.orders.reduce(
          (orderSum, orderItem) => orderSum + orderItem.price_cents, 0
        ), 0
      );
      const royaltiesEarned = creator.royalties.reduce(
        (sum, royalty) => sum + royalty.amount_cents, 0
      );
      const conversionRate = totalGenerations > 0 ? (totalSales / totalGenerations) * 100 : 0;

      return {
        id: creator.id,
        name: creator.name,
        totalGenerations,
        totalSales,
        totalRevenue: totalRevenue / 100,
        royaltiesEarned: royaltiesEarned / 100,
        conversionRate
      };
    });
  }

  /**
   * Get metrics for all stores
   */
  async getStoreMetrics(startDate?: Date, endDate?: Date): Promise<StoreMetrics[]> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const stores = await prisma.store.findMany({
      include: {
        products: {
          include: {
            orders: {
              where: {
                order: {
                  status: 'PAID',
                  ...dateFilter
                }
              }
            }
          }
        }
      }
    });

    return stores.map(store => {
      const totalProducts = store.products.length;
      const totalSales = store.products.reduce(
        (sum, product) => sum + product.orders.length, 0
      );
      const totalRevenue = store.products.reduce(
        (sum, product) => sum + product.orders.reduce(
          (orderSum, orderItem) => orderSum + orderItem.price_cents, 0
        ), 0
      );
      const conversionRate = totalProducts > 0 ? (totalSales / totalProducts) * 100 : 0;

      return {
        id: store.id,
        name: store.name,
        totalProducts,
        totalSales,
        totalRevenue: totalRevenue / 100,
        conversionRate
      };
    });
  }

  /**
   * Get time series data for a specific metric
   */
  async getTimeSeriesMetrics(
    metric: 'generations' | 'sales' | 'revenue',
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesMetric[]> {
    const dateFormat = this.getDateFormat(interval);
    
    let query: any;
    
    switch (metric) {
      case 'generations':
        query = prisma.$queryRaw`
          SELECT 
            DATE_TRUNC(${interval}, "createdAt") as date,
            COUNT(*) as value
          FROM "Generation"
          WHERE "status" = 'COMPLETED'
            AND "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
          GROUP BY DATE_TRUNC(${interval}, "createdAt")
          ORDER BY date
        `;
        break;
        
      case 'sales':
        query = prisma.$queryRaw`
          SELECT 
            DATE_TRUNC(${interval}, "createdAt") as date,
            COUNT(*) as value
          FROM "Order"
          WHERE "status" = 'PAID'
            AND "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
          GROUP BY DATE_TRUNC(${interval}, "createdAt")
          ORDER BY date
        `;
        break;
        
      case 'revenue':
        query = prisma.$queryRaw`
          SELECT 
            DATE_TRUNC(${interval}, "createdAt") as date,
            SUM("total_cents") / 100.0 as value
          FROM "Order"
          WHERE "status" = 'PAID'
            AND "createdAt" >= ${startDate}
            AND "createdAt" <= ${endDate}
          GROUP BY DATE_TRUNC(${interval}, "createdAt")
          ORDER BY date
        `;
        break;
    }

    const results = await query as Array<{ date: Date; value: number }>;
    
    return results.map(row => ({
      date: row.date.toISOString().split('T')[0],
      value: Number(row.value)
    }));
  }

  /**
   * Get performance metrics for monitoring
   */
  async getPerformanceMetrics(): Promise<{
    avgGenerationTime: number;
    failureRate: number;
    activeJobs: number;
    queueLength: number;
  }> {
    const [
      completedGenerations,
      failedGenerations,
      activeJobs,
      pendingJobs
    ] = await Promise.all([
      prisma.generation.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          createdAt: true,
          updatedAt: true
        }
      }),

      prisma.generation.count({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      prisma.generation.count({
        where: {
          status: 'PROCESSING'
        }
      }),

      prisma.generation.count({
        where: {
          status: 'PENDING'
        }
      })
    ]);

    const avgGenerationTime = completedGenerations.length > 0
      ? completedGenerations.reduce((sum, gen) => {
          return sum + (gen.updatedAt.getTime() - gen.createdAt.getTime());
        }, 0) / completedGenerations.length / 1000 // Convert to seconds
      : 0;

    const totalJobs = completedGenerations.length + failedGenerations;
    const failureRate = totalJobs > 0 ? (failedGenerations / totalJobs) * 100 : 0;

    return {
      avgGenerationTime,
      failureRate,
      activeJobs,
      queueLength: pendingJobs
    };
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) return {};
    
    const filter: any = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;
    
    return { createdAt: filter };
  }

  private getDateFormat(interval: 'day' | 'week' | 'month'): string {
    switch (interval) {
      case 'day': return 'day';
      case 'week': return 'week';
      case 'month': return 'month';
      default: return 'day';
    }
  }
}

export const metricsService = new MetricsService();