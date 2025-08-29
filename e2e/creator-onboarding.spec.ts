import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Creator Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('/api/auth/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-1',
            email: 'creator@example.com',
            name: 'Test Creator',
          },
        }),
      });
    });

    // Mock FAL API calls
    await page.route('/api/creator', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            creator: {
              id: 'creator-1',
              name: 'Test Creator',
              email: 'creator@example.com',
              status: 'TRAINING',
              allow_third_party_stores: true,
              royalty_bps: 1000,
              min_price_cents: 500,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            creators: [
              {
                id: 'creator-1',
                name: 'Test Creator',
                status: 'READY',
                lora_url: 'https://example.com/lora.safetensors',
                trigger_word: 'testcreator',
              },
            ],
          }),
        });
      }
    });
  });

  test('should complete creator onboarding flow', async ({ page }) => {
    // Navigate to creator creation page
    await page.goto('/creator/new');

    // Fill out creator profile form
    await page.fill('[data-testid="creator-name"]', 'Test Creator');
    
    // Upload images (mock file upload)
    const fileInput = page.locator('[data-testid="image-upload"]');
    
    // Create mock files for upload
    const testImages = Array.from({ length: 5 }, (_, i) => 
      path.join(__dirname, 'fixtures', `test-image-${i + 1}.jpg`)
    );
    
    await fileInput.setInputFiles(testImages);

    // Accept consent
    await page.check('[data-testid="consent-checkbox"]');

    // Configure licensing
    await page.check('[data-testid="allow-third-party-stores"]');
    await page.fill('[data-testid="royalty-percentage"]', '10');
    await page.fill('[data-testid="minimum-price"]', '5.00');

    // Submit form
    await page.click('[data-testid="submit-creator-form"]');

    // Should redirect to creator profile page
    await expect(page).toHaveURL('/creator/creator-1');

    // Should show training status
    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Training');
    
    // Should show creator details
    await expect(page.locator('[data-testid="creator-name"]')).toContainText('Test Creator');
    await expect(page.locator('[data-testid="royalty-rate"]')).toContainText('10%');
    await expect(page.locator('[data-testid="minimum-price"]')).toContainText('$5.00');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/creator/new');

    // Try to submit without filling required fields
    await page.click('[data-testid="submit-creator-form"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Creator name is required');
    await expect(page.locator('[data-testid="images-error"]')).toContainText('At least 5 images are required');
    await expect(page.locator('[data-testid="consent-error"]')).toContainText('Consent is required');
  });

  test('should validate image requirements', async ({ page }) => {
    await page.goto('/creator/new');

    await page.fill('[data-testid="creator-name"]', 'Test Creator');

    // Upload insufficient number of images
    const fileInput = page.locator('[data-testid="image-upload"]');
    const insufficientImages = [
      path.join(__dirname, 'fixtures', 'test-image-1.jpg'),
      path.join(__dirname, 'fixtures', 'test-image-2.jpg'),
    ];
    
    await fileInput.setInputFiles(insufficientImages);
    await page.check('[data-testid="consent-checkbox"]');
    await page.click('[data-testid="submit-creator-form"]');

    await expect(page.locator('[data-testid="images-error"]')).toContainText('At least 5 images are required');
  });

  test('should show LoRA training progress', async ({ page }) => {
    // Mock webhook to simulate training completion
    await page.route('/api/webhooks/fal', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock creator status update
    await page.route('/api/creator/creator-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
            status: 'READY',
            lora_url: 'https://example.com/lora.safetensors',
            trigger_word: 'testcreator_12345678',
          },
        }),
      });
    });

    await page.goto('/creator/creator-1');

    // Initially should show training status
    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Training');

    // Simulate training completion (could be done via WebSocket or polling)
    await page.waitForTimeout(2000); // Simulate training time

    // Should update to ready status
    await page.reload();
    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Ready');
    await expect(page.locator('[data-testid="trigger-word"]')).toContainText('testcreator_12345678');
  });

  test('should handle training failures gracefully', async ({ page }) => {
    // Mock failed training
    await page.route('/api/creator/creator-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
            status: 'FAILED',
            lora_url: null,
            trigger_word: null,
          },
        }),
      });
    });

    await page.goto('/creator/creator-1');

    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Failed');
    await expect(page.locator('[data-testid="retry-training"]')).toBeVisible();
    
    // Should be able to retry training
    await page.click('[data-testid="retry-training"]');
    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Training');
  });

  test('should navigate to generation interface when ready', async ({ page }) => {
    // Mock ready creator
    await page.route('/api/creator/creator-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          creator: {
            id: 'creator-1',
            name: 'Test Creator',
            status: 'READY',
            lora_url: 'https://example.com/lora.safetensors',
            trigger_word: 'testcreator',
          },
        }),
      });
    });

    await page.goto('/creator/creator-1');

    await expect(page.locator('[data-testid="creator-status"]')).toContainText('Ready');
    
    // Should show generate button
    await expect(page.locator('[data-testid="start-generating"]')).toBeVisible();
    
    // Click to start generating
    await page.click('[data-testid="start-generating"]');
    
    // Should navigate to generation interface
    await expect(page).toHaveURL('/creator/creator-1/generate');
  });
});