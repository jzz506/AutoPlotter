import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { CellValue, Dataset, ParseResult } from '../types'

export const MAX_FILE_SIZE = 100 * 1024 * 1024
export const WARN_FILE_SIZE = 20 * 1024 * 1024
export const MAX_ROWS = 500000
export const WARN_ROWS = 100000

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|']

export function detectDelimiter(text: string): string {
  const sampleLines = text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 20)
  if (sampleLines.length === 0) return ','
  let best = ','
  let bestScore = -1
  for (const d of CANDIDATE_DELIMITERS) {
    const counts = sampleLines.map((l) => l.split(d).length - 1)
    const nonzero = counts.filter((c) => c > 0)
    if (nonzero.length === 0) continue
    const min = Math.min(...nonzero)
    const max = Math.max(...nonzero)
    const consistency = nonzero.length / counts.length
    const score = (min === max ? 2 : 0) + consistency + Math.min(min, 10) * 0.1
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

export function looksLikeBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  const n = Math.min(bytes.length, 8192)
  if (n === 0) return false
  let suspicious = 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i]
    if (b === 0x00) return true
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) suspicious++
  }
  return suspicious / n > 0.01
}

export function decodeText(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 (BOM)' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16 LE' }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16 BE' }
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return { text, encoding: 'UTF-8' }
  } catch {
    try {
      const text = new TextDecoder('gb18030').decode(buffer)
      return { text, encoding: 'GB18030' }
    } catch {
      return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'UTF-8' }
    }
  }
}

function normalizeCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v
  const s = String(v).trim()
  if (s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null' || s === 'N/A') return null
  return s
}

function makeDataset(name: string, columns: string[], rows: CellValue[][]): Dataset {
  const width = columns.length
  const normRows = rows.map((r) => {
    const row = r.slice(0, width)
    while (row.length < width) row.push(null)
    return row
  })
  return { name, columns, rows: normRows }
}

function finalize(result: ParseResult, dataset: Dataset): ParseResult {
  const warnings = [...result.warnings]
  let truncated = false
  if (dataset.rows.length > MAX_ROWS) {
    dataset = { ...dataset, rows: dataset.rows.slice(0, MAX_ROWS) }
    truncated = true
    warnings.push(`行数超过上限 ${MAX_ROWS.toLocaleString()}，已截断显示前 ${MAX_ROWS.toLocaleString()} 行`)
  } else if (dataset.rows.length > WARN_ROWS) {
    warnings.push(`数据量较大（${dataset.rows.length.toLocaleString()} 行），操作可能较慢`)
  }
  if (truncated || dataset.rows.length > 0) {
    return { ...result, dataset, warnings, rowCount: dataset.rows.length, columnCount: dataset.columns.length }
  }
  return { ...result, error: '文件中没有有效数据行', warnings }
}

export function parseCsvText(
  text: string,
  name: string,
  delimiter?: string,
  onProgress?: (ratio: number) => void,
): ParseResult {
  const warnings: string[] = []
  const delim = delimiter ?? detectDelimiter(text)
  try {
    const header: string[] = []
    const rows: CellValue[][] = []
    let total = 0
    Papa.parse<Record<string, unknown>>(text, {
      delimiter: delim,
      header: false,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      step: (results, parser) => {
        const row = (results.data as unknown as unknown[]).map(normalizeCell)
        if (total === 0) {
          row.forEach((c) => header.push(c === null ? '' : String(c)))
          if (header.every((h) => h === '')) {
            parser.abort()
          }
        } else {
          rows.push(row)
        }
        total += 1
        if (onProgress && total % 5000 === 0 && text.length > 0) {
          onProgress(Math.min(0.99, (results.meta.cursor ?? 0) / text.length))
        }
      },
    })
    if (header.length === 0) {
      return { error: '未能解析出表头，文件可能为空或已损坏', warnings, rowCount: 0, columnCount: 0 }
    }
    const usedDelimName = delim === '\t' ? '制表符' : `"${delim}"`
    warnings.push(`检测到分隔符：${usedDelimName}`)
    const dataset = makeDataset(name, header, rows)
    return finalize({ warnings, rowCount: 0, columnCount: 0 }, dataset)
  } catch (e) {
    return {
      error: `解析失败：${e instanceof Error ? e.message : String(e)}`,
      warnings,
      rowCount: 0,
      columnCount: 0,
    }
  }
}

export interface SheetInfo {
  names: string[]
  workbook: XLSX.WorkBook
}

export function readWorkbook(buffer: ArrayBuffer): { workbook?: XLSX.WorkBook; error?: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { error: 'Excel 文件中没有工作表' }
    }
    return { workbook }
  } catch (e) {
    return { error: `Excel 解析失败：${e instanceof Error ? e.message : String(e)}` }
  }
}

export function sheetToDataset(workbook: XLSX.WorkBook, sheetName: string, fileName: string): ParseResult {
  const ws = workbook.Sheets[sheetName]
  if (!ws) {
    return { error: `工作表 "${sheetName}" 不存在`, warnings: [], rowCount: 0, columnCount: 0 }
  }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const nonEmpty = aoa.filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
  if (nonEmpty.length === 0) {
    return { error: `工作表 "${sheetName}" 为空`, warnings: [], rowCount: 0, columnCount: 0 }
  }
  const header = nonEmpty[0].map((c) => (c instanceof Date ? c.toISOString() : c === null ? '' : String(c).trim()))
  let width = header.length
  for (const r of nonEmpty) if (r.length > width) width = r.length
  while (header.length < width) header.push(`列${header.length + 1}`)
  const rows = nonEmpty.slice(1).map((r) => r.map(normalizeCell))
  const dataset = makeDataset(`${fileName} / ${sheetName}`, header, rows)
  return finalize({ warnings: [], rowCount: 0, columnCount: 0 }, dataset)
}

export function isExcelFile(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name)
}

export function isTextFile(name: string): boolean {
  return /\.(csv|txt|tsv)$/i.test(name)
}

export function isSupportedFile(name: string): boolean {
  return isExcelFile(name) || isTextFile(name)
}
