import { defineConfig, devices } from '@playwright/test'

// 压力测试专用：针对生产构建（vite preview，端口 4173）手动运行
// npx playwright test --config playwright.perf.config.ts
export default defineConfig({
  testDir: './e2e-perf',
  timeout: 300000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
