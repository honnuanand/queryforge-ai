#!/usr/bin/env python3
"""
Script to capture screenshots of Query History page
"""
from playwright.sync_api import sync_playwright
import time

def capture_query_history():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        # Navigate to the app
        page.goto('http://localhost:5673')
        time.sleep(2)

        # Click on Query History
        page.click('text=Query History')
        time.sleep(3)

        # Take full page screenshot
        page.screenshot(path='query-history-full.png', full_page=True)
        print("Saved: query-history-full.png")

        # Find and screenshot first accordion
        accordions = page.locator('.MuiAccordion-root')
        if accordions.count() > 0:
            first_accordion = accordions.first
            first_accordion.screenshot(path='query-history-first-item-collapsed.png')
            print("Saved: query-history-first-item-collapsed.png")

            # Click to expand
            first_accordion.click()
            time.sleep(1)

            # Screenshot expanded
            first_accordion.screenshot(path='query-history-first-item-expanded.png')
            print("Saved: query-history-first-item-expanded.png")

        browser.close()
        print("\nScreenshots captured successfully!")

if __name__ == "__main__":
    capture_query_history()
