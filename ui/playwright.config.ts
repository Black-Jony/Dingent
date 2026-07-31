import { defineConfig, devices } from "@playwright/test";

const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 8765);
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 3100);
const backendURL = `http://127.0.0.1:${backendPort}`;
const frontendURL = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `${frontendURL}/dingent-resource`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "uv run python tests/e2e/playwright_server.py",
      cwd: "..",
      env: {
        DATABASE_URL: "sqlite:///./.playwright-e2e.db",
        E2E_BACKEND_PORT: String(backendPort),
      },
      url: `${backendURL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        "bun run build && node -e \"const fs=require('fs'); fs.mkdirSync('.next/standalone/.next',{recursive:true}); fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true})\" && node .next/standalone/server.js",
      env: {
        BACKEND_URL: backendURL,
        API_BASE_URL: `${backendURL}/api/v1`,
        HOSTNAME: "127.0.0.1",
        PORT: String(frontendPort),
      },
      url: `${frontendURL}/dingent-resource`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
