import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const PORT = 7999;
const baseURL = `http://127.0.0.1:${PORT}`;

const testDir = defineBddConfig({
  featuresRoot: "features",
  steps: "steps/**/*.ts",
});

export default defineConfig({
  testDir,
  outputDir: "test-results",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    // The server is plain http; mark it secure so the clipboard API works.
    launchOptions: {
      args: [
        "--unsafely-treat-insecure-origin-as-secure=" + baseURL,
      ],
    },
    contextOptions: {
      permissions: ["clipboard-read", "clipboard-write"],
    },
  },
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command: "/Users/astahmer/dev/itwas/target/release/itwas web -p 7999 -R /Users/astahmer/dev/itwas",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
