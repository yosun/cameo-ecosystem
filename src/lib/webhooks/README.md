# Webhook Processing System

This directory contains the webhook processing infrastructure for the Cameo Ecosystem, providing robust handling of webhooks from external services (Stripe, FAL, Replicate) with built-in retry logic, monitoring, and dead letter queue management.

## Architecture

### Core Components

1. **WebhookValidator** - Validates webhook signatures for security
2. **WebhookRetryManager** - Handles retry logic and dead letter queue
3. **WebhookMonitor** - Provides monitoring and statistics
4. **WebhookRetryProcessor** - Background processor for failed webhooks

### Webhook Sources

- **Stripe** - Payment events (checkout completion, transfers, account updates)
- **FAL** - LoRA training completion events
- **Replicate** - Image generation completion events

## Features

### Security
- Signature validation for all webhook sources
- Timestamp validation to prevent replay attacks
- Secure secret management via environment variables

### Reliability
- Automatic retry with exponential backoff (1s, 5s, 15s)
- Dead letter queue for webhooks that fail after max retries
- Comprehensive error logging and monitoring

### Monitoring
- Real-time webhook processing statistics
- Failed webhook tracking and analysis
- Admin dashboard for webhook management
- Dead letter queue review interface

## Configuration

### Environment Variables

```bash
# Webhook secrets for signature validation
STRIPE_WEBHOOK_SECRET=whsec_...
FAL_WEBHOOK_SECRET=your_fal_webhook_secret
REPLICATE_WEBHOOK_SECRET=your_replicate_webhook_secret

# Admin access
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### Database Schema

The system uses the following Prisma models:

```prisma
model WebhookEvent {
  id           String @id @default(cuid())
  source       WebhookSource
  event_type   String
  payload      Json
  signature    String?
  processed_at DateTime?
  retry_count  Int @default(0)
  status       WebhookStatus @default(PENDING)
  error_message String?
  
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  
  dead_letter_queue DeadLetterQueue?
}

model DeadLetterQueue {
  id                String @id @default(cuid())
  webhook_event_id  String @unique
  final_error       String
  reviewed          Boolean @default(false)
  reviewed_by       String?
  reviewed_at       DateTime?
  
  webhook_event     WebhookEvent @relation(fields: [webhook_event_id], references: [id])
  
  created_at        DateTime @default(now())
}
```

## Usage

### Processing Webhooks

Use the `processWebhookWithRetry` wrapper for all webhook processing:

```typescript
import { processWebhookWithRetry } from '@/lib/webhook-infrastructure';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('webhook-signature');
  
  await processWebhookWithRetry(
    'STRIPE',
    'checkout.session.completed',
    JSON.parse(body),
    async () => {
      // Your webhook processing logic here
      await handleCheckoutCompletion(payload);
    },
    signature
  );
  
  return NextResponse.json({ success: true });
}
```

### Signature Validation

```typescript
import { WebhookValidator } from '@/lib/webhook-infrastructure';

// Validate Stripe signature
const validation = WebhookValidator.validateStripeSignature(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);

if (!validation.isValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### Monitoring

```typescript
import { WebhookMonitor } from '@/lib/webhook-infrastructure';

// Get webhook statistics
const stats = await WebhookMonitor.getWebhookStats('STRIPE');

// Get recent failures
const failures = await WebhookMonitor.getRecentFailures(20);

// Get dead letter queue items
const deadLetterItems = await WebhookMonitor.getDeadLetterQueue();
```

## API Endpoints

### Admin Webhook Management

- `GET /api/admin/webhooks?action=stats` - Get webhook statistics
- `GET /api/admin/webhooks?action=failures` - Get recent failures
- `GET /api/admin/webhooks?action=dead-letter` - Get dead letter queue
- `POST /api/admin/webhooks` - Retry individual webhook
- `POST /api/admin/webhooks/retry` - Trigger retry processing

### Webhook Endpoints

- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/fal` - FAL webhook handler
- `POST /api/webhooks/replicate` - Replicate webhook handler

## Retry Logic

### Retry Schedule
1. **First retry**: 1 second after failure
2. **Second retry**: 5 seconds after failure
3. **Third retry**: 15 seconds after failure
4. **Dead letter**: After 3 failed attempts

### Retry Processing

Automatic retry processing can be set up using the cron script:

```bash
# Add to crontab to run every 5 minutes
*/5 * * * * cd /path/to/cameo-ecosystem && node scripts/webhook-retry-cron.js
```

Or trigger manually via API:

```bash
curl -X POST http://localhost:3000/api/admin/webhooks/retry \
  -H "Authorization: Bearer your_admin_token"
```

## Monitoring Dashboard

The admin dashboard provides:

- Real-time webhook processing statistics
- Success rate monitoring
- Failed webhook details with retry options
- Dead letter queue management
- Manual retry capabilities

Access the dashboard at `/admin/webhooks` (requires admin authentication).

## Error Handling

### Common Error Scenarios

1. **Invalid Signature**: Webhook rejected with 401 status
2. **Processing Failure**: Webhook marked for retry
3. **Max Retries Exceeded**: Webhook moved to dead letter queue
4. **Network Timeout**: Automatic retry with exponential backoff

### Error Recovery

1. **Review Failed Webhooks**: Check admin dashboard for failures
2. **Analyze Error Messages**: Identify root cause of failures
3. **Manual Retry**: Retry individual webhooks after fixing issues
4. **Dead Letter Review**: Manually process dead letter queue items

## Best Practices

### Security
- Always validate webhook signatures
- Use HTTPS for webhook endpoints
- Rotate webhook secrets regularly
- Monitor for suspicious webhook activity

### Performance
- Process webhooks asynchronously when possible
- Use database transactions for critical operations
- Implement proper error handling and logging
- Monitor webhook processing latency

### Reliability
- Design idempotent webhook handlers
- Handle duplicate webhook deliveries gracefully
- Implement proper retry logic with exponential backoff
- Monitor dead letter queue regularly

## Troubleshooting

### Common Issues

1. **Signature Validation Failures**
   - Check webhook secret configuration
   - Verify timestamp tolerance settings
   - Ensure proper signature format

2. **High Retry Rates**
   - Check external service availability
   - Monitor database connection health
   - Review error logs for patterns

3. **Dead Letter Queue Growth**
   - Investigate recurring error patterns
   - Check for configuration issues
   - Review webhook payload formats

### Debugging

Enable detailed logging by setting:

```bash
DEBUG=webhook:*
```

Check webhook processing logs:

```bash
# View recent webhook events
tail -f logs/webhook-processing.log

# Check dead letter queue
curl -X GET http://localhost:3000/api/admin/webhooks?action=dead-letter
```

## Testing

Run webhook infrastructure tests:

```bash
npm test -- --testNamePattern="WebhookValidator|WebhookRetryManager|WebhookMonitor"
```

Test webhook endpoints locally using tools like ngrok:

```bash
# Expose local server for webhook testing
ngrok http 3000

# Update webhook URLs in external services to use ngrok URL
```