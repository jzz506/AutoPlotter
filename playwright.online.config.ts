import { defineConfig, devices } from '@playwright/test'

// 针对已部署在线版本运行的验收配置
const baseURL = process.env.ONLINE_BASE_URL ?? 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    ...(process.env.E2E_PROXY ? { proxy: { server: process.env.E2E_PROXY } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
