import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { metricsService } from '@/lib/metrics-service';
import { errorTrackingService } from '@/lib/error-tracking';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // TODO: Add proper admin role check
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const type = searchParams.get('type') || 'business';

    switch (type) {
      case 'business':
        const businessMetrics = await metricsService.getBusinessMetrics(startDate, endDate);
        return NextResponse.json(businessMetrics);

      case 'creators':
        const creatorMetrics = await metricsService.getCreatorMetrics(startDate, endDate);
        return NextResponse.json(creatorMetrics);

      case 'stores':
        const storeMetrics = await metricsService.getStoreMetrics(startDate, endDate);
        return NextResponse.json(storeMetrics);

      case 'performance':
        const performanceMetrics = await metricsService.getPerformanceMetrics();
        return NextResponse.json(performanceMetrics);

      case 'errors':
        const errorMetrics = await errorTrackingService.getErrorMetrics(startDate, endDate);
        return NextResponse.json(errorMetrics);

      case 'timeseries':
        const metric = searchParams.get('metric') as 'generations' | 'sales' | 'revenue';
        const interval = searchParams.get('interval') as 'day' | 'week' | 'month' || 'day';
        
        if (!metric || !startDate || !endDate) {
          return NextResponse.json({ error: 'Missing required parameters for timeseries' }, { status: 400 });
        }

        const timeSeriesData = await metricsService.getTimeSeriesMetrics(metric, startDate, endDate, interval);
        return NextResponse.json(timeSeriesData);

      default:
        return NextResponse.json({ error: 'Invalid metrics type' }, { status: 400 });
    }
  } catch (error) {
    await errorTrackingService.logError('error', 'Failed to fetch metrics', {
      error: error instanceof Error ? error : new Error(String(error)),
      endpoint: '/api/admin/metrics'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}