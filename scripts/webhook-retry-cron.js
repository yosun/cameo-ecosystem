#!/usr/bin/env node

/**
 * Webhook retry cron job
 * 
 * This script can be run periodically (e.g., every 5 minutes) to process
 * failed webhooks that are ready for retry.
 * 
 * Usage:
 *   node scripts/webhook-retry-cron.js
 * 
 * Or add to crontab:
 *   */5 * * * * cd /path/to/cameo-ecosystem && node scripts/webhook-retry-cron.js
 */

const { WebhookRetryProcessor } = require('../src/lib/webhook-retry-processor');

async function main() {
  console.log(`[${new Date().toISOString()}] Starting webhook retry processing...`);
  
  try {
    const result = await WebhookRetryProcessor.processRetryableWebhooks();
    
    console.log(`[${new Date().toISOString()}] Webhook retry processing completed:`, {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
    
    if (result.failed > 0) {
      console.warn(`[${new Date().toISOString()}] ${result.failed} webhooks failed during retry processing`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Webhook retry processing failed:`, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`);
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
  process.exit(1);
});