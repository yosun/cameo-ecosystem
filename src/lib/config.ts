export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL!,
  },
  
  // AWS S3
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    s3: {
      bucketName: process.env.S3_BUCKET_NAME!,
      region: process.env.S3_BUCKET_REGION || 'us-east-1',
    },
  },
  
  // External APIs
  fal: {
    apiKey: process.env.FAL_API_KEY,
    baseUrl: 'https://fal.run/fal-ai',
  },
  
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN,
    baseUrl: 'https://api.replicate.com/v1',
  },
  
  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  
  // App
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    env: process.env.NODE_ENV || 'development',
  },
} as const;

// Validate required environment variables
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}