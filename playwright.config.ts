import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Load .env.local (and other Next.js env files) so E2E tests can read
// E2E_SUPER_ADMIN_EMAIL / E2E_SUPER_ADMIN_PASSWORD etc. from the environment.
loadEnvConfig(process.cwd())

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  // The E2E suite exercises a single shared live Supabase project (orders,
  // statuses, realtime notifications). Parallel workers race on the same
  // realtime streams and can accept/see each other's orders, so run serially.
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})