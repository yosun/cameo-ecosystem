import { NextRequest, NextResponse } from 'next/server';
import { getCreatorById, updateCreatorLoRAStatus } from '@/lib/creator-service';
import { checkFALJobStatus } from '@/lib/fal-service';

interface StatusRouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: StatusRouteParams
) {
  try {
    const creator = await getCreatorById(params.id);

    if (!creator) {
      return NextResponse.json(
        { error: { message: 'Creator not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: creator.id,
      status: creator.status,
      lora_url: creator.lora_url,
      trigger_word: creator.trigger_word,
      fal_job_id: creator.fal_job_id,
    });

  } catch (error) {
    console.error('Error getting creator status:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to get creator status',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: StatusRouteParams
) {
  try {
    const creator = await getCreatorById(params.id);

    if (!creator) {
      return NextResponse.json(
        { error: { message: 'Creator not found' } },
        { status: 404 }
      );
    }

    // If creator has a FAL job ID and is in TRAINING status, check FAL status
    if (creator.fal_job_id && creator.status === 'TRAINING') {
      try {
        const falStatus = await checkFALJobStatus(creator.fal_job_id);
        
        let updatedCreator = creator;
        
        if (falStatus.status === 'COMPLETED') {
          // Note: This is a simplified check. In reality, we'd need to get the actual result
          // from FAL API which might require a separate endpoint call
          console.log('FAL job completed, but webhook should handle the update');
          
        } else if (falStatus.status === 'FAILED') {
          updatedCreator = await updateCreatorLoRAStatus(creator.id, 'FAILED');
        }
        
        return NextResponse.json({
          id: updatedCreator.id,
          status: updatedCreator.status,
          lora_url: updatedCreator.lora_url,
          trigger_word: updatedCreator.trigger_word,
          fal_job_id: updatedCreator.fal_job_id,
          fal_status: falStatus.status,
        });

      } catch (falError) {
        console.error('Error checking FAL status:', falError);
        // Don't fail the request, just return current status
        return NextResponse.json({
          id: creator.id,
          status: creator.status,
          lora_url: creator.lora_url,
          trigger_word: creator.trigger_word,
          fal_job_id: creator.fal_job_id,
          error: 'Failed to check FAL status',
        });
      }
    }

    // Return current status if no FAL job or not in training
    return NextResponse.json({
      id: creator.id,
      status: creator.status,
      lora_url: creator.lora_url,
      trigger_word: creator.trigger_word,
      fal_job_id: creator.fal_job_id,
    });

  } catch (error) {
    console.error('Error refreshing creator status:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to refresh creator status',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}