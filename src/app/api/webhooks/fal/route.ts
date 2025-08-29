import { NextRequest, NextResponse } from 'next/server';
import { processFALWebhook } from '@/lib/fal-service';
import { updateCreatorLoRAStatus } from '@/lib/creator-service';
import { prisma } from '@/lib/prisma';
import { 
  WebhookValidator, 
  processWebhookWithRetry 
} from '@/lib/webhook-infrastructure';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-fal-signature');
    const webhookSecret = process.env.FAL_WEBHOOK_SECRET;
    
    // Validate webhook signature if secret is configured
    if (webhookSecret && signature) {
      const validation = WebhookValidator.validateFALSignature(
        body,
        signature,
        webhookSecret
      );
      
      if (!validation.isValid) {
        console.error('FAL webhook signature validation failed:', validation.error);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);
    console.log('FAL webhook received:', payload);

    // Process webhook with retry infrastructure
    await processWebhookWithRetry(
      'FAL',
      payload.event_type || 'training_update',
      payload,
      async () => {
        // Process the webhook payload
        const webhookData = processFALWebhook(payload);
        
        if (!webhookData.jobId) {
          throw new Error('Missing job ID in webhook payload');
        }

        // Find the creator by FAL job ID
        const creator = await prisma.creator.findFirst({
          where: {
            fal_job_id: webhookData.jobId,
          },
        });

        if (!creator) {
          throw new Error(`Creator not found for FAL job ID: ${webhookData.jobId}`);
        }

        // Update creator based on webhook status
        if (webhookData.status === 'COMPLETED') {
          if (!webhookData.loraUrl) {
            await updateCreatorLoRAStatus(creator.id, 'FAILED');
            throw new Error('Completed webhook missing LoRA URL');
          }

          // Update creator with successful training results
          await updateCreatorLoRAStatus(
            creator.id,
            'READY',
            webhookData.loraUrl,
            webhookData.triggerWord
          );

          console.log(`LoRA training completed for creator ${creator.id}:`, {
            loraUrl: webhookData.loraUrl,
            triggerWord: webhookData.triggerWord,
          });

        } else if (webhookData.status === 'FAILED') {
          // Update creator with failed status
          await updateCreatorLoRAStatus(creator.id, 'FAILED');
          console.error(`LoRA training failed for creator ${creator.id}:`, webhookData.error);
        }
      },
      signature
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing FAL webhook:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification (if needed)
export async function GET(request: NextRequest) {
  // Some webhook providers require GET endpoint verification
  const challenge = request.nextUrl.searchParams.get('challenge');
  
  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({ 
    message: 'FAL webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}