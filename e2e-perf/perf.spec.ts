import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sample = (name: string) => path.join(here, '..', 'sample-data', 'stress', name)

test.setTimeout(300000)

for (const file of ['压力测试-10万行.csv', '压力测试-50万行.csv']) {
  test(`性能测量：${file}`, async ({ page }) => {
    await page.goto('/')

    const t0 = Date.now()
    await page.getByTestId('file-input').setInputFiles(sample(file))
    await expect(page.getByTestId('parse-success')).toBeVisible({ timeout: 240000 })
    const parseMs = Date.now() - t0

    await page.getByTestId('tab-recommend').click()
    await expect(page.getByTestId('use-rec-rec-0')).toBeVisible({ timeout: 120000 })
    const t1 = Date.now()
    await page.getByTestId('use-rec-rec-0').click()
    await expect(page.getByTestId('chart-canvas').locator('.js-plotly-plot').first()).toBeVisible({ timeout: 120000 })
    const chartMs = Date.now() - t1

    const notes = page.getByTestId('chart-notes')
    const notesText = (await notes.count()) > 0 ? await notes.innerText() : '(无)'

    console.log(`[PERF] ${file}`)
    console.log(`[PERF]   解析时间: ${parseMs} ms`)
    console.log(`[PERF]   绘图时间: ${chartMs} ms`)
    console.log(`[PERF]   降级提示: ${notesText.replace(/\n/g, ' | ')}`)
    expect(parseMs).toBeGreaterThan(0)
  })
}
