import { test, expect } from '@playwright/test'

test('capture query history layout', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5673')

  // Wait for app to load
  await page.waitForTimeout(2000)

  // Click on Query History in navigation
  await page.click('text=Query History')

  // Wait for query history to load
  await page.waitForTimeout(3000)

  // Take screenshot of full page
  await page.screenshot({ path: 'query-history-full.png', fullPage: true })

  // If there are query items, expand the first one
  const firstAccordion = page.locator('.MuiAccordion-root').first()
  if (await firstAccordion.isVisible()) {
    await firstAccordion.screenshot({ path: 'query-history-first-item-collapsed.png' })

    // Click to expand
    await firstAccordion.click()
    await page.waitForTimeout(1000)

    // Take screenshot of expanded item
    await firstAccordion.screenshot({ path: 'query-history-first-item-expanded.png' })
  }

  console.log('Screenshots saved to query-history-*.png')
})
