import { uploadToS3 } from './s3';

export interface ImageUploadResult {
  url: string;
  key: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an image file for LoRA training
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload JPEG, PNG, or WebP images.'
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Please upload images smaller than 10MB.'
    };
  }

  return { isValid: true };
}

/**
 * Validates an image file asynchronously (including dimensions)
 */
export function validateImageFileAsync(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    // First do basic validation
    const basicValidation = validateImageFile(file);
    if (!basicValidation.isValid) {
      resolve(basicValidation);
      return;
    }

    // Check minimum dimensions (at least 512x512)
    const img = new Image();
    img.onload = () => {
      if (img.width < 512 || img.height < 512) {
        resolve({
          isValid: false,
          error: 'Image dimensions too small. Please upload images at least 512x512 pixels.'
        });
      } else {
        resolve({ isValid: true });
      }
    };
    img.onerror = () => {
      resolve({
        isValid: false,
        error: 'Invalid image file.'
      });
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads multiple images for LoRA training
 */
export async function uploadTrainingImages(
  files: File[],
  creatorId: string
): Promise<ImageUploadResult[]> {
  const results: ImageUploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const key = `creators/${creatorId}/training/${Date.now()}-${i}-${file.name}`;
    
    try {
      const url = await uploadToS3(file, key);
      results.push({ url, key });
    } catch (error) {
      console.error(`Failed to upload image ${file.name}:`, error);
      throw new Error(`Failed to upload image ${file.name}`);
    }
  }
  
  return results;
}

/**
 * Validates the number of training images
 */
export function validateImageCount(count: number): ImageValidationResult {
  if (count < 5) {
    return {
      isValid: false,
      error: 'Please upload at least 5 images for LoRA training.'
    };
  }
  
  if (count > 15) {
    return {
      isValid: false,
      error: 'Please upload no more than 15 images for LoRA training.'
    };
  }
  
  return { isValid: true };
}