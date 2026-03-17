import { defineConfig } from '@playwright/test'

const testPort = 3100
const baseURL = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  outputDir: 'output/playwright',
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm --filter @rip/web exec vite --host 127.0.0.1 --port 3100 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
