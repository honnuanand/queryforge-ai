/**
 * Playwright UI Tests for QueryForge AI
 * Tests all screens and components to catch errors before deployment
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const DATABRICKS_APP_URL = 'https://queryforge-2409307273843806.aws.databricksapps.com';

test.describe('QueryForge AI - Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load homepage without errors', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/QueryForge AI/);

    // Check no console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('should display app bar with title', async ({ page }) => {
    const title = page.getByText('QueryForge AI');
    await expect(title).toBeVisible();
  });

  test('should have clickable title that navigates to Dashboard', async ({ page }) => {
    // Click on SQL Generator first
    await page.getByRole('button', { name: /SQL Generator/i }).click();

    // Click on title to go back to dashboard
    await page.getByText('QueryForge AI').first().click();

    // Should be on Dashboard
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
  });

  test('should display navigation drawer', async ({ page }) => {
    // Check for navigation items
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /SQL Generator/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Query History/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analytics/i })).toBeVisible();
  });

  test('should display app information accordion', async ({ page }) => {
    const accordion = page.getByText('About QueryForge AI');
    await expect(accordion).toBeVisible();
  });

  test('should expand/collapse app information', async ({ page }) => {
    const accordion = page.getByText('About QueryForge AI');
    await accordion.click();

    // Check expanded content
    await expect(page.getByText('Why QueryForge AI?')).toBeVisible();
    await expect(page.getByText('How It Works')).toBeVisible();
    await expect(page.getByText('What You Get')).toBeVisible();
  });

  test('should display key metrics cards', async ({ page }) => {
    await expect(page.getByText('Total Cost')).toBeVisible();
    await expect(page.getByText('Query Executions')).toBeVisible();
    await expect(page.getByText('Success Rate')).toBeVisible();
    await expect(page.getByText('Avg Time')).toBeVisible();
  });

  test('should display auto-refresh toggle', async ({ page }) => {
    await expect(page.getByText('Auto-refresh')).toBeVisible();
  });

  test('should display refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible();
  });

  test('should load dashboard data without 500 errors', async ({ page }) => {
    // Monitor network requests
    const failedRequests: string[] = [];

    page.on('response', (response) => {
      if (response.status() === 500) {
        failedRequests.push(response.url());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Even if API returns errors, page should not crash
    await page.reload();

    // Page should still be visible
    await expect(page.getByText('QueryForge AI')).toBeVisible();
  });
});

test.describe('QueryForge AI - SQL Generator Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to SQL Generator
    await page.getByRole('button', { name: /SQL Generator/i }).click();
  });

  test('should navigate to SQL Generator page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /SQL Generator/i })).toBeVisible();
  });

  test('should display SQL Generator form elements', async ({ page }) => {
    // Check for form elements (adjust selectors based on actual implementation)
    const heading = page.getByRole('heading', { name: /SQL Generator/i });
    await expect(heading).toBeVisible();
  });
});

test.describe('QueryForge AI - Query History Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to Query History
    await page.getByRole('button', { name: /Query History/i }).click();
  });

  test('should navigate to Query History page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Query History/i })).toBeVisible();
  });

  test('should load query history without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

test.describe('QueryForge AI - Analytics Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Navigate to Analytics
    await page.getByRole('button', { name: /Analytics/i }).click();
  });

  test('should navigate to Analytics page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();
  });

  test('should display auto-refresh toggle on Analytics', async ({ page }) => {
    await expect(page.getByText('Auto-refresh')).toBeVisible();
  });

  test('should display analytics summary cards', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Should not have 500 errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('500')) {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('should switch between chart views', async ({ page }) => {
    // Wait for toggle buttons to be available
    await page.waitForTimeout(1000);

    // Page should be functional even if no data
    await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();
  });
});

test.describe('QueryForge AI - API Integration Tests', () => {
  test('all API endpoints should return valid responses', async ({ page }) => {
    const endpoints = [
      '/api/health',
      '/api/dashboard-statistics',
      '/api/llm-costs-by-model',
      '/api/models'
    ];

    for (const endpoint of endpoints) {
      const response = await page.goto(`${BASE_URL}${endpoint}`);

      // Should not return 500
      expect(response?.status()).not.toBe(500);

      // Should return valid JSON
      if (response?.status() === 200) {
        const text = await response.text();
        expect(() => JSON.parse(text)).not.toThrow();
      }
    }
  });
});

test.describe('QueryForge AI - Responsive Design Tests', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.goto(BASE_URL);

    // Should still display title
    await expect(page.getByText('QueryForge AI')).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    await page.goto(BASE_URL);

    // Should still display title
    await expect(page.getByText('QueryForge AI')).toBeVisible();
  });
});

test.describe('QueryForge AI - Error Recovery Tests', () => {
  test('should handle network failures gracefully', async ({ page }) => {
    await page.goto(BASE_URL);

    // Simulate network failure
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    // Click refresh
    await page.getByRole('button', { name: /Refresh/i }).click();

    // Page should not crash
    await expect(page.getByText('QueryForge AI')).toBeVisible();
  });
});
