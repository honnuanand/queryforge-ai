import { test, expect } from '@playwright/test';

/**
 * Test that verifies the dropdown layout in the Data Source section
 * All three dropdowns (Catalog, Schema, Table) should have equal widths
 */
test.describe('Data Source Dropdown Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the page to load - use the main heading h4
    await page.waitForSelector('h4:has-text("SQL Query Generator")');
  });

  test('dropdowns should have equal widths initially', async ({ page }) => {
    // Wait for the Data Source section to load
    await page.waitForSelector('text=1. Select Data Source');

    // Get all FormControl elements in the data source section
    const formControls = page.locator('.MuiFormControl-root').filter({
      has: page.locator('.MuiInputLabel-root')
    }).first().locator('..').locator('.MuiFormControl-root');

    // Get the first three form controls (Catalog, Schema, Table)
    const catalogDropdown = page.locator('label:has-text("Catalog")').locator('..');
    const schemaDropdown = page.locator('label:has-text("Schema")').locator('..');
    const tableDropdown = page.locator('label:has-text("Table")').locator('..');

    // Get bounding boxes
    const catalogBox = await catalogDropdown.boundingBox();
    const schemaBox = await schemaDropdown.boundingBox();
    const tableBox = await tableDropdown.boundingBox();

    expect(catalogBox).not.toBeNull();
    expect(schemaBox).not.toBeNull();
    expect(tableBox).not.toBeNull();

    if (catalogBox && schemaBox && tableBox) {
      // All dropdowns should have approximately equal widths (within 10% tolerance)
      const avgWidth = (catalogBox.width + schemaBox.width + tableBox.width) / 3;
      const tolerance = avgWidth * 0.15; // 15% tolerance

      console.log(`Catalog width: ${catalogBox.width}`);
      console.log(`Schema width: ${schemaBox.width}`);
      console.log(`Table width: ${tableBox.width}`);
      console.log(`Average width: ${avgWidth}`);

      expect(Math.abs(catalogBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(schemaBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(tableBox.width - avgWidth)).toBeLessThan(tolerance);
    }
  });

  test('dropdowns should maintain equal widths after selecting catalog and loading data', async ({ page }) => {
    // Wait for the Data Source section to load
    await page.waitForSelector('text=1. Select Data Source');

    // Click on the Catalog dropdown - use the Select element not the label
    const catalogSelect = page.locator('[role="combobox"]').first();
    await catalogSelect.click();
    await page.waitForTimeout(500);

    // Select a catalog if available
    const catalogOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await catalogOption.isVisible()) {
      await catalogOption.click();
      await page.waitForTimeout(1000);
    }

    // Get dropdown widths after selection - get the FormControl wrapper
    const formControls = page.locator('.MuiFormControl-root');
    const catalogDropdown = formControls.nth(0);
    const schemaDropdown = formControls.nth(1);
    const tableDropdown = formControls.nth(2);

    const catalogBox = await catalogDropdown.boundingBox();
    const schemaBox = await schemaDropdown.boundingBox();
    const tableBox = await tableDropdown.boundingBox();

    expect(catalogBox).not.toBeNull();
    expect(schemaBox).not.toBeNull();
    expect(tableBox).not.toBeNull();

    if (catalogBox && schemaBox && tableBox) {
      const avgWidth = (catalogBox.width + schemaBox.width + tableBox.width) / 3;
      const tolerance = avgWidth * 0.15;

      console.log(`After catalog selection:`);
      console.log(`Catalog width: ${catalogBox.width}`);
      console.log(`Schema width: ${schemaBox.width}`);
      console.log(`Table width: ${tableBox.width}`);

      expect(Math.abs(catalogBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(schemaBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(tableBox.width - avgWidth)).toBeLessThan(tolerance);
    }
  });

  test('dropdowns should maintain equal widths after sample data loads', async ({ page }) => {
    // Wait for the Data Source section to load
    await page.waitForSelector('text=1. Select Data Source');

    // Get all comboboxes
    const comboboxes = page.locator('[role="combobox"]');

    // Select catalog
    await comboboxes.nth(0).click();
    await page.waitForTimeout(500);
    const catalogOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await catalogOption.isVisible()) {
      await catalogOption.click();
      await page.waitForTimeout(1500);
    }

    // Select schema
    await comboboxes.nth(1).click();
    await page.waitForTimeout(500);
    const schemaOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await schemaOption.isVisible()) {
      await schemaOption.click();
      await page.waitForTimeout(1500);
    }

    // Select table
    await comboboxes.nth(2).click();
    await page.waitForTimeout(500);
    const tableOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await tableOption.isVisible()) {
      await tableOption.click();
      // Wait for sample data to load
      await page.waitForTimeout(5000);
    }

    // Check if Sample Data Preview appeared
    const sampleDataVisible = await page.locator('text=Sample Data Preview').isVisible();
    console.log(`Sample Data Preview visible: ${sampleDataVisible}`);

    // Get dropdown widths after sample data loads - use FormControl wrapper
    const formControls = page.locator('.MuiFormControl-root');
    const catalogDropdown = formControls.nth(0);
    const schemaDropdown = formControls.nth(1);
    const tableDropdown = formControls.nth(2);

    const catalogBox = await catalogDropdown.boundingBox();
    const schemaBox = await schemaDropdown.boundingBox();
    const tableBox = await tableDropdown.boundingBox();

    expect(catalogBox).not.toBeNull();
    expect(schemaBox).not.toBeNull();
    expect(tableBox).not.toBeNull();

    if (catalogBox && schemaBox && tableBox) {
      const avgWidth = (catalogBox.width + schemaBox.width + tableBox.width) / 3;
      const tolerance = avgWidth * 0.15;

      console.log(`After sample data loads:`);
      console.log(`Catalog width: ${catalogBox.width}`);
      console.log(`Schema width: ${schemaBox.width}`);
      console.log(`Table width: ${tableBox.width}`);
      console.log(`Average width: ${avgWidth}`);

      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/dropdown-layout-after-data.png', fullPage: true });

      expect(Math.abs(catalogBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(schemaBox.width - avgWidth)).toBeLessThan(tolerance);
      expect(Math.abs(tableBox.width - avgWidth)).toBeLessThan(tolerance);
    }
  });

  test('page should not have horizontal scroll after sample data loads', async ({ page }) => {
    // Navigate and select data
    await page.waitForSelector('text=1. Select Data Source');

    // Get all comboboxes
    const comboboxes = page.locator('[role="combobox"]');

    // Select catalog
    await comboboxes.nth(0).click();
    await page.waitForTimeout(500);
    const catalogOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await catalogOption.isVisible()) {
      await catalogOption.click();
      await page.waitForTimeout(1500);
    }

    // Select schema
    await comboboxes.nth(1).click();
    await page.waitForTimeout(500);
    const schemaOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await schemaOption.isVisible()) {
      await schemaOption.click();
      await page.waitForTimeout(1500);
    }

    // Select table
    await comboboxes.nth(2).click();
    await page.waitForTimeout(500);
    const tableOption = page.locator('.MuiMenu-list .MuiMenuItem-root').first();
    if (await tableOption.isVisible()) {
      await tableOption.click();
      await page.waitForTimeout(5000);
    }

    // Check for horizontal scrollbar on the page
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log(`Has horizontal scroll: ${hasHorizontalScroll}`);

    // Take screenshot
    await page.screenshot({ path: 'test-results/horizontal-scroll-test.png', fullPage: true });

    expect(hasHorizontalScroll).toBe(false);
  });
});
