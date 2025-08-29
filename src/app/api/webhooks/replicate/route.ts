import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';
import { applyWatermark } from '@/lib/watermark-service';
import { 
  WebhookValidator, 
  processWebhookWithRetry 
} from '@/lib/webhook-infrastructure';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('replicate-signature');
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET;
    
    // Validate webhook signature if configured
    if (webhookSecret && signature) {
      const validation = WebhookValidator.validateReplicateSignature(
        body,
        signature,
        webhookSecret
      );
      
      if (!validation.isValid) {
        console.error('Replicate webhook signature validation failed:', validation.error);
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);
    const { id, status, output, error } = payload;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing prediction ID' },
        { status: 400 }
      );
    }

    // Process webhook with retry infrastructure
    await processWebhookWithRetry(
      'REPLICATE',
      'prediction_update',
      payload,
      async () => {
        // Find generation by replicate prediction ID
        const generation = await prisma.generation.findFirst({
          where: {
            replicate_prediction_id: id,
            status: 'PROCESSING',
          },
        });

        if (!generation) {
          console.log(`No matching generation found for Replicate ID: ${id}`);
          return; // Not an error - might be a duplicate webhook
        }

        if (status === 'succeeded' && output && output.length > 0) {
          // Download and store the generated image
          const imageUrl = output[0]; // Replicate returns array of URLs
          const imageResponse = await fetch(imageUrl);
          
          if (!imageResponse.ok) {
            throw new Error('Failed to download generated image');
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const key = `generations/${generation.id}-${Date.now()}.jpg`;
          
          // Upload to S3
          const s3Url = await uploadToS3(imageBuffer, key, 'image/jpeg');
          
          // Apply watermark
          const watermarkedUrl = await applyWatermark(s3Url, generation.id);

          // Update generation with completed status and image URL
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              image_url: watermarkedUrl,
            },
          });

          console.log(`Generation ${generation.id} completed successfully`);

        } else if (status === 'failed') {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
            },
          });

          console.log(`Generation ${generation.id} failed: ${error}`);
        }
      },
      signature
    );

    return NextResponse.json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('Replicate webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

