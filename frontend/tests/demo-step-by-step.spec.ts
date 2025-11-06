import { test, expect } from '@playwright/test';

test.describe('Single Table Query Demo - Incremental Build', () => {

  // Test 1: Just load the page
  test('Step 1: Load application', async ({ page }) => {
    console.log('✅ Test 1: Loading application');
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');

    // Check something exists on the page
    await expect(page.locator('button, a, h1, h2, h3, h4').first()).toBeVisible();
    console.log('✅ Application loaded successfully');
  });

  // Test 2: Navigate to Single Table Generator
  test('Step 2: Navigate to SQL Generator', async ({ page }) => {
    console.log('✅ Test 2: Navigating to SQL Generator');
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');

    // Click Single Table in the sidebar
    await page.locator('text=Single Table').click();
    await page.waitForTimeout(1000);

    // Verify we see SQL Query Generator heading
    await expect(page.locator('h4, h5, h6').filter({ hasText: 'SQL Query Generator' }).first()).toBeVisible();
    console.log('✅ Successfully navigated to SQL Generator');
  });

  // Test 3: Select catalog
  test('Step 3: Select catalog', async ({ page }) => {
    console.log('✅ Test 3: Selecting catalog');
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Single Table').click();
    await page.waitForTimeout(1000);

    // Click catalog dropdown
    const catalogLabel = page.locator('label:has-text("Catalog")');
    await expect(catalogLabel).toBeVisible();
    const catalogDropdown = catalogLabel.locator('..').locator('div[role="button"]').first();
    await catalogDropdown.click();
    await page.waitForTimeout(500);

    // Select arao
    await page.locator('li:has-text("arao")').first().click();
    await page.waitForTimeout(1000);

    console.log('✅ Catalog selected successfully');
  });

  // Test 4: Select schema
  test('Step 4: Select schema', async ({ page }) => {
    console.log('✅ Test 4: Selecting schema');
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Single Table').click();
    await page.waitForTimeout(1000);

    // Select catalog
    const catalogLabel = page.locator('label:has-text("Catalog")');
    const catalogDropdown = catalogLabel.locator('..').locator('div[role="button"]').first();
    await catalogDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('li:has-text("arao")').first().click();
    await page.waitForTimeout(2000); // Wait for schema dropdown to populate

    // Select schema
    const schemaLabel = page.locator('label:has-text("Schema")');
    await expect(schemaLabel).toBeVisible();
    const schemaDropdown = schemaLabel.locator('..').locator('div[role="button"]').first();
    await schemaDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('li:has-text("aircraft")').first().click();
    await page.waitForTimeout(1000);

    console.log('✅ Schema selected successfully');
  });

  // Test 5: Select table
  test('Step 5: Select table', async ({ page }) => {
    console.log('✅ Test 5: Selecting table');
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Single Table').click();
    await page.waitForTimeout(1000);

    // Select catalog
    const catalogLabel = page.locator('label:has-text("Catalog")');
    const catalogDropdown = catalogLabel.locator('..').locator('div[role="button"]').first();
    await catalogDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('li:has-text("arao")').first().click();
    await page.waitForTimeout(2000);

    // Select schema
    const schemaLabel = page.locator('label:has-text("Schema")');
    const schemaDropdown = schemaLabel.locator('..').locator('div[role="button"]').first();
    await schemaDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('li:has-text("aircraft")').first().click();
    await page.waitForTimeout(2000); // Wait for table dropdown to populate

    // Select table
    const tableLabel = page.locator('label:has-text("Table")');
    await expect(tableLabel).toBeVisible();
    const tableDropdown = tableLabel.locator('..').locator('div[role="button"]').first();
    await tableDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('li:has-text("aircraft_inventory")').first().click();
    await page.waitForTimeout(1000);

    console.log('✅ Table selected successfully');
  });
});
