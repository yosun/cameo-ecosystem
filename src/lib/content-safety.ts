/**
 * Content Safety Service
 * Handles NSFW detection, keyword filtering, and content policy enforcement
 */

export interface ContentSafetyResult {
  isAllowed: boolean;
  violations: string[];
  confidence?: number;
}

export interface NSFWDetectionResult {
  isNSFW: boolean;
  confidence: number;
  categories?: {
    porn: number;
    sexy: number;
    hentai: number;
    neutral: number;
    drawing: number;
  };
}

// Blacklisted keywords for content filtering
const BLACKLISTED_KEYWORDS = [
  // Celebrity names (examples - would be expanded)
  'taylor swift', 'elon musk', 'biden', 'trump', 'obama',
  'celebrity', 'famous person', 'actor', 'actress',
  
  // Brand names and logos
  'nike', 'adidas', 'apple', 'google', 'microsoft', 'disney',
  'coca cola', 'pepsi', 'mcdonalds', 'starbucks',
  'logo', 'trademark', 'brand name',
  
  // Inappropriate content
  'nsfw', 'nude', 'naked', 'sex', 'porn', 'explicit',
  'violence', 'weapon', 'gun', 'knife', 'blood',
  'hate', 'racist', 'discrimination',
  
  // Copyright-related
  'copyrighted', 'copyright', 'trademarked', 'licensed character',
  'movie character', 'cartoon character', 'anime character'
];

// NSFW categories that should be blocked
const NSFW_THRESHOLD = 0.7; // 70% confidence threshold

/**
 * Check if text content contains blacklisted keywords
 */
export function checkKeywordFilter(text: string): ContentSafetyResult {
  const violations: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of BLACKLISTED_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      violations.push(`Contains blacklisted keyword: "${keyword}"`);
    }
  }
  
  return {
    isAllowed: violations.length === 0,
    violations
  };
}

/**
 * Detect NSFW content in images using a simple heuristic approach
 * In production, this would integrate with services like AWS Rekognition or Google Vision API
 */
export async function detectNSFW(imageUrl: string): Promise<NSFWDetectionResult> {
  try {
    // For now, implement a basic check based on filename/URL patterns
    // In production, this would call an actual NSFW detection API
    const url = imageUrl.toLowerCase();
    
    // Simple heuristic checks
    const nsfwIndicators = ['nsfw', 'nude', 'adult', 'xxx', 'porn', 'sexy'];
    const hasNSFWIndicator = nsfwIndicators.some(indicator => url.includes(indicator));
    
    // Mock confidence score
    const confidence = hasNSFWIndicator ? 0.9 : 0.1;
    
    return {
      isNSFW: confidence > NSFW_THRESHOLD,
      confidence,
      categories: {
        porn: hasNSFWIndicator ? 0.8 : 0.05,
        sexy: hasNSFWIndicator ? 0.7 : 0.1,
        hentai: 0.05,
        neutral: hasNSFWIndicator ? 0.2 : 0.9,
        drawing: 0.1
      }
    };
  } catch (error) {
    console.error('NSFW detection failed:', error);
    // Fail safe - assume content is safe if detection fails
    return {
      isNSFW: false,
      confidence: 0.5
    };
  }
}

/**
 * Comprehensive content validation for uploads
 */
export async function validateContent(
  text?: string,
  imageUrl?: string,
  requireConsent: boolean = true
): Promise<ContentSafetyResult> {
  const violations: string[] = [];
  
  // Check text content if provided
  if (text) {
    const textResult = checkKeywordFilter(text);
    if (!textResult.isAllowed) {
      violations.push(...textResult.violations);
    }
  }
  
  // Check image content if provided
  if (imageUrl) {
    try {
      const nsfwResult = await detectNSFW(imageUrl);
      if (nsfwResult.isNSFW) {
        violations.push(`Image contains inappropriate content (confidence: ${Math.round(nsfwResult.confidence * 100)}%)`);
      }
    } catch (error) {
      console.error('Image validation failed:', error);
      violations.push('Unable to validate image content');
    }
  }
  
  return {
    isAllowed: violations.length === 0,
    violations
  };
}

/**
 * Validate consent for content uploads
 */
export interface ConsentValidation {
  hasConsent: boolean;
  consentTimestamp?: Date;
  consentVersion?: string;
}

export function validateConsent(consent: ConsentValidation): ContentSafetyResult {
  const violations: string[] = [];
  
  if (!consent.hasConsent) {
    violations.push('User consent is required for content upload');
  }
  
  if (!consent.consentTimestamp) {
    violations.push('Consent timestamp is required');
  }
  
  // Check if consent is recent (within last 30 days)
  if (consent.consentTimestamp) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (consent.consentTimestamp < thirtyDaysAgo) {
      violations.push('Consent has expired and must be renewed');
    }
  }
  
  return {
    isAllowed: violations.length === 0,
    violations
  };
}

/**
 * Content policy enforcement for different content types
 */
export interface ContentPolicy {
  allowNSFW: boolean;
  allowCelebrities: boolean;
  allowBrands: boolean;
  requireConsent: boolean;
  maxFileSize?: number; // in bytes
  allowedFormats?: string[];
}

export const DEFAULT_CONTENT_POLICY: ContentPolicy = {
  allowNSFW: false,
  allowCelebrities: false,
  allowBrands: false,
  requireConsent: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp']
};

/**
 * Enforce content policy for uploads
 */
export async function enforceContentPolicy(
  content: {
    text?: string;
    imageUrl?: string;
    fileSize?: number;
    mimeType?: string;
  },
  consent?: ConsentValidation,
  policy: ContentPolicy = DEFAULT_CONTENT_POLICY
): Promise<ContentSafetyResult> {
  const violations: string[] = [];
  
  // Validate consent if required
  if (policy.requireConsent && consent) {
    const consentResult = validateConsent(consent);
    if (!consentResult.isAllowed) {
      violations.push(...consentResult.violations);
    }
  } else if (policy.requireConsent && !consent) {
    violations.push('Consent is required but not provided');
  }
  
  // Validate file size
  if (content.fileSize && policy.maxFileSize && content.fileSize > policy.maxFileSize) {
    violations.push(`File size exceeds maximum allowed size of ${policy.maxFileSize} bytes`);
  }
  
  // Validate file format
  if (content.mimeType && policy.allowedFormats && !policy.allowedFormats.includes(content.mimeType)) {
    violations.push(`File format ${content.mimeType} is not allowed`);
  }
  
  // Validate content safety
  const contentResult = await validateContent(content.text, content.imageUrl, policy.requireConsent);
  if (!contentResult.isAllowed) {
    violations.push(...contentResult.violations);
  }
  
  return {
    isAllowed: violations.length === 0,
    violations
  };
}

/**
 * Get content safety report for admin/moderation purposes
 */
export interface ContentSafetyReport {
  contentId: string;
  contentType: 'text' | 'image' | 'generation';
  safetyResult: ContentSafetyResult;
  nsfwResult?: NSFWDetectionResult;
  timestamp: Date;
  userId?: string;
  creatorId?: string;
}

export function generateSafetyReport(
  contentId: string,
  contentType: 'text' | 'image' | 'generation',
  safetyResult: ContentSafetyResult,
  nsfwResult?: NSFWDetectionResult,
  userId?: string,
  creatorId?: string
): ContentSafetyReport {
  return {
    contentId,
    contentType,
    safetyResult,
    nsfwResult,
    timestamp: new Date(),
    userId,
    creatorId
  };
}