import { test, expect } from '@playwright/test';

test.describe('Simple Single Table Query Demo', () => {

  test('Complete workflow with simple selectors', async ({ page }) => {
    test.setTimeout(120000);

    console.log('🎬 Starting demo...');

    // Navigate
    await page.goto('http://localhost:5673');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');

    // Click Single Table in sidebar
    await page.getByText('Single Table', { exact: true }).click();
    await page.waitForTimeout(2000);
    console.log('✅ Navigated to SQL Generator');

    // Select Catalog - use nth(0) to get first combobox
    await page.getByRole('combobox').nth(0).click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'arao' }).click();
    await page.waitForTimeout(2000);
    console.log('✅ Catalog selected');

    // Select Schema - use nth(1) to get second combobox
    await page.getByRole('combobox').nth(1).click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'aircraft' }).click();
    await page.waitForTimeout(2000);
    console.log('✅ Schema selected');

    // Select Table - use nth(2) to get third combobox
    await page.getByRole('combobox').nth(2).click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'aircraft_inventory' }).click();
    await page.waitForTimeout(2000);
    console.log('✅ Table selected');

    // Select Columns - use nth(3) to get fourth combobox
    await page.getByRole('combobox').nth(3).click();
    await page.waitForTimeout(1000);

    // Select multiple columns
    await page.getByRole('option', { name: /aircraft_id/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: /^model/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: /^status/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('option', { name: /total_flight_hours/ }).click();
    await page.waitForTimeout(500);

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);
    console.log('✅ Columns selected');

    // Type business logic directly into the textarea
    const businessLogicTextarea = page.locator('textarea').filter({ hasText: /business logic/i }).or(page.locator('textarea[placeholder*="business logic"]')).or(page.locator('textarea').nth(0));
    await businessLogicTextarea.click();
    await page.waitForTimeout(500);
    await businessLogicTextarea.fill('What is the average total flight hours for each aircraft model that is currently mission ready?');
    await page.waitForTimeout(2000);
    console.log('✅ Entered business logic');

    // Generate SQL
    await page.getByRole('button', { name: 'Generate SQL Query' }).click();
    await page.waitForTimeout(5000);
    console.log('✅ Generating SQL...');

    // Wait for SQL to be generated
    await expect(page.getByText('Generated SQL Query')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('✅ SQL generated');

    // Execute Query
    await page.getByRole('button', { name: 'Execute Query' }).click();
    await page.waitForTimeout(3000);
    console.log('✅ Executing query...');

    // Wait for results
    await expect(page.getByText('Query Results')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('✅ Query executed successfully!');

    // Final pause
    await page.waitForTimeout(2000);
    console.log('🎉 Demo complete!');
  });
});
