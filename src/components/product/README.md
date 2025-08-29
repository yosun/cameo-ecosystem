# Product Components

This directory contains components for the merchandise system that allows users to transform generated images into physical products.

## Components

### ProductCreationWizard
A multi-step wizard that guides users through creating products from generated images.

**Features:**
- Product type selection (postcard, shirt, sticker, leggings, figurine)
- Customization options (size, color, placement)
- Real-time preview generation
- Product validation and specification checking
- Price calculation with customization costs

**Usage:**
```tsx
<ProductCreationWizard
  generationId="gen_123"
  imageUrl="https://example.com/image.jpg"
  storeId="store_456"
  onProductCreated={(product) => console.log('Created:', product)}
  onCancel={() => console.log('Cancelled')}
/>
```

### ProductManagementDashboard
A dashboard for managing existing products in a store.

**Features:**
- Product listing with filters
- Status management (active, inactive, out of stock)
- Product preview display
- Bulk operations
- Sales analytics integration

**Usage:**
```tsx
<ProductManagementDashboard
  storeId="store_123"
  creatorId="creator_456" // optional
/>
```

### ProductValidator
A component that validates images and settings for product creation.

**Features:**
- Image dimension and format validation
- File size checking
- Product-specific requirement validation
- Real-time validation feedback
- Suggestions for improvement

**Usage:**
```tsx
<ProductValidator
  imageUrl="https://example.com/image.jpg"
  productType={ProductType.SHIRT}
  customizations={{ size: 'L', color: 'black' }}
  onValidationChange={(isValid, errors) => {
    console.log('Valid:', isValid, 'Errors:', errors);
  }}
/>
```

## Product Templates

The system supports the following product types:

### Postcard
- **Dimensions:** 6" × 4"
- **Min Resolution:** 1800 × 1200 px
- **Base Price:** $2.99
- **Formats:** JPG, PNG

### T-Shirt
- **Dimensions:** 12" × 16" print area
- **Min Resolution:** 2400 × 3200 px
- **Base Price:** $19.99
- **Sizes:** S, M, L, XL, XXL
- **Colors:** White, Black, Navy, Gray

### Sticker
- **Dimensions:** 3" × 3"
- **Min Resolution:** 900 × 900 px
- **Base Price:** $1.99
- **Formats:** JPG, PNG

### Leggings
- **Dimensions:** 14" × 40" print area
- **Min Resolution:** 2800 × 8000 px
- **Base Price:** $29.99
- **Sizes:** XS, S, M, L, XL

### Figurine
- **Dimensions:** 4" × 6"
- **Min Resolution:** 1024 × 1024 px
- **Base Price:** $49.99
- **Sizes:** 4", 6", 8"

## API Endpoints

### Product Creation
```
POST /api/product
```
Creates a new product from a generation.

### Product Management
```
GET /api/product?storeId=123&productType=SHIRT
PATCH /api/product/[id]
DELETE /api/product/[id]
```

### Product Preview
```
GET /api/product/preview?image=url&type=SHIRT&size=L
```
Generates a product preview with the applied image.

## Validation Rules

### Image Requirements
- **Resolution:** Must meet minimum requirements for each product type
- **File Size:** Maximum varies by product (5-25 MB)
- **Format:** JPG, PNG supported
- **Aspect Ratio:** Recommendations vary by product type

### Pricing Rules
- Must respect creator's minimum price settings
- Customizations add to base price
- Maximum discount limits enforced

### Licensing Compliance
- Creator royalty rates automatically applied
- Third-party store permissions checked
- Content policy validation

## Integration Points

### Generation System
Products are created from completed generations that have image URLs.

### Store System
Products belong to stores and respect store owner permissions.

### Creator Licensing
All products respect creator licensing terms and royalty settings.

### Payment System
Product pricing integrates with Stripe Connect for multi-party payments.

## Future Enhancements

- **3D Preview:** Real-time 3D product visualization
- **Bulk Operations:** Create multiple products from batch generations
- **Template Customization:** Allow stores to create custom product templates
- **Print Quality Analysis:** AI-powered print quality assessment
- **Inventory Management:** Real-time stock tracking and fulfillment integration