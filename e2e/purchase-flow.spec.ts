import { test, expect } from '@playwright/test';

test.describe('Purchase and Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-1',
            email: 'user@example.com',
            name: 'Test User',
          },
        }),
      });
    });

    // Mock completed generation
    await page.route('/api/generations/generation-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generation: {
            id: 'generation-1',
            creator_id: 'creator-1',
            user_id: 'test-user-1',
            mode: 'TEXT',
            status: 'COMPLETED',
            image_url: 'https://example.com/generated-image.jpg',
            creator: {
              id: 'creator-1',
              name: 'Test Creator',
              allow_third_party_stores: true,
              min_price_cents: 500,
              royalty_bps: 1000,
            },
          },
        }),
      });
    });

    // Mock stores
    await page.route('/api/store', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stores: [
              {
                id: 'store-1',
                name: 'Test Store',
                owner_id: 'test-user-1',
                description: 'A test store',
              },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            store: {
              id: 'store-1',
              name: 'Test Store',
              owner_id: 'test-user-1',
            },
          }),
        });
      }
    });

    // Mock product creation
    await page.route('/api/product', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            product: {
              id: 'product-1',
              store_id: 'store-1',
              generation_id: 'generation-1',
              creator_id: 'creator-1',
              product_type: 'POSTCARD',
              price_cents: 1000,
              status: 'ACTIVE',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            products: [
              {
                id: 'product-1',
                product_type: 'POSTCARD',
                price_cents: 1000,
                status: 'ACTIVE',
                store: {
                  id: 'store-1',
                  name: 'Test Store',
                },
                creator: {
                  id: 'creator-1',
                  name: 'Test Creator',
                },
                generation: {
                  image_url: 'https://example.com/generated-image.jpg',
                },
              },
            ],
          }),
        });
      }
    });

    // Mock checkout
    await page.route('/api/checkout', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'cs_test123',
          url: 'https://checkout.stripe.com/test',
          orderId: 'order-1',
        }),
      });
    });
  });

  test('should complete product creation flow', async ({ page }) => {
    await page.goto('/generation/generation-1/create-product');

    // Should show generation preview
    await expect(page.locator('[data-testid="generation-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="generated-image"]')).toBeVisible();

    // Should show product type options
    await expect(page.locator('[data-testid="product-type-postcard"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-type-shirt"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-type-sticker"]')).toBeVisible();

    // Select postcard
    await page.click('[data-testid="product-type-postcard"]');

    // Should show product preview
    await expect(page.locator('[data-testid="product-preview"]')).toBeVisible();

    // Set price
    await page.fill('[data-testid="product-price"]', '10.00');

    // Select store
    await page.selectOption('[data-testid="store-select"]', 'store-1');

    // Create product
    await page.click('[data-testid="create-product-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Product created successfully');

    // Should navigate to store
    await expect(page).toHaveURL('/store/store-1');
  });

  test('should validate product pricing against creator licensing', async ({ page }) => {
    await page.goto('/generation/generation-1/create-product');

    await page.click('[data-testid="product-type-postcard"]');
    
    // Try to set price below minimum
    await page.fill('[data-testid="product-price"]', '3.00'); // Below $5 minimum
    await page.selectOption('[data-testid="store-select"]', 'store-1');
    await page.click('[data-testid="create-product-button"]');

    // Should show validation error
    await expect(page.locator('[data-testid="price-error"]')).toContainText('Price must be at least $5.00');
  });

  test('should complete store browsing and purchase flow', async ({ page }) => {
    await page.goto('/stores');

    // Should show available stores
    await expect(page.locator('[data-testid="store-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="store-item-store-1"]')).toBeVisible();

    // Click on store
    await page.click('[data-testid="store-item-store-1"]');

    // Should navigate to store page
    await expect(page).toHaveURL('/store/store-1');

    // Should show store products
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-item-product-1"]')).toBeVisible();

    // Should show product details
    await expect(page.locator('[data-testid="product-name"]')).toContainText('Postcard');
    await expect(page.locator('[data-testid="product-price"]')).toContainText('$10.00');
    await expect(page.locator('[data-testid="creator-name"]')).toContainText('Test Creator');

    // Add to cart
    await page.click('[data-testid="add-to-cart-product-1"]');

    // Should show cart notification
    await expect(page.locator('[data-testid="cart-notification"]')).toContainText('Added to cart');

    // Open cart
    await page.click('[data-testid="cart-button"]');

    // Should show cart items
    await expect(page.locator('[data-testid="cart-item-product-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$10.00');

    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]');

    // Should redirect to Stripe (mocked)
    await expect(page).toHaveURL('https://checkout.stripe.com/test');
  });

  test('should handle shopping cart operations', async ({ page }) => {
    await page.goto('/store/store-1');

    // Add multiple items to cart
    await page.click('[data-testid="add-to-cart-product-1"]');
    
    // Should update cart count
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // Add same item again
    await page.click('[data-testid="add-to-cart-product-1"]');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('2');

    // Open cart
    await page.click('[data-testid="cart-button"]');

    // Should show quantity controls
    await expect(page.locator('[data-testid="quantity-input"]')).toHaveValue('2');

    // Update quantity
    await page.fill('[data-testid="quantity-input"]', '3');
    await page.click('[data-testid="update-quantity"]');

    // Should update total
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$30.00');

    // Remove item
    await page.click('[data-testid="remove-item"]');

    // Should show empty cart
    await expect(page.locator('[data-testid="empty-cart"]')).toContainText('Your cart is empty');
  });

  test('should show watermarked images before purchase', async ({ page }) => {
    await page.goto('/store/store-1');

    // Product images should be watermarked
    const productImage = page.locator('[data-testid="product-image"]');
    await expect(productImage).toHaveAttribute('src', /watermark/);

    // Preview should show watermark notice
    await page.click('[data-testid="product-item-product-1"]');
    await expect(page.locator('[data-testid="watermark-notice"]')).toContainText('Watermark will be removed after purchase');
  });

  test('should complete checkout success flow', async ({ page }) => {
    // Mock successful payment
    await page.route('/api/checkout/success', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order: {
            id: 'order-1',
            status: 'PAID',
            total_cents: 1000,
            items: [
              {
                product: {
                  id: 'product-1',
                  product_type: 'POSTCARD',
                  generation: {
                    image_url: 'https://example.com/unwatermarked-image.jpg', // No watermark
                  },
                },
                quantity: 1,
                price_cents: 1000,
              },
            ],
          },
        }),
      });
    });

    await page.goto('/checkout/success?session_id=cs_test123');

    // Should show success message
    await expect(page.locator('[data-testid="success-title"]')).toContainText('Payment Successful');
    await expect(page.locator('[data-testid="order-id"]')).toContainText('order-1');

    // Should show order details
    await expect(page.locator('[data-testid="order-total"]')).toContainText('$10.00');
    await expect(page.locator('[data-testid="order-item"]')).toContainText('Postcard');

    // Should show unwatermarked image
    const orderImage = page.locator('[data-testid="order-image"]');
    await expect(orderImage).toHaveAttribute('src', /unwatermarked/);
    await expect(orderImage).not.toHaveAttribute('src', /watermark/);

    // Should show download/access options
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible();
  });

  test('should handle payment failures gracefully', async ({ page }) => {
    await page.goto('/checkout/cancel?session_id=cs_test123');

    // Should show cancellation message
    await expect(page.locator('[data-testid="cancel-title"]')).toContainText('Payment Cancelled');
    await expect(page.locator('[data-testid="cancel-message"]')).toContainText('Your payment was cancelled');

    // Should offer to retry
    await expect(page.locator('[data-testid="retry-payment"]')).toBeVisible();
    
    // Should preserve cart
    await page.click('[data-testid="return-to-cart"]');
    await expect(page).toHaveURL(/cart/);
  });

  test('should validate licensing restrictions', async ({ page }) => {
    // Mock creator that doesn't allow third-party stores
    await page.route('/api/generations/generation-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generation: {
            id: 'generation-1',
            creator_id: 'creator-1',
            user_id: 'different-user', // Different user
            creator: {
              id: 'creator-1',
              name: 'Restricted Creator',
              allow_third_party_stores: false, // Not allowed
            },
          },
        }),
      });
    });

    await page.goto('/generation/generation-1/create-product');

    // Should show licensing restriction message
    await expect(page.locator('[data-testid="licensing-error"]')).toContainText('This creator does not allow third-party store sales');
    
    // Should disable product creation
    await expect(page.locator('[data-testid="create-product-button"]')).toBeDisabled();
  });

  test('should show royalty information', async ({ page }) => {
    await page.goto('/generation/generation-1/create-product');

    await page.click('[data-testid="product-type-postcard"]');
    await page.fill('[data-testid="product-price"]', '10.00');

    // Should show royalty breakdown
    await expect(page.locator('[data-testid="royalty-info"]')).toContainText('Creator royalty: 10%');
    await expect(page.locator('[data-testid="creator-earnings"]')).toContainText('$1.00');
    await expect(page.locator('[data-testid="store-earnings"]')).toContainText('$8.75');
    await expect(page.locator('[data-testid="platform-fee"]')).toContainText('$0.25');
  });
});