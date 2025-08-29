# Cameo Ecosystem

A full-stack web application that enables creator-branded content generation and merchandise sales through AI-powered LoRA training and image generation.

## Features

- **Creator LoRA Training**: Upload images to train personalized AI models via FAL
- **AI Content Generation**: Generate branded content using Photo Mode (Kontext LoRA) or Text Mode
- **Merchandise System**: Transform generated images into physical products (postcards, shirts, figurines)
- **Store Management**: Create curated storefronts with licensing and royalty management
- **Payment Processing**: Stripe Connect integration for multi-party split payments

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **File Storage**: AWS S3 with CloudFront CDN
- **AI Services**: FAL AI (LoRA training), Replicate (image generation)
- **Payments**: Stripe Connect
- **Authentication**: NextAuth.js

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- AWS S3 bucket
- FAL API key
- Replicate API token
- Stripe account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cameo-ecosystem
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/cameo_ecosystem"

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=cameo-ecosystem-storage
S3_BUCKET_REGION=us-east-1

# External APIs
FAL_API_KEY=your_fal_api_key
REPLICATE_API_TOKEN=your_replicate_api_token

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up the database:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Start the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## API Endpoints

### Health Check
- `GET /api/health` - Application health status

### Creator Management
- `POST /api/creator` - Create creator and start LoRA training
- `GET /api/creator/[id]/lora-status` - Check LoRA training status

### Content Generation
- `POST /api/generate` - Generate content (Photo/Text mode)
- `POST /api/infer` - Photo mode generation with scene upload

### Store & Products
- `POST /api/store` - Create store
- `POST /api/store/[id]/products` - Add product to store

### Payments
- `POST /api/checkout` - Create Stripe checkout session
- `POST /api/webhooks/stripe` - Handle Stripe webhooks

## Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **User**: Platform users
- **Creator**: Content creators with LoRA models
- **Generation**: AI-generated content
- **Store**: Merchandise storefronts
- **Product**: Individual merchandise items
- **Order**: Purchase transactions
- **Transfer**: Stripe Connect payment splits

## Development

### Running Tests
```bash
npm test
```

### Database Operations
```bash
# Reset database
npx prisma migrate reset

# View database
npx prisma studio

# Generate Prisma client
npx prisma generate
```

### Deployment

The application is designed for deployment on AWS with:
- ECS Fargate for the Next.js application
- RDS PostgreSQL for the database
- S3 + CloudFront for file storage and CDN
- Application Load Balancer for traffic distribution

## License

This project is licensed under the MIT License.