import { parseCsvText } from '../src/lib/parse'
import { applyOperations } from '../src/lib/transform'
import { generatePythonScript } from '../src/lib/python'
import { datasetToCsv } from '../src/lib/export'
import { defaultChartConfig } from '../src/lib/recommend'
import type { Operation } from '../src/types'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2]
fs.mkdirSync(outDir, { recursive: true })

const fileName = '缺失异常数据.csv'
const text = fs.readFileSync(path.join(here, '../sample-data', fileName), 'utf8')
const parsed = parseCsvText(text, fileName)
if (!parsed.dataset) throw new Error(parsed.error)

const operations: Operation[] = [
  { kind: 'dropMissingRows' },
  { kind: 'dropDuplicates' },
  { kind: 'textToNumber', column: '金额' },
  { kind: 'filterRange', column: '金额', min: 0, max: 2000 },
  { kind: 'sort', column: '金额', order: 'desc' },
]

const jsResult = applyOperations(parsed.dataset, operations)
fs.writeFileSync(path.join(outDir, 'js_result.csv'), datasetToCsv(jsResult), 'utf8')

const script = generatePythonScript({
  fileName,
  operations,
  chart: defaultChartConfig({ type: 'bar', x: '客户', y: '金额', aggregation: 'mean', title: '各客户平均金额' }),
})
fs.writeFileSync(path.join(outDir, 'reproduce.py'), script, 'utf8')
fs.copyFileSync(path.join(here, '../sample-data', fileName), path.join(outDir, fileName))
console.log('js rows:', jsResult.rows.length)
console.log('written to', outDir)
