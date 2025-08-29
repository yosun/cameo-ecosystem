import { NextRequest, NextResponse } from 'next/server';
import { WebhookMonitor, WebhookRetryManager } from '@/lib/webhook-infrastructure';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const source = searchParams.get('source') as 'stripe' | 'fal' | 'replicate' | undefined;
    
    switch (action) {
      case 'stats':
        const timeRange = getTimeRange(searchParams);
        const stats = await WebhookMonitor.getWebhookStats(source, timeRange);
        return NextResponse.json(stats);

      case 'failures':
        const limit = parseInt(searchParams.get('limit') || '50');
        const failures = await WebhookMonitor.getRecentFailures(limit);
        return NextResponse.json(failures);

      case 'dead-letter':
        const deadLetterQueue = await WebhookMonitor.getDeadLetterQueue();
        return NextResponse.json(deadLetterQueue);

      case 'retryable':
        const retryableWebhooks = await WebhookRetryManager.getRetryableWebhooks();
        return NextResponse.json(retryableWebhooks);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, webhookId } = await request.json();

    switch (action) {
      case 'retry':
        if (!webhookId) {
          return NextResponse.json({ error: 'Missing webhookId' }, { status: 400 });
        }
        await WebhookRetryManager.retryWebhook(webhookId);
        return NextResponse.json({ success: true });

      case 'retry-all':
        const retryableWebhooks = await WebhookRetryManager.getRetryableWebhooks();
        for (const webhook of retryableWebhooks) {
          await WebhookRetryManager.retryWebhook(webhook.id);
        }
        return NextResponse.json({ 
          success: true, 
          retriedCount: retryableWebhooks.length 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook management API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function isAdmin(user: any): boolean {
  // Implement your admin check logic here
  // For now, check if user email is in admin list
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(user.email);
}

function getTimeRange(searchParams: URLSearchParams) {
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  
  if (startParam && endParam) {
    return {
      start: new Date(startParam),
      end: new Date(endParam),
    };
  }
  
  // Default to last 24 hours
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  
  return { start, end };
}