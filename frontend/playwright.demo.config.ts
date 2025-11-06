import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Demo Video Recording
 * This config enables video recording for creating demo videos
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for demo
  retries: 0, // No retries for demo recording
  workers: 1, // Single worker for consistent recording

  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],

  use: {
    baseURL: 'http://localhost:5673',

    // Enable video recording for all tests
    video: 'on',

    // Video settings
    videoSize: { width: 1920, height: 1080 },

    // Slow down execution for better visibility
    launchOptions: {
      slowMo: 500, // 500ms delay between actions
    },

    // Enable trace
    trace: 'on',

    // Take screenshots at each step
    screenshot: 'on',

    // Viewport size for recording
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: 'demo-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // Don't start a server - assume it's already running
  // This allows better control over the backend and frontend
});
