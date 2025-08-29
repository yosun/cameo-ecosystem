# Generation Components

This directory contains the 2D content generation system components for the Cameo Ecosystem.

## Components

### GenerationInterface
Main component that combines Photo Mode and Text Mode generation with a live queue display.

**Props:**
- `creator`: Creator object with LoRA information
- `userId`: Current user ID for tracking generations

**Usage:**
```tsx
import GenerationInterface from '@/components/generation/generation-interface';

<GenerationInterface 
  creator={creator} 
  userId={session.user.id}
/>
```

### PhotoMode
Handles scene-based generation where users upload an image or provide a URL, and the system generates content within that scene using the creator's LoRA.

**Props:**
- `creatorId`: Creator ID
- `loraUrl`: URL to the trained LoRA model
- `triggerWord`: Creator's trigger word
- `onGenerationStart`: Callback when generation begins

**Features:**
- File upload with drag & drop
- URL input for remote images
- Image preview
- Custom prompt input
- Validation and error handling

### TextMode
Handles prompt-based generation where users describe a scene in text and the system generates content using the creator's LoRA.

**Props:**
- `creatorId`: Creator ID
- `loraUrl`: URL to the trained LoRA model
- `triggerWord`: Creator's trigger word
- `onGenerationStart`: Callback when generation begins

**Features:**
- Rich text prompt input
- Prompt suggestions
- Character count validation
- Content filtering tips

### GenerationQueue
Displays the user's generation history and status in real-time.

**Props:**
- `userId`: User ID to fetch generations for
- `onProductCreate`: Optional callback for creating products from generations

**Features:**
- Real-time status updates (polling every 5 seconds)
- Status icons and progress indicators
- Download completed images
- Create products from successful generations
- Error handling and retry options

## API Endpoints

### POST /api/infer
Handles Photo Mode generation requests.

**Request:**
- `creator_id`: Creator ID
- `mode`: "photo"
- `prompt`: Optional custom prompt
- `lora_url`: LoRA model URL
- `scene_image`: File upload OR
- `scene_url`: Remote image URL

**Response:**
```json
{
  "generation_id": "gen_123",
  "status": "processing",
  "replicate_id": "r_456"
}
```

### POST /api/generate
Handles Text Mode generation requests.

**Request:**
```json
{
  "creator_id": "creator_123",
  "mode": "text",
  "prompt": "Description of the scene",
  "lora_url": "https://example.com/lora.safetensors"
}
```

**Response:**
```json
{
  "generation_id": "gen_123",
  "status": "processing",
  "replicate_id": "r_456"
}
```

### GET /api/generations
Fetches user's generation history.

**Query Parameters:**
- `user_id`: User ID (must match authenticated user)

**Response:**
```json
{
  "generations": [
    {
      "id": "gen_123",
      "mode": "photo",
      "prompt": "Creator in a magical forest",
      "scene_url": "https://example.com/scene.jpg",
      "image_url": "https://example.com/result.jpg",
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "creator": {
        "name": "Creator Name",
        "trigger_word": "creatorname"
      }
    }
  ]
}
```

### POST /api/webhooks/replicate
Handles Replicate completion webhooks.

**Webhook Payload:**
```json
{
  "id": "prediction_id",
  "status": "succeeded",
  "output": ["https://replicate.delivery/image.jpg"],
  "error": null
}
```

## Content Safety

The system includes several safety measures:

1. **Keyword Filtering**: Blocks prompts containing NSFW or copyrighted content
2. **Consent Validation**: Ensures all uploads have proper consent
3. **Watermarking**: Applies watermarks to generated content until purchase
4. **Rate Limiting**: Prevents abuse through API rate limiting

## Environment Variables

Required environment variables:

```env
REPLICATE_API_TOKEN=your_replicate_api_token
REPLICATE_FLUX_KONTEXT_VERSION=black-forest-labs/flux-kontext-dev-lora
REPLICATE_WEBHOOK_SECRET=your_webhook_secret
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=your_s3_bucket
```

## Database Schema

The generation system uses these database models:

- `Generation`: Tracks generation requests and results
- `Creator`: Stores LoRA information and licensing
- `User`: Links generations to users

## Testing

Run the generation service tests:

```bash
npm test -- --testPathPatterns=generation-service.test.ts
```

## Future Enhancements

1. **Advanced Watermarking**: Implement proper image watermarking with Sharp
2. **Content Moderation**: Add AI-powered content moderation
3. **Batch Generation**: Support multiple image generation
4. **Style Transfer**: Additional LoRA models and style options
5. **Real-time Updates**: WebSocket connections for instant status updates