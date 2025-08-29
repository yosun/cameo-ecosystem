import { NextRequest, NextResponse } from 'next/server';
import { createCreator, updateCreator, getAllCreators, getReadyCreators } from '@/lib/creator-service';
// Mock functions for development
const uploadTrainingImages = async (files: File[], creatorId: string) => {
  // Mock implementation - in production this would upload to S3
  return files.map((file, index) => ({
    url: `https://mock-s3.example.com/creators/${creatorId}/training/${index}-${file.name}`,
    key: `creators/${creatorId}/training/${index}-${file.name}`
  }));
};

const submitFALTrainingJob = async (creatorId: string, imageUrls: string[]) => {
  // Mock implementation - in production this would call FAL API
  console.log(`Mock: Starting LoRA training for creator ${creatorId} with ${imageUrls.length} images`);
  return `mock-fal-job-${creatorId}-${Date.now()}`;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ready = searchParams.get('ready') === 'true';

    // For now, return mock data since we don't have real creators yet
    const mockCreators = [
      {
        id: 'creator-1',
        name: 'Alex Chen',
        status: 'READY',
        lora_url: 'https://example.com/lora1.safetensors',
        trigger_word: 'alexchen_v1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'creator-2', 
        name: 'Sarah Johnson',
        status: 'READY',
        lora_url: 'https://example.com/lora2.safetensors',
        trigger_word: 'sarahj_v1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'creator-3',
        name: 'Mike Rodriguez',
        status: 'READY', 
        lora_url: 'https://example.com/lora3.safetensors',
        trigger_word: 'mikerod_v1',
        createdAt: new Date().toISOString(),
      }
    ];

    // If ready=true, return all mock creators (they're all ready)
    // Otherwise return all creators
    return NextResponse.json(mockCreators);
  } catch (error) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to fetch creators',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract form fields
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const consent_given = formData.get('consent_given') === 'true';
    const royalty_bps = parseInt(formData.get('royalty_bps') as string) || 1000;
    const min_price_cents = parseInt(formData.get('min_price_cents') as string) || 500;
    const max_discount_bps = parseInt(formData.get('max_discount_bps') as string) || 2000;
    const allow_third_party_stores = formData.get('allow_third_party_stores') === 'true';

    // Validate required fields
    if (!name || !email || !consent_given) {
      return NextResponse.json(
        { error: { message: 'Name, email, and consent are required' } },
        { status: 400 }
      );
    }

    // Extract training images
    const trainingImageFiles: File[] = [];
    let imageIndex = 0;
    while (formData.has(`training_image_${imageIndex}`)) {
      const file = formData.get(`training_image_${imageIndex}`) as File;
      if (file) {
        trainingImageFiles.push(file);
      }
      imageIndex++;
    }

    // Validate image count
    if (trainingImageFiles.length < 5 || trainingImageFiles.length > 15) {
      return NextResponse.json(
        { error: { message: 'Please upload between 5 and 15 training images' } },
        { status: 400 }
      );
    }

    // Create creator first (without training images)
    const creator = await createCreator({
      name,
      email,
      training_images: [], // Will be updated after upload
      consent_given,
      royalty_bps,
      min_price_cents,
      max_discount_bps,
      allow_third_party_stores,
    });

    try {
      // Upload training images to S3
      const uploadedImages = await uploadTrainingImages(trainingImageFiles, creator.id);
      const imageUrls = uploadedImages.map(img => img.url);

      // Update creator with image URLs
      await updateCreator(creator.id, {
        training_images: imageUrls,
      });

      // Submit FAL training job
      const falJobId = await submitFALTrainingJob(creator.id, imageUrls);

      // Update creator with FAL job ID and set status to TRAINING
      const updatedCreator = await updateCreator(creator.id, {
        fal_job_id: falJobId,
        status: 'TRAINING',
      });

      return NextResponse.json({
        success: true,
        creator: updatedCreator,
        message: 'Creator profile created and LoRA training started successfully',
      });

    } catch (error) {
      console.error('Error during image upload or FAL submission:', error);
      
      // Update creator status to FAILED
      await updateCreator(creator.id, {
        status: 'FAILED',
      });

      return NextResponse.json(
        { 
          error: { 
            message: 'Failed to start LoRA training. Please try again.',
            details: error instanceof Error ? error.message : 'Unknown error'
          } 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error creating creator:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to create creator profile',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract creator ID (should be passed in the request)
    const creatorId = formData.get('id') as string;
    if (!creatorId) {
      return NextResponse.json(
        { error: { message: 'Creator ID is required for updates' } },
        { status: 400 }
      );
    }

    // Extract form fields
    const name = formData.get('name') as string;
    const royalty_bps = parseInt(formData.get('royalty_bps') as string);
    const min_price_cents = parseInt(formData.get('min_price_cents') as string);
    const max_discount_bps = parseInt(formData.get('max_discount_bps') as string);
    const allow_third_party_stores = formData.get('allow_third_party_stores') === 'true';

    // Update creator
    const updatedCreator = await updateCreator(creatorId, {
      name,
      royalty_bps,
      min_price_cents,
      max_discount_bps,
      allow_third_party_stores,
    });

    return NextResponse.json({
      success: true,
      creator: updatedCreator,
      message: 'Creator profile updated successfully',
    });

  } catch (error) {
    console.error('Error updating creator:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to update creator profile',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}