interface FALTrainingRequest {
  images: string[];
  trigger_word?: string;
  steps?: number;
  learning_rate?: number;
}

interface FALTrainingResponse {
  request_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

interface FALWebhookPayload {
  request_id: string;
  status: 'COMPLETED' | 'FAILED';
  output?: {
    lora_url: string;
    trigger_word: string;
  };
  error?: string;
}

/**
 * Submits a LoRA training job to FAL AI
 */
export async function submitFALTrainingJob(
  creatorId: string,
  imageUrls: string[]
): Promise<string> {
  const falApiKey = process.env.FAL_API_KEY;
  
  if (!falApiKey) {
    throw new Error('FAL API key not configured');
  }

  // Generate a trigger word based on creator ID
  const triggerWord = `creator_${creatorId.slice(0, 8)}`;

  const requestBody: FALTrainingRequest = {
    images: imageUrls,
    trigger_word: triggerWord,
    steps: 1000, // Default training steps
    learning_rate: 0.0001, // Default learning rate
  };

  try {
    const response = await fetch('https://fal.run/fal-ai/flux-lora-fast-training', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`FAL API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const result: FALTrainingResponse = await response.json();
    
    if (!result.request_id) {
      throw new Error('FAL API did not return a request ID');
    }

    console.log(`FAL training job submitted for creator ${creatorId}:`, result.request_id);
    
    return result.request_id;

  } catch (error) {
    console.error('Error submitting FAL training job:', error);
    throw error;
  }
}

/**
 * Checks the status of a FAL training job
 */
export async function checkFALJobStatus(jobId: string): Promise<FALTrainingResponse> {
  const falApiKey = process.env.FAL_API_KEY;
  
  if (!falApiKey) {
    throw new Error('FAL API key not configured');
  }

  try {
    const response = await fetch(`https://fal.run/fal-ai/flux-lora-fast-training/requests/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falApiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`FAL API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const result: FALTrainingResponse = await response.json();
    return result;

  } catch (error) {
    console.error('Error checking FAL job status:', error);
    throw error;
  }
}

/**
 * Processes FAL webhook payload
 */
export function processFALWebhook(payload: FALWebhookPayload): {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  loraUrl?: string;
  triggerWord?: string;
  error?: string;
} {
  return {
    jobId: payload.request_id,
    status: payload.status,
    loraUrl: payload.output?.lora_url,
    triggerWord: payload.output?.trigger_word,
    error: payload.error,
  };
}