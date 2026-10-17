import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, E2E_ENV } from "./e2e/env";

/**
 * End-to-end tests: `npm run test:e2e`.
 * Needs Postgres and an S3-compatible store (MinIO locally). The suite uses its own database,
 * bucket and port (see e2e/env.ts); e2e/serve.mjs prepares them and starts the worker + web.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `${BASE_URL}/api/health`,
    env: E2E_ENV,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
