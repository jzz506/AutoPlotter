import { generatePythonScript } from '../src/lib/python'
import { defaultChartConfig } from '../src/lib/recommend'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2]
fs.mkdirSync(outDir, { recursive: true })

const script = generatePythonScript({
  fileName: '时间序列数据.csv',
  operations: [
    { kind: 'dropMissingRows' },
    { kind: 'sort', column: '日期', order: 'asc' },
    { kind: 'filterRange', column: '销量', min: 150 },
  ],
  chart: defaultChartConfig({
    type: 'line',
    x: '日期',
    y: '销量|客流量',
    title: '销量与客流量趋势',
    sortBy: 'x-asc',
  }),
})
fs.writeFileSync(path.join(outDir, 'reproduce.py'), script, 'utf8')
fs.copyFileSync(path.join(here, '../sample-data/时间序列数据.csv'), path.join(outDir, '时间序列数据.csv'))
console.log('written to', outDir)
