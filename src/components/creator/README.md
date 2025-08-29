# Creator LoRA Training System

This directory contains the implementation of the Creator LoRA training system for the Cameo Ecosystem.

## Components

### Core Components

1. **CreatorProfileForm** (`creator-profile-form.tsx`)
   - Main form for creating and editing creator profiles
   - Handles basic information, licensing settings, and training images
   - Integrates consent validation and image upload

2. **ImageUpload** (`image-upload.tsx`)
   - Handles multiple image upload with validation
   - Supports drag-and-drop and file selection
   - Validates file types, sizes, and count (5-15 images)
   - Shows image previews with removal capability

3. **ConsentForm** (`consent-form.tsx`)
   - Comprehensive consent validation for LoRA training
   - Covers image ownership, licensing rights, commercial use, and content responsibility
   - Requires explicit acknowledgment of all terms

4. **CreatorDashboard** (`creator-dashboard.tsx`)
   - Displays creator profile and LoRA training status
   - Shows real-time training progress and status updates
   - Provides licensing configuration overview
   - Displays training images gallery

### Services

1. **Creator Service** (`../lib/creator-service.ts`)
   - Database operations for creator management
   - CRUD operations with Prisma ORM
   - LoRA status tracking and updates

2. **Image Upload Service** (`../lib/image-upload.ts`)
   - Image validation (type, size, dimensions)
   - S3 upload handling for training images
   - Async validation with proper error handling

3. **FAL Service** (`../lib/fal-service.ts`)
   - Integration with FAL AI for LoRA training
   - Job submission and status checking
   - Webhook payload processing

### API Endpoints

1. **Creator API** (`../app/api/creator/route.ts`)
   - POST: Create new creator with LoRA training
   - PUT: Update existing creator profile
   - Handles image upload and FAL job submission

2. **Creator Status API** (`../app/api/creator/[id]/status/route.ts`)
   - GET: Get current creator and LoRA status
   - POST: Refresh status from FAL API

3. **FAL Webhook** (`../app/api/webhooks/fal/route.ts`)
   - Handles FAL training completion webhooks
   - Updates creator status and LoRA URLs
   - Error handling and logging

### Pages

1. **New Creator** (`../app/creator/new/page.tsx`)
   - Creator registration and onboarding flow

2. **Creator Dashboard** (`../app/creator/[id]/page.tsx`)
   - Individual creator profile and status view

3. **Edit Creator** (`../app/creator/[id]/edit/page.tsx`)
   - Creator profile editing interface

## Features Implemented

### Sub-task 3.1: Creator Profile & Onboarding
- ✅ Creator model with LoRA status tracking (Prisma schema)
- ✅ Image upload interface with consent validation
- ✅ Creator profile management UI
- ✅ Licensing configuration (royalty rates, pricing limits)
- ✅ Training image gallery and management

### Sub-task 3.2: FAL AI Integration
- ✅ `/api/creator` endpoint for training job submission
- ✅ FAL webhook handler for training completion
- ✅ LoRA status tracking and error handling
- ✅ Automatic trigger word generation
- ✅ Status refresh functionality

## Database Schema Updates

Added fields to Creator model:
- `training_images: String[]` - Array of S3 URLs for training images
- `consent_given: Boolean` - Explicit consent flag
- `fal_job_id: String?` - FAL training job identifier

## Requirements Satisfied

- **Requirement 1.1**: Creator LoRA training with 5-15 images ✅
- **Requirement 1.2**: FAL integration with webhook handling ✅
- **Requirement 1.3**: Consent validation and image ownership ✅
- **Requirement 8.1**: External API integration (FAL) ✅

## Testing

- Unit tests for Creator service (`../lib/__tests__/creator-service.test.ts`)
- Covers CRUD operations, status updates, and data validation
- All tests passing ✅

## Next Steps

The Creator LoRA training system is now ready for:
1. Integration with content generation system (Task 4)
2. Connection to merchandise system (Task 5)
3. Stripe Connect onboarding (Task 7.1)
4. Production deployment with real FAL API keys

## Usage

1. Navigate to `/creator/new` to create a new creator profile
2. Upload 5-15 training images and provide consent
3. Configure licensing terms (royalty rate, pricing limits)
4. Submit to start LoRA training via FAL AI
5. Monitor training progress on creator dashboard
6. Once ready, LoRA can be used for content generation