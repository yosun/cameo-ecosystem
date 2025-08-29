import { NextRequest, NextResponse } from 'next/server';
import { WebhookRetryProcessor } from '@/lib/webhook-retry-processor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Manual webhook retry processing triggered by admin');
    
    const result = await WebhookRetryProcessor.processRetryableWebhooks();
    
    return NextResponse.json({
      success: true,
      message: 'Webhook retry processing completed',
      ...result,
    });
  } catch (error) {
    console.error('Manual webhook retry processing failed:', error);
    return NextResponse.json(
      { 
        error: 'Webhook retry processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function isAdmin(user: any): boolean {
  // Implement your admin check logic here
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(user.email);
}