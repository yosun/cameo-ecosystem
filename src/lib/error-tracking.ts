import { prisma } from './prisma';

export interface ErrorLog {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  creatorId?: string;
  storeId?: string;
  endpoint?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  errorRate: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
}

export class ErrorTrackingService {
  /**
   * Log an error with context
   */
  async logError(
    level: 'error' | 'warning' | 'info',
    message: string,
    context?: {
      error?: Error;
      userId?: string;
      creatorId?: string;
      storeId?: string;
      endpoint?: string;
      userAgent?: string;
      ip?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // In production, you might want to use a service like Sentry
      // For now, we'll log to database and console
      
      console.error(`[${level.toUpperCase()}] ${message}`, {
        context,
        timestamp: new Date().toISOString()
      });

      // Store in database for analytics
      await prisma.errorLog.create({
        data: {
          level,
          message,
          stack: context?.error?.stack,
          context: context?.metadata ? JSON.stringify(context.metadata) : null,
          userId: context?.userId,
          creatorId: context?.creatorId,
          storeId: context?.storeId,
          endpoint: context?.endpoint,
          userAgent: context?.userAgent,
          ip: context?.ip
        }
      });
    } catch (dbError) {
      // Fallback to console if database logging fails
      console.error('Failed to log error to database:', dbError);
      console.error('Original error:', { level, message, context });
    }
  }

  /**
   * Get error metrics for monitoring dashboard
   */
  async getErrorMetrics(startDate?: Date, endDate?: Date): Promise<ErrorMetrics> {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const [
      totalErrors,
      errorsByLevel,
      errorsByEndpoint,
      topErrors,
      totalRequests
    ] = await Promise.all([
      // Total error count
      prisma.errorLog.count({
        where: dateFilter
      }),

      // Errors by level
      prisma.errorLog.groupBy({
        by: ['level'],
        where: dateFilter,
        _count: {
          level: true
        }
      }),

      // Errors by endpoint
      prisma.errorLog.groupBy({
        by: ['endpoint'],
        where: {
          ...dateFilter,
          endpoint: {
            not: null
          }
        },
        _count: {
          endpoint: true
        },
        orderBy: {
          _count: {
            endpoint: 'desc'
          }
        },
        take: 10
      }),

      // Top error messages
      prisma.errorLog.groupBy({
        by: ['message'],
        where: dateFilter,
        _count: {
          message: true
        },
        _max: {
          createdAt: true
        },
        orderBy: {
          _count: {
            message: 'desc'
          }
        },
        take: 10
      }),

      // Estimate total requests (using generation count as proxy)
      prisma.generation.count({
        where: {
          createdAt: dateFilter.createdAt
        }
      })
    ]);

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      totalErrors,
      errorsByLevel: errorsByLevel.reduce((acc, item) => {
        acc[item.level] = item._count.level;
        return acc;
      }, {} as Record<string, number>),
      errorsByEndpoint: errorsByEndpoint.reduce((acc, item) => {
        if (item.endpoint) {
          acc[item.endpoint] = item._count.endpoint;
        }
        return acc;
      }, {} as Record<string, number>),
      errorRate,
      topErrors: topErrors.map(item => ({
        message: item.message,
        count: item._count.message,
        lastOccurred: item._max.createdAt!
      }))
    };
  }

  /**
   * Get recent errors for admin dashboard
   */
  async getRecentErrors(limit: number = 50): Promise<ErrorLog[]> {
    const errors = await prisma.errorLog.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return errors.map(error => ({
      id: error.id,
      level: error.level as 'error' | 'warning' | 'info',
      message: error.message,
      stack: error.stack || undefined,
      context: error.context ? JSON.parse(error.context) : undefined,
      userId: error.userId || undefined,
      creatorId: error.creatorId || undefined,
      storeId: error.storeId || undefined,
      endpoint: error.endpoint || undefined,
      userAgent: error.userAgent || undefined,
      ip: error.ip || undefined,
      createdAt: error.createdAt
    }));
  }

  /**
   * Clear old error logs (for maintenance)
   */
  async clearOldErrors(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.errorLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) return {};
    
    const filter: any = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;
    
    return { createdAt: filter };
  }
}

// Middleware for automatic error logging
export function withErrorTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: {
    endpoint?: string;
    userId?: string;
    creatorId?: string;
    storeId?: string;
  }
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      await errorTrackingService.logError('error', error instanceof Error ? error.message : 'Unknown error', {
        error: error instanceof Error ? error : new Error(String(error)),
        ...context
      });
      throw error;
    }
  };
}

export const errorTrackingService = new ErrorTrackingService();