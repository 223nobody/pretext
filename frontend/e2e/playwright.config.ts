import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: "cd ../backend && .venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      port: 8000,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      port: 5173,
      reuseExistingServer: true,
      timeout: 10_000,
    },
  ],
});
