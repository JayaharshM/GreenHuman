import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

// Browser tests own their servers and database, even when .env points to Atlas.
const mongoUri = `mongodb://127.0.0.1:27018/lifeline_test_e2e_${process.pid}`;
const clientUrl = "http://127.0.0.1:5174";
const apiUrl = "http://127.0.0.1:4002";
process.env.SEED_PASSWORD = "E2eLocalOnly2026!";

export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./tests/teardown.js",
  metadata: { testMongoUri: mongoUri },
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: clientUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.platform === "darwin"
        ? {
            executablePath:
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          }
        : {}),
    },
  },
  webServer: [
    {
      command: "npm run seed && npm run start -w server",
      url: `${apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: "4002",
        MONGODB_URI: mongoUri,
        JWT_SECRET: randomBytes(48).toString("hex"),
        CLIENT_URL: clientUrl,
        PUBLIC_URL: apiUrl,
        DEMO_MODE: "true",
        REQUIRE_EMAIL_VERIFICATION: "false",
        SMTP_HOST: "",
        S3_BUCKET: "",
        SEED_PASSWORD: process.env.SEED_PASSWORD,
      },
    },
    {
      command: "npm run dev -w client -- --port 5174",
      url: clientUrl,
      reuseExistingServer: false,
      env: {
        VITE_DEV_API_TARGET: apiUrl,
        VITE_API_URL: "/api",
        VITE_SOCKET_URL: clientUrl,
      },
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
