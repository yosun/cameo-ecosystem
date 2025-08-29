import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';
import { moderateContent } from '@/lib/content-moderation';
import { DEFAULT_CONTENT_POLICY } from '@/lib/content-safety';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const creatorId = formData.get('creator_id') as string;
    const mode = formData.get('mode') as string;
    const prompt = formData.get('prompt') as string;
    const loraUrl = formData.get('lora_url') as string;
    const sceneImage = formData.get('scene_image') as File;
    const sceneUrl = formData.get('scene_url') as string;

    if (!creatorId || !loraUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify creator exists and LoRA is ready
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
    });

    if (!creator || creator.status !== 'READY') {
      return NextResponse.json(
        { error: 'Creator LoRA not ready' },
        { status: 400 }
      );
    }

    let finalSceneUrl = sceneUrl;

    // Upload scene image to S3 if provided
    if (sceneImage) {
      try {
        const buffer = Buffer.from(await sceneImage.arrayBuffer());
        const key = `scenes/${Date.now()}-${sceneImage.name}`;
        finalSceneUrl = await uploadToS3(buffer, key, sceneImage.type);
      } catch (error) {
        console.error('S3 upload error:', error);
        return NextResponse.json(
          { error: 'Failed to upload scene image' },
          { status: 500 }
        );
      }
    }

    if (!finalSceneUrl) {
      return NextResponse.json(
        { error: 'Scene image or URL required' },
        { status: 400 }
      );
    }

    // Create temporary generation ID for content moderation
    const tempGenerationId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Content safety validation for both prompt and image
    const moderationResult = await moderateContent({
      contentId: tempGenerationId,
      contentType: 'image',
      content: { 
        text: prompt,
        imageUrl: finalSceneUrl 
      },
      userId: session.user.id,
      creatorId: creatorId,
      policy: DEFAULT_CONTENT_POLICY
    });

    if (!moderationResult.approved) {
      return NextResponse.json(
        { 
          error: 'Content violates platform guidelines',
          violations: moderationResult.violations,
          requiresReview: moderationResult.requiresManualReview
        },
        { status: 400 }
      );
    }

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        creator_id: creatorId,
        user_id: session.user.id,
        mode: 'PHOTO',
        prompt: prompt || `${creator.trigger_word} in the scene`,
        scene_url: finalSceneUrl,
        status: 'PENDING',
      },
    });

    // Submit to Replicate
    try {
      const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: process.env.REPLICATE_FLUX_KONTEXT_VERSION || 'black-forest-labs/flux-kontext-dev-lora',
          input: {
            prompt: prompt || `${creator.trigger_word} in the scene`,
            image: finalSceneUrl,
            lora_weights: loraUrl,
            num_outputs: 1,
            aspect_ratio: '1:1',
            output_format: 'jpg',
            output_quality: 90,
          },
          webhook: `${process.env.NEXTAUTH_URL}/api/webhooks/replicate`,
          webhook_events_filter: ['completed'],
        }),
      });

      if (!replicateResponse.ok) {
        throw new Error(`Replicate API error: ${replicateResponse.status}`);
      }

      const replicateData = await replicateResponse.json();

      // Update generation with Replicate job ID
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'PROCESSING',
          replicate_prediction_id: replicateData.id,
        },
      });

      return NextResponse.json({
        generation_id: generation.id,
        status: 'processing',
        replicate_id: replicateData.id,
      });

    } catch (error) {
      console.error('Replicate API error:', error);
      
      // Update generation status to failed
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: 'FAILED' },
      });

      return NextResponse.json(
        { error: 'Failed to submit generation job' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Infer API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}