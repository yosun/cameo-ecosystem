import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { errorTrackingService } from '@/lib/error-tracking';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // TODO: Add proper admin role check
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [
      totalUsers,
      activeUsers,
      totalCreators,
      activeCreators,
      pendingModerations,
      errorMetrics,
      performanceMetrics
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users (users with activity in last 30 days)
      prisma.user.count({
        where: {
          OR: [
            {
              generations: {
                some: {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            },
            {
              orders: {
                some: {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              }
            }
          ]
        }
      }),

      // Total creators
      prisma.creator.count(),

      // Active creators (with LoRA ready)
      prisma.creator.count({
        where: {
          status: 'READY'
        }
      }),

      // Pending moderations (mock for now - would need actual moderation queue)
      0, // TODO: Implement actual moderation queue count

      // Recent error metrics
      errorTrackingService.getErrorMetrics(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date()
      ),

      // Performance metrics
      prisma.generation.aggregate({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        _count: true
      })
    ]);

    // Determine system health based on error rate and failure rate
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (errorMetrics.errorRate > 10 || errorMetrics.totalErrors > 100) {
      systemHealth = 'critical';
    } else if (errorMetrics.errorRate > 5 || errorMetrics.totalErrors > 50) {
      systemHealth = 'warning';
    }

    const stats = {
      totalUsers,
      activeUsers,
      totalCreators,
      activeCreators,
      pendingModerations,
      systemHealth
    };

    return NextResponse.json(stats);
  } catch (error) {
    await errorTrackingService.logError('error', 'Failed to fetch admin stats', {
      error: error instanceof Error ? error : new Error(String(error)),
      endpoint: '/api/admin/stats'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}