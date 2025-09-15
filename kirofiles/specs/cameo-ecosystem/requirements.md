# Requirements Document

## Introduction

The **Cameo Ecosystem** SHALL allow fans to generate creator-branded 2D content via LoRA, and turn any part of that content into physical merchandise (postcards, shirts, figurines), available through curated storefronts that honor licensing and royalty agreements.

### Judge Alignment
- **Implementation:** Full-stack architecture (Next.js + Prisma), Kiro spec-driven dev + MCP integrations.
- **UX:** Photo and Text generation workflows, watermark until purchase, mobile-responsive UI.
- **Impact:** Empowers creator economy through tangible products.
- **Originality:** LoRA personalization + physical merch + licensing + open stores.

---

## Requirements

### Requirement 1: Creator LoRA Training  
**User Story:** As a **Creator**, I SHALL upload 5–15 images (with explicit consent) to train a branded LoRA via FAL, so fans can generate on-brand content.

**Acceptance Criteria:**
1. WHEN a Creator uploads images with consent THEN the system SHALL POST to `/api/creator` and queue a FAL training job using the [`fal-ai/flux-lora-fast-training`](https://fal.ai/models/fal-ai/flux-lora-fast-training) endpoint.  
2. WHEN FAL training completes THEN the system SHALL receive a webhook and update `creator.lora_url`.  
3. WHEN the LoRA is ready THEN the Creator page SHALL display trigger word and "LoRA Ready" status.  
4. IF training fails THEN the system SHALL notify the Creator and provide a retry option.

**Default seeded LoRA URL:**  
`https://storage.googleapis.com/fal-flux-lora/97e6cffdacef4a2eb9848c2e29d6c143_lora.safetensors`

---

### Requirement 2: Fan 2D Generation (Photo / Text)  
**User Story:** As a **Fan**, I SHALL generate 2D images using Creator LoRAs via both Photo and Text modes to produce personalized, on-brand outputs.

**Acceptance Criteria:**
1. WHEN using **Photo Mode** THEN the system SHALL accept an uploaded or linked scene and call Replicate Kontext LoRA via `POST https://api.replicate.com/v1/predictions` with model [`black-forest-labs/flux-kontext-dev-lora`](https://replicate.com/black-forest-labs/flux-kontext-dev-lora).  
2. WHEN using **Text Mode** THEN the system SHALL send prompt and `lora_weights` to the same endpoint to generate brand-aligned output.  
3. WHEN generation is triggered THEN the system SHALL POST to `/api/infer` or `/api/generate` and queue a job.  
4. WHEN generation completes THEN the system SHALL receive a webhook, store `image_url`, and display it along with a **"Send Postcard"** option.

---

### Requirement 3: Merchandise Productization  
**User Story:** As a **Fan**, I SHALL transform generated images into real-world merchandise like postcards, shirts, and figurines.

**Acceptance Criteria:**
1. WHEN a generated image is available THEN the system SHALL offer merchandise templates (e.g., postcard, shirt, figurine).  
2. WHEN a product is selected THEN the system SHALL render a preview with the image applied to that product.  
3. IF the image doesn’t meet product specifications THEN the system SHALL suggest adjustments or alternative formats.

---

### Requirement 4: Stores & Licensing  
**User Story:** As any **User**, I SHALL open a store and curate products from Creator-generated content, while respecting Creator licensing.

**Acceptance Criteria:**
1. WHEN a Creator sets licensing THEN the system SHALL store `allow_third_party_stores`, `royalty_bps`, `min_price_cents`, `max_discount_bps`.  
2. WHEN creating store listings THEN the system SHALL reference Creator’s LoRA and source image.  
3. WHEN a listing is created THEN the system SHALL enforce licensing policy (e.g. pricing, royalty).  
4. WHEN a product is purchased THEN the system SHALL execute a Stripe Connect destination charge, distributing royalties to Creator and fees to platform.

---

### Requirement 5: Seamless Checkout Flow  
**User Story:** As a **Fan**, I SHALL checkout smoothly and see watermarks removed after payment.

**Acceptance Criteria:**
1. WHEN proceeding to checkout THEN the system SHALL POST to `/api/checkout` and create a Stripe Checkout session.  
2. WHEN payment completes THEN the system SHALL handle a webhook and mark the order as **paid**.  
3. WHEN the order is paid THEN the system SHALL remove the watermark.  
4. WHEN checkout finishes THEN the system SHALL display order confirmation.

---

### Requirement 6: Guardrails & UI Flow  
**User Story:** As a **Platform User**, I SHALL experience a safe and intuitive workflow from landing to purchase.

**Acceptance Criteria:**
1. WHEN uploading content THEN the system SHALL require explicit consent.  
2. WHEN generating content THEN the system SHALL default **NSFW** to **OFF** and block blacklisted keywords (e.g. celebrity names or logos).  
3. WHEN displaying generated content THEN the system SHALL watermark until purchase.  
4. WHEN using the app THEN the flow SHALL be: **Landing → Creator → Generation → Merchandise Preview → Store → Checkout**.

---

### Requirement 7: Creator Licensing & Revenue Control  
**User Story:** As a **Creator**, I SHALL control licensing terms and receive royalties from LoRA-powered products.

**Acceptance Criteria:**
1. WHEN creating my Creator profile THEN I SHALL configure licensing (enable stores, set royalty%, pricing limits).  
2. WHEN fans generate content with my LoRA THEN the system SHALL track usage and sales.  
3. WHEN products are sold THEN the system SHALL compute and distribute royalties per licensing terms.  
4. WHEN licensing is violated THEN the system SHALL block the transaction and notify me.

---

### Requirement 8: API Integration & Webhooks  
**System Story:** The **Platform** SHALL integrate reliably with external AI and payment services to support generation and payment workflows.

**Acceptance Criteria:**
1. WHEN using **FAL** for LoRA training THEN the system SHALL enqueue jobs via [`fal-ai/flux-lora-fast-training`](https://fal.ai/models/fal-ai/flux-lora-fast-training) and handle webhook results.  
2. WHEN using **Replicate** for Photo/Text generation THEN the system SHALL POST to `https://api.replicate.com/v1/predictions` with model [`black-forest-labs/flux-kontext-dev-lora`](https://replicate.com/black-forest-labs/flux-kontext-dev-lora) and process result via webhook.  
3. WHEN handling transactions THEN the system SHALL use **Stripe Connect** destination charges and handle webhook updates.

---

## Summary  
This document is formatted for Kiro’s spec-driven workflow and includes precise "SHALL" wording, explicit FAL and Replicate URLs, and the default LoRA `.safetensors`. It’s ready for implementation and submission.