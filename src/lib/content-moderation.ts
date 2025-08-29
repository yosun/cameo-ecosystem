/**
 * Content Moderation Service
 * Integrates content safety, watermarking, and access control
 */

import { 
  validateContent, 
  enforceContentPolicy, 
  ContentPolicy, 
  ConsentValidation,
  ContentSafetyResult,
  generateSafetyReport,
  ContentSafetyReport
} from './content-safety';
import { 
  applyWatermark, 
  removeWatermark, 
  checkContentAccess,
  ContentAccess,
  getImageUrlForAccess,
  WatermarkOptions
} from './watermark-service';
import { prisma } from './prisma';

export interface ModerationRequest {
  contentId: string;
  contentType: 'image' | 'text' | 'generation';
  content: {
    text?: string;
    imageUrl?: string;
    fileSize?: number;
    mimeType?: string;
  };
  userId: string;
  creatorId?: string;
  consent?: ConsentValidation;
  policy?: ContentPolicy;
}

export interface ModerationResult {
  approved: boolean;
  violations: string[];
  moderatedImageUrl?: string; // Watermarked version
  originalImageUrl?: string;  // Clean version (for paid access)
  safetyReport: ContentSafetyReport;
  requiresManualReview: boolean;
}

/**
 * Comprehensive content moderation pipeline
 */
export async function moderateContent(request: ModerationRequest): Promise<ModerationResult> {
  const { contentId, contentType, content, userId, creatorId, consent, policy } = request;
  
  try {
    // Step 1: Content safety validation
    const safetyResult = await enforceContentPolicy(content, consent, policy);
    
    // Step 2: Generate safety report
    const safetyReport = generateSafetyReport(
      contentId,
      contentType,
      safetyResult,
      undefined, // NSFW result would be included here
      userId,
      creatorId
    );
    
    // Step 3: Determine if manual review is needed
    const requiresManualReview = shouldRequireManualReview(safetyResult, content);
    
    let moderatedImageUrl: string | undefined;
    let originalImageUrl: string | undefined;
    
    // Step 4: Apply watermark if content is approved and has image
    if (safetyResult.isAllowed && content.imageUrl) {
      originalImageUrl = content.imageUrl;
      
      // Apply watermark for preview
      moderatedImageUrl = await applyWatermark(content.imageUrl, contentId);
      
      // Store moderation result in database
      await storeModerationResult(contentId, safetyResult, moderatedImageUrl, originalImageUrl);
    }
    
    return {
      approved: safetyResult.isAllowed,
      violations: safetyResult.violations,
      moderatedImageUrl,
      originalImageUrl,
      safetyReport,
      requiresManualReview
    };
    
  } catch (error) {
    console.error('Content moderation failed:', error);
    
    // Fail safe - reject content if moderation fails
    return {
      approved: false,
      violations: ['Content moderation system error'],
      safetyReport: generateSafetyReport(contentId, contentType, {
        isAllowed: false,
        violations: ['System error during moderation']
      }, undefined, userId, creatorId),
      requiresManualReview: true
    };
  }
}

/**
 * Determine if content requires manual review
 */
function shouldRequireManualReview(safetyResult: ContentSafetyResult, content: any): boolean {
  // Require manual review if:
  // 1. Content has violations but is borderline
  // 2. Content contains celebrity or brand references
  // 3. Content safety confidence is low
  
  const borderlineKeywords = ['celebrity', 'famous', 'brand', 'logo'];
  const hasBoderlineContent = content.text && 
    borderlineKeywords.some(keyword => 
      content.text.toLowerCase().includes(keyword)
    );
  
  return !safetyResult.isAllowed || hasBoderlineContent;
}

/**
 * Store moderation result in database
 */
async function storeModerationResult(
  contentId: string,
  safetyResult: ContentSafetyResult,
  watermarkedUrl?: string,
  originalUrl?: string
): Promise<void> {
  try {
    // In a full implementation, you'd have a ModerationResult model
    // For now, we'll update the generation record if it exists
    
    const generation = await prisma.generation.findUnique({
      where: { id: contentId }
    });
    
    if (generation) {
      await prisma.generation.update({
        where: { id: contentId },
        data: {
          // Store moderation metadata in a JSON field or separate table
          // For now, just update the image URL with watermarked version
          image_url: watermarkedUrl || generation.image_url
        }
      });
    }
  } catch (error) {
    console.error('Failed to store moderation result:', error);
  }
}

/**
 * Handle post-payment watermark removal
 */
export async function processPaymentContentAccess(
  orderId: string,
  userId: string
): Promise<{ success: boolean; cleanUrls: string[] }> {
  try {
    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                generation: true
              }
            }
          }
        }
      }
    });
    
    if (!order || order.user_id !== userId) {
      throw new Error('Order not found or access denied');
    }
    
    if (order.status !== 'PAID') {
      throw new Error('Order not paid');
    }
    
    const cleanUrls: string[] = [];
    
    // Remove watermarks from all generation images in the order
    for (const item of order.items) {
      if (item.product.generation?.image_url) {
        const cleanUrl = await removeWatermark(
          item.product.generation.image_url,
          item.product.generation.id
        );
        cleanUrls.push(cleanUrl);
        
        // Update generation with clean URL
        await prisma.generation.update({
          where: { id: item.product.generation.id },
          data: {
            // In practice, you'd store both watermarked and clean URLs
            image_url: cleanUrl
          }
        });
      }
    }
    
    return { success: true, cleanUrls };
    
  } catch (error) {
    console.error('Failed to process payment content access:', error);
    return { success: false, cleanUrls: [] };
  }
}

/**
 * Get content with appropriate access level
 */
export async function getContentForUser(
  generationId: string,
  userId: string
): Promise<{ imageUrl: string; hasFullAccess: boolean }> {
  try {
    const generation = await prisma.generation.findUnique({
      where: { id: generationId },
      include: {
        products: {
          include: {
            orders: {
              where: {
                order: {
                  user_id: userId,
                  status: 'PAID'
                }
              }
            }
          }
        }
      }
    });
    
    if (!generation) {
      throw new Error('Generation not found');
    }
    
    // Check if user has paid for any product containing this generation
    const hasPaid = generation.products.some(product => 
      product.orders.length > 0
    );
    
    const access: ContentAccess = {
      userId,
      generationId,
      hasPaid,
      accessLevel: hasPaid ? 'full' : 'preview'
    };
    
    // Return appropriate URL based on access level
    const imageUrl = generation.image_url || '';
    const hasFullAccess = checkContentAccess(access);
    
    return {
      imageUrl,
      hasFullAccess
    };
    
  } catch (error) {
    console.error('Failed to get content for user:', error);
    throw error;
  }
}

/**
 * Admin function to manually review flagged content
 */
export interface ManualReviewDecision {
  contentId: string;
  approved: boolean;
  reason: string;
  reviewerId: string;
}

export async function processManualReview(
  decision: ManualReviewDecision
): Promise<{ success: boolean }> {
  try {
    // Update generation status based on manual review
    await prisma.generation.update({
      where: { id: decision.contentId },
      data: {
        status: decision.approved ? 'COMPLETED' : 'FAILED'
      }
    });
    
    // Log the manual review decision
    console.log('Manual review processed:', decision);
    
    return { success: true };
    
  } catch (error) {
    console.error('Failed to process manual review:', error);
    return { success: false };
  }
}

/**
 * Bulk content moderation for admin dashboard
 */
export async function getModerationQueue(
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: Array<{
    id: string;
    type: string;
    content: any;
    status: string;
    createdAt: Date;
    userId: string;
    creatorId?: string;
  }>;
  total: number;
}> {
  try {
    // Get generations that need manual review
    const generations = await prisma.generation.findMany({
      where: {
        status: 'PENDING' // Assuming pending status means needs review
      },
      include: {
        user: {
          select: { id: true, email: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    
    const total = await prisma.generation.count({
      where: { status: 'PENDING' }
    });
    
    const items = generations.map(gen => ({
      id: gen.id,
      type: 'generation',
      content: {
        prompt: gen.prompt,
        imageUrl: gen.image_url,
        mode: gen.mode
      },
      status: gen.status,
      createdAt: gen.createdAt,
      userId: gen.user_id,
      creatorId: gen.creator_id
    }));
    
    return { items, total };
    
  } catch (error) {
    console.error('Failed to get moderation queue:', error);
    return { items: [], total: 0 };
  }
}