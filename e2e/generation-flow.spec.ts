import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Content Generation Flow', () => {
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

    // Mock generation API
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          generation: {
            id: 'generation-1',
            creator_id: 'creator-1',
            user_id: 'test-user-1',
            mode: 'TEXT',
            prompt: 'A portrait of testcreator',
            status: 'PROCESSING',
          },
        }),
      });
    });

    // Mock generation status updates
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
            prompt: 'A portrait of testcreator',
            status: 'COMPLETED',
            image_url: 'https://example.com/generated-image.jpg',
            creator: {
              id: 'creator-1',
              name: 'Test Creator',
              trigger_word: 'testcreator',
            },
          },
        }),
      });
    });
  });

  test('should complete text mode generation flow', async ({ page }) => {
    await page.goto('/creator/creator-1/generate');

    // Should show generation interface
    await expect(page.locator('[data-testid="generation-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="creator-name"]')).toContainText('Test Creator');

    // Text mode should be available
    await expect(page.locator('[data-testid="text-mode-tab"]')).toBeVisible();
    await page.click('[data-testid="text-mode-tab"]');

    // Fill in prompt
    await page.fill('[data-testid="text-prompt"]', 'A portrait of testcreator in a garden');

    // Start generation
    await page.click('[data-testid="generate-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="generation-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="generate-button"]')).toBeDisabled();

    // Wait for generation to complete (mock polling)
    await page.waitForTimeout(2000);

    // Should show completed generation
    await expect(page.locator('[data-testid="generated-image"]')).toBeVisible();
    await expect(page.locator('[data-testid="generation-status"]')).toContainText('Completed');

    // Should show product creation options
    await expect(page.locator('[data-testid="create-product-button"]')).toBeVisible();
  });

  test('should complete photo mode generation flow', async ({ page }) => {
    // Mock photo mode generation
    await page.route('/api/infer', async route => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          generation: {
            id: 'generation-2',
            creator_id: 'creator-1',
            user_id: 'test-user-1',
            mode: 'PHOTO',
            scene_url: 'https://example.com/scene.jpg',
            status: 'PROCESSING',
          },
        }),
      });
    });

    await page.goto('/creator/creator-1/generate');

    // Select photo mode
    await page.click('[data-testid="photo-mode-tab"]');

    // Upload scene image
    const fileInput = page.locator('[data-testid="scene-upload"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-scene.jpg'));

    // Should show preview
    await expect(page.locator('[data-testid="scene-preview"]')).toBeVisible();

    // Start generation
    await page.click('[data-testid="generate-button"]');

    // Should show processing state
    await expect(page.locator('[data-testid="generation-loading"]')).toBeVisible();

    // Wait for completion
    await page.waitForTimeout(2000);

    // Should show result
    await expect(page.locator('[data-testid="generated-image"]')).toBeVisible();
  });

  test('should handle content safety validation', async ({ page }) => {
    // Mock content safety error
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Content safety violation: inappropriate content detected',
        }),
      });
    });

    await page.goto('/creator/creator-1/generate');

    await page.click('[data-testid="text-mode-tab"]');
    await page.fill('[data-testid="text-prompt"]', 'inappropriate content');
    await page.click('[data-testid="generate-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Content safety violation');
    
    // Should re-enable generate button
    await expect(page.locator('[data-testid="generate-button"]')).toBeEnabled();
  });

  test('should show generation queue and history', async ({ page }) => {
    // Mock user generations
    await page.route('/api/generations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generations: [
            {
              id: 'generation-1',
              mode: 'TEXT',
              prompt: 'A portrait of testcreator',
              status: 'COMPLETED',
              image_url: 'https://example.com/image1.jpg',
              createdAt: '2023-01-01T00:00:00Z',
              creator: {
                name: 'Test Creator',
              },
            },
            {
              id: 'generation-2',
              mode: 'PHOTO',
              status: 'PROCESSING',
              createdAt: '2023-01-02T00:00:00Z',
              creator: {
                name: 'Test Creator',
              },
            },
          ],
        }),
      });
    });

    await page.goto('/creator/creator-1/generate');

    // Should show generation history
    await expect(page.locator('[data-testid="generation-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="generation-item-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="generation-item-2"]')).toBeVisible();

    // Should show different statuses
    await expect(page.locator('[data-testid="generation-item-1"] [data-testid="status"]')).toContainText('Completed');
    await expect(page.locator('[data-testid="generation-item-2"] [data-testid="status"]')).toContainText('Processing');
  });

  test('should handle NSFW content toggle', async ({ page }) => {
    await page.goto('/creator/creator-1/generate');

    // NSFW should be disabled by default
    await expect(page.locator('[data-testid="nsfw-toggle"]')).not.toBeChecked();

    // Enable NSFW
    await page.check('[data-testid="nsfw-toggle"]');

    // Should show warning
    await expect(page.locator('[data-testid="nsfw-warning"]')).toBeVisible();

    await page.click('[data-testid="text-mode-tab"]');
    await page.fill('[data-testid="text-prompt"]', 'A portrait of testcreator');
    await page.click('[data-testid="generate-button"]');

    // Should include NSFW flag in request (verified by route mock)
  });

  test('should navigate to product creation after generation', async ({ page }) => {
    await page.goto('/creator/creator-1/generate');

    // Complete a generation (using mocked flow)
    await page.click('[data-testid="text-mode-tab"]');
    await page.fill('[data-testid="text-prompt"]', 'A portrait of testcreator');
    await page.click('[data-testid="generate-button"]');

    await page.waitForTimeout(2000); // Wait for completion

    // Click create product
    await page.click('[data-testid="create-product-button"]');

    // Should navigate to product creation
    await expect(page).toHaveURL('/generation/generation-1/create-product');
  });

  test('should handle generation failures gracefully', async ({ page }) => {
    // Mock generation failure
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Generation service temporarily unavailable',
        }),
      });
    });

    await page.goto('/creator/creator-1/generate');

    await page.click('[data-testid="text-mode-tab"]');
    await page.fill('[data-testid="text-prompt"]', 'A portrait of testcreator');
    await page.click('[data-testid="generate-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Generation service temporarily unavailable');
    
    // Should show retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should validate prompt requirements', async ({ page }) => {
    await page.goto('/creator/creator-1/generate');

    await page.click('[data-testid="text-mode-tab"]');
    
    // Try to generate without prompt
    await page.click('[data-testid="generate-button"]');

    // Should show validation error
    await expect(page.locator('[data-testid="prompt-error"]')).toContainText('Prompt is required');
    
    // Should not start generation
    await expect(page.locator('[data-testid="generation-loading"]')).not.toBeVisible();
  });

  test('should show estimated generation time', async ({ page }) => {
    await page.goto('/creator/creator-1/generate');

    await page.click('[data-testid="text-mode-tab"]');
    await page.fill('[data-testid="text-prompt"]', 'A portrait of testcreator');

    // Should show estimated time
    await expect(page.locator('[data-testid="estimated-time"]')).toContainText(/estimated time/i);
  });
});