import { test, expect } from '@playwright/test';

test.describe('Single Table Query Demo - Complete Workflow', () => {
  test('Complete workflow: Select table, get AI suggestions, generate SQL, execute query', async ({ page }) => {
    // Configure for video recording with slower pace
    test.setTimeout(120000); // 2 minutes timeout

    // Helper function to add delays between steps
    const pause = async (seconds: number) => {
      await page.waitForTimeout(seconds * 1000);
    };

    console.log('🎬 Starting Single Table Query Demo Recording...');

    // Step 1: Navigate to the application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:5673');
    await pause(2);

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h4:has-text("Dashboard")').first()).toBeVisible({ timeout: 10000 });
    await pause(1);

    // Step 2: Expand Query Generator accordion (if not expanded)
    console.log('📍 Step 2: Expanding Query Generator menu...');
    const queryGenAccordion = page.locator('text=Query Generator').first();
    await queryGenAccordion.click();
    await pause(1);

    // Step 3: Click Single Table option
    console.log('📍 Step 3: Navigating to Single Table Query Generator...');
    await page.locator('text=Single Table').click();
    await pause(2);

    // Verify we're on the SQL Generator page
    await expect(page.locator('text=SQL Query Generator')).toBeVisible();
    await pause(1);

    // Step 4: Select Catalog (arao)
    console.log('📍 Step 4: Selecting catalog "arao"...');
    await page.click('label:has-text("Catalog") + div');
    await pause(1);
    await page.click('li:has-text("arao")');
    await pause(2);

    // Step 5: Select Schema (aircraft)
    console.log('📍 Step 5: Selecting schema "aircraft"...');
    await page.waitForSelector('label:has-text("Schema") + div', { state: 'visible' });
    await pause(1);
    await page.click('label:has-text("Schema") + div');
    await pause(1);
    await page.click('li:has-text("aircraft")');
    await pause(2);

    // Step 6: Select Table (aircraft_inventory)
    console.log('📍 Step 6: Selecting table "aircraft_inventory"...');
    await page.waitForSelector('label:has-text("Table") + div', { state: 'visible' });
    await pause(1);
    await page.click('label:has-text("Table") + div');
    await pause(1);
    await page.click('li:has-text("aircraft_inventory")');
    await pause(2);

    // Step 6: Select Columns
    console.log('📍 Step 6: Selecting columns...');
    await page.waitForSelector('label:has-text("Columns") + div', { state: 'visible' });
    await pause(1);
    await page.click('label:has-text("Columns") + div');
    await pause(1);

    // Select multiple columns
    await page.click('li:has-text("aircraft_id")');
    await pause(0.5);
    await page.click('li:has-text("model")');
    await pause(0.5);
    await page.click('li:has-text("status")');
    await pause(0.5);
    await page.click('li:has-text("total_flight_hours")');
    await pause(0.5);

    // Close the dropdown
    await page.keyboard.press('Escape');
    await pause(2);

    // Step 7: Select AI Model
    console.log('📍 Step 7: Selecting AI model...');
    await page.click('label:has-text("AI Model") + div');
    await pause(1);
    await page.click('li:has-text("Meta Llama 4 Maverick")');
    await pause(2);

    // Step 8: Click AI Assistant for Business Logic Suggestions
    console.log('📍 Step 8: Getting AI business logic suggestions...');
    await page.click('button[aria-label*="AI Assistant"]');
    await pause(2);

    // Wait for suggestions to load
    await expect(page.locator('text=AI-Generated Business Logic Suggestions')).toBeVisible({ timeout: 30000 });
    await pause(2);

    // Scroll to see suggestions
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        dialog.scrollTop = 100;
      }
    });
    await pause(2);

    // Step 9: Select first suggestion
    console.log('📍 Step 9: Selecting first business logic suggestion...');
    await page.click('text=Use This >> nth=0');
    await pause(2);

    // Verify business logic was populated
    await expect(page.locator('textarea[placeholder*="business logic"]')).not.toBeEmpty();
    await pause(1);

    // Step 10: Generate SQL
    console.log('📍 Step 10: Generating SQL query...');
    await page.click('button:has-text("Generate SQL Query")');
    await pause(2);

    // Wait for SQL to be generated
    await expect(page.locator('text=Generated SQL Query')).toBeVisible({ timeout: 30000 });
    await pause(2);

    // Scroll to see the generated SQL
    await page.evaluate(() => {
      const sqlSection = document.querySelector('pre');
      if (sqlSection) {
        sqlSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await pause(3);

    // Step 11: Review the SQL explanation
    console.log('📍 Step 11: Reviewing SQL explanation...');
    await pause(2);

    // Step 12: Execute the SQL query
    console.log('📍 Step 12: Executing SQL query...');
    await page.click('button:has-text("Execute Query")');
    await pause(2);

    // Wait for results to appear
    await expect(page.locator('text=Query Results')).toBeVisible({ timeout: 30000 });
    await pause(2);

    // Scroll to see the results table
    await page.evaluate(() => {
      const resultsSection = document.querySelector('text=Query Results');
      if (resultsSection) {
        const parent = resultsSection.parentElement;
        if (parent) {
          parent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
    await pause(3);

    // Step 13: Review the results
    console.log('📍 Step 13: Reviewing query results...');

    // Check for successful execution
    await expect(page.locator('text=rows')).toBeVisible();
    await pause(2);

    // Scroll through results if there are many
    await page.evaluate(() => {
      const table = document.querySelector('table');
      if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await pause(3);

    // Step 14: Final pause to show completion
    console.log('📍 Step 14: Demo complete!');
    await pause(2);

    console.log('✅ Single Table Query Demo Recording Complete!');
  });
});
