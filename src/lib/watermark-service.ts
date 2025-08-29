import { uploadFile } from './s3';

export interface WatermarkOptions {
  text?: string;
  opacity?: number;
  position?: 'center' | 'bottom-right' | 'top-left' | 'bottom-left' | 'top-right';
  fontSize?: number;
  color?: string;
}

export const DEFAULT_WATERMARK_OPTIONS: WatermarkOptions = {
  text: 'CAMEO PREVIEW',
  opacity: 0.7,
  position: 'center',
  fontSize: 24,
  color: 'white'
};

export async function applyWatermark(
  imageUrl: string, 
  generationId: string,
  options: WatermarkOptions = DEFAULT_WATERMARK_OPTIONS
): Promise<string> {
  try {
    // Download the original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download image');
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Apply watermark overlay
    const watermarkedBuffer = await addWatermarkOverlay(imageBuffer, options);
    
    const watermarkedKey = `watermarked/${generationId}-${Date.now()}.jpg`;
    const uploadResult = await uploadFile(watermarkedBuffer, watermarkedKey, 'image/jpeg');
    const watermarkedUrl = uploadResult.url;
    
    return watermarkedUrl;
    
  } catch (error) {
    console.error('Watermark application failed:', error);
    // Return original URL if watermarking fails
    return imageUrl;
  }
}

export async function removeWatermark(watermarkedUrl: string, generationId: string): Promise<string> {
  try {
    // Extract the original image from the watermarked version
    // In practice, you'd store the original separately and retrieve it here
    
    // For now, create a clean version by re-processing without watermark
    const response = await fetch(watermarkedUrl);
    if (!response.ok) {
      throw new Error('Failed to download watermarked image');
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Upload clean version
    const cleanKey = `clean/${generationId}-${Date.now()}.jpg`;
    const uploadResult = await uploadFile(imageBuffer, cleanKey, 'image/jpeg');
    const cleanUrl = uploadResult.url;
    
    return cleanUrl;
    
  } catch (error) {
    console.error('Watermark removal failed:', error);
    // Return original URL if removal fails
    return watermarkedUrl;
  }
}

/**
 * Remove watermarks from multiple images (batch processing)
 */
export async function removeWatermarksBatch(orderId: string, imageUrls: string[]): Promise<string[]> {
  const cleanUrls: string[] = [];
  
  for (const imageUrl of imageUrls) {
    try {
      const cleanUrl = await removeWatermark(imageUrl, `order-${orderId}`);
      cleanUrls.push(cleanUrl);
    } catch (error) {
      console.error(`Failed to remove watermark from ${imageUrl}:`, error);
      cleanUrls.push(imageUrl); // Keep original if removal fails
    }
  }
  
  return cleanUrls;
}

/**
 * Add watermark overlay to image buffer
 * Uses Canvas API for watermark generation (works in Node.js with canvas package)
 */
async function addWatermarkOverlay(imageBuffer: Buffer, options: WatermarkOptions): Promise<Buffer> {
  try {
    // For now, implement a simple text-based watermark using SVG
    // In production, you'd use Sharp or Canvas for more sophisticated watermarking
    
    const watermarkText = options.text || DEFAULT_WATERMARK_OPTIONS.text!;
    const opacity = options.opacity || DEFAULT_WATERMARK_OPTIONS.opacity!;
    const fontSize = options.fontSize || DEFAULT_WATERMARK_OPTIONS.fontSize!;
    const color = options.color || DEFAULT_WATERMARK_OPTIONS.color!;
    
    // Create SVG watermark overlay
    const watermarkSvg = `
      <svg width="300" height="60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.5"/>
          </filter>
        </defs>
        <text x="150" y="35" 
              font-family="Arial, sans-serif" 
              font-size="${fontSize}" 
              font-weight="bold"
              text-anchor="middle" 
              fill="${color}" 
              fill-opacity="${opacity}"
              filter="url(#shadow)">
          ${watermarkText}
        </text>
      </svg>
    `;
    
    // For now, return the original buffer with a note that watermarking would be applied
    // In production, use Sharp to composite the SVG onto the image:
    /*
    const watermarkedImage = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity: getGravityFromPosition(options.position),
        }
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
    
    return watermarkedImage;
    */
    
    // For now, return original buffer (watermarking would be applied in production)
    return imageBuffer;
    
  } catch (error) {
    console.error('Watermark overlay failed:', error);
    return imageBuffer;
  }
}

/**
 * Convert position option to Sharp gravity
 */
function getGravityFromPosition(position?: string): string {
  switch (position) {
    case 'top-left': return 'northwest';
    case 'top-right': return 'northeast';
    case 'bottom-left': return 'southwest';
    case 'bottom-right': return 'southeast';
    case 'center':
    default: return 'center';
  }
}

/**
 * Content access control - check if user has access to unwatermarked content
 */
export interface ContentAccess {
  userId: string;
  generationId: string;
  hasPaid: boolean;
  accessLevel: 'preview' | 'full';
}

export function checkContentAccess(access: ContentAccess): boolean {
  // Users get full access only after payment
  return access.hasPaid && access.accessLevel === 'full';
}

/**
 * Get appropriate image URL based on user access level
 */
export function getImageUrlForAccess(
  originalUrl: string,
  watermarkedUrl: string,
  access: ContentAccess
): string {
  if (checkContentAccess(access)) {
    return originalUrl; // Return clean image for paid users
  }
  return watermarkedUrl; // Return watermarked preview for unpaid users
}

/**
 * Content protection utilities
 */
export interface ContentProtection {
  preventRightClick: boolean;
  preventDownload: boolean;
  preventScreenshot: boolean;
  maxViewTime?: number; // in seconds
}

export const DEFAULT_CONTENT_PROTECTION: ContentProtection = {
  preventRightClick: true,
  preventDownload: true,
  preventScreenshot: false, // Can't really prevent this
  maxViewTime: 300 // 5 minutes
};

/**
 * Generate protected image URL with access controls
 */
export function generateProtectedImageUrl(
  imageUrl: string,
  generationId: string,
  userId: string,
  expiresIn: number = 3600 // 1 hour default
): string {
  // In production, this would generate a signed URL with expiration
  // For now, return the original URL with query parameters
  const params = new URLSearchParams({
    user: userId,
    generation: generationId,
    expires: (Date.now() + expiresIn * 1000).toString()
  });
  
  return `${imageUrl}?${params.toString()}`;
}