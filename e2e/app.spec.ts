import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sample = (name: string) => path.join(here, '..', 'sample-data', name)

async function uploadFile(page: Page, name: string) {
  await page.goto('/')
  const input = page.getByTestId('file-input')
  await input.setInputFiles(sample(name))
  await expect(page.getByTestId('parse-success')).toBeVisible({ timeout: 15000 })
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

test('首页显示空状态与隐私提示', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('privacy-badge')).toHaveText('数据仅在当前浏览器中处理，不会上传至服务器。')
  await expect(page.getByTestId('welcome-empty')).toBeVisible()
  await expect(page.getByTestId('dropzone')).toBeVisible()
  expect(errors).toEqual([])
})

test('上传 CSV 并查看数据概览与质量报告', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await uploadFile(page, '时间序列数据.csv')
  await expect(page.getByTestId('parse-success')).toContainText('120 行 × 5 列')

  await page.getByTestId('tab-overview').click()
  await expect(page.getByTestId('ov-rows')).toHaveText('120')
  await expect(page.getByTestId('ov-cols')).toHaveText('5')
  const profileTable = page.getByTestId('profile-table')
  await expect(profileTable).toContainText('日期时间')
  await expect(profileTable).toContainText('数值')

  await page.getByTestId('tab-quality').click()
  await expect(page.getByTestId('quality-report')).toBeVisible()

  await page.getByTestId('tab-preview').click()
  await expect(page.getByTestId('preview-table')).toContainText('日期')
  await expect(page.getByTestId('page-info')).toHaveText('第 1 / 6 页')
  expect(errors).toEqual([])
})

test('缺失异常数据的质量报告发现问题', async ({ page }) => {
  await uploadFile(page, '缺失异常数据.csv')
  await page.getByTestId('tab-quality').click()
  const report = page.getByTestId('quality-report')
  await expect(report).toContainText('缺失值')
  await expect(report).toContainText('重复')
  await expect(page.getByTestId('dup-rows')).toHaveText('1')
})

test('推荐图表并一键采用，修改配置', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await uploadFile(page, '时间序列数据.csv')
  await page.getByTestId('tab-recommend').click()
  const cards = page.getByTestId('rec-card')
  await expect(cards.first()).toBeVisible()
  await expect(page.getByTestId('use-rec-rec-0')).toBeVisible()
  await page.getByTestId('use-rec-rec-0').click()
  await expect(page.getByTestId('chart-canvas').locator('.js-plotly-plot').first()).toBeVisible({ timeout: 15000 })

  await page.getByTestId('chart-title').fill('测试标题')
  await expect(page.getByTestId('chart-canvas').locator('.js-plotly-plot').first()).toContainText('测试标题')

  await page.getByTestId('chart-theme').selectOption('dark')
  await expect(page.getByTestId('chart-canvas').locator('.js-plotly-plot').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('手动绘制多种图表', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await uploadFile(page, '类别统计数据.csv')
  await page.getByTestId('tab-chart').click()
  const canvas = page.getByTestId('chart-canvas')

  const draw = async (type: string, x?: string, y?: string) => {
    await page.getByTestId('chart-type').selectOption(type)
    if (x) await page.getByTestId('chart-x').selectOption(x)
    if (y) await page.getByTestId('chart-y').selectOption(y)
    await expect(canvas.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 15000 })
    await expect(canvas.locator('.chart-error')).toHaveCount(0)
  }

  await draw('bar', '部门', '季度销售额')
  await draw('scatter', '员工数', '季度销售额')
  await draw('histogram', '季度销售额')
  await draw('box', '部门', '季度销售额')
  await draw('violin', '部门', '满意度')
  await draw('pie', '部门')
  await draw('line', '部门', '季度销售额')
  await draw('heatmap')
  expect(errors).toEqual([])
})

test('导出 PNG、SVG、CSV、XLSX 和 JSON', async ({ page }) => {
  await uploadFile(page, '时间序列数据.csv')
  await page.getByTestId('tab-recommend').click()
  await page.getByTestId('use-rec-rec-0').click()
  await expect(page.getByTestId('chart-canvas').locator('.js-plotly-plot').first()).toBeVisible({ timeout: 15000 })

  await page.getByTestId('tab-export').click()
  const downloads: string[] = []
  page.on('download', (d) => downloads.push(d.suggestedFilename()))

  await page.getByTestId('export-png').click()
  await page.getByTestId('export-svg').click()
  await page.getByTestId('export-csv').click()
  await page.getByTestId('export-xlsx').click()
  await page.getByTestId('export-json').click()
  await page.getByTestId('export-html').click()

  await expect.poll(() => downloads.length, { timeout: 20000 }).toBe(6)
  expect(downloads.some((f) => f.endsWith('.png'))).toBe(true)
  expect(downloads.some((f) => f.endsWith('.svg'))).toBe(true)
  expect(downloads.some((f) => f.endsWith('.csv'))).toBe(true)
  expect(downloads.some((f) => f.endsWith('.xlsx'))).toBe(true)
  expect(downloads.some((f) => f.endsWith('.json'))).toBe(true)
  expect(downloads.some((f) => f.endsWith('.html'))).toBe(true)
})

test('数据处理：删除重复行、筛选并恢复原始数据', async ({ page }) => {
  await uploadFile(page, '缺失异常数据.csv')
  await page.getByTestId('tab-process').click()
  await page.getByTestId('btn-drop-dup').click()
  await expect(page.getByTestId('op-list')).toContainText('删除重复行')
  await expect(page.getByTestId('data-processing')).toContainText('13 行')

  await page.getByTestId('btn-reset').click()
  await expect(page.getByTestId('data-processing')).toContainText('14 行')
})

test('可复现 Python 脚本生成与下载', async ({ page }) => {
  await uploadFile(page, '时间序列数据.csv')
  await page.getByTestId('tab-recommend').click()
  await page.getByTestId('use-rec-rec-0').click()
  await page.getByTestId('tab-code').click()
  const script = page.getByTestId('python-script')
  await expect(script).toContainText('pd.read_csv')
  await expect(script).toContainText('px.line')
  await expect(script).toContainText('fig.write_image')
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('btn-download-script').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('autoplotter_reproduce.py')
})

test('上传 Excel 并切换工作表', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles(sample('多工作表数据.xlsx'))
  await expect(page.getByTestId('sheet-picker')).toBeVisible({ timeout: 15000 })
  await page.getByTestId('sheet-picker').getByRole('button', { name: '月度销量' }).click()
  await expect(page.getByTestId('parse-success')).toContainText('月度销量')
  await expect(page.getByTestId('parse-success')).toContainText('12 行 × 4 列')

  await page.getByTestId('sheet-bar').getByRole('button', { name: '地区汇总' }).click()
  await expect(page.getByTestId('parse-success')).toContainText('地区汇总')
  await expect(page.getByTestId('parse-success')).toContainText('4 行 × 3 列')

  await page.getByTestId('sheet-bar').getByRole('button', { name: '员工信息' }).click()
  await expect(page.getByTestId('parse-success')).toContainText('员工信息')
  expect(errors).toEqual([])
})

test('损坏文件与不支持格式给出明确提示', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles(sample('损坏文件.csv'))
  await expect(page.getByTestId('parse-error')).toBeVisible({ timeout: 15000 })

  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf'),
  })
  await expect(page.getByTestId('parse-error')).toContainText('不支持的文件格式')
})

test('分号与制表符分隔文件可导入', async ({ page }) => {
  await uploadFile(page, '分号分隔数据.csv')
  await expect(page.getByTestId('parse-success')).toContainText('4 行 × 4 列')

  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles(sample('制表符分隔数据.txt'))
  await expect(page.getByTestId('parse-success')).toContainText('4 行 × 4 列')
})
