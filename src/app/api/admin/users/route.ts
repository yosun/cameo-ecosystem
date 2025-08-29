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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const users = await prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            generations: true,
            orders: true,
            stores: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Add status field (would be stored in database in real implementation)
    const usersWithStatus = users.map(user => ({
      ...user,
      status: 'active' as const // TODO: Implement actual user status tracking
    }));

    return NextResponse.json(usersWithStatus);
  } catch (error) {
    await errorTrackingService.logError('error', 'Failed to fetch users', {
      error: error instanceof Error ? error : new Error(String(error)),
      endpoint: '/api/admin/users'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}