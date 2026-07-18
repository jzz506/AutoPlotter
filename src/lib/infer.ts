import type { CellValue, ColumnProfile, ColumnType, Dataset } from '../types'

const BOOL_TRUE = new Set(['true', 'yes', 'y', '1', '是', '对'])
const BOOL_FALSE = new Set(['false', 'no', 'n', '0', '否', '错'])

export function parseNumberLoose(v: CellValue): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return null
  if (v === null) return null
  const s = v.trim().replace(/,/g, '').replace(/%$/, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseDateLoose(v: CellValue): number | null {
  if (v === null || typeof v === 'boolean') return null
  if (typeof v === 'number') return null
  const s = v.trim()
  if (s === '') return null
  if (/^\d+(\.\d+)?$/.test(s)) return null
  const m = s.match(
    /^(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})日?(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  )
  if (m) {
    const [, y, mo, d, h, mi, se] = m
    const month = +mo
    const day = +d
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const t = Date.UTC(+y, month - 1, day, +(h ?? 0), +(mi ?? 0), +(se ?? 0))
    const dt = new Date(t)
    if (dt.getUTCFullYear() === +y && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day) return t
    return null
  }
  if (!/\d{4}/.test(s)) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

export function parseBoolLoose(v: CellValue): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === null || typeof v === 'number') return null
  const s = v.trim().toLowerCase()
  if (BOOL_TRUE.has(s)) return true
  if (BOOL_FALSE.has(s)) return false
  return null
}

export function inferColumnType(values: CellValue[]): ColumnType {
  let nonNull = 0
  let num = 0
  let date = 0
  let bool = 0
  let str = 0
  for (const v of values) {
    if (v === null || v === '') continue
    nonNull++
    if (typeof v === 'number') {
      num++
      continue
    }
    if (typeof v === 'boolean') {
      bool++
      continue
    }
    if (parseNumberLoose(v) !== null) {
      num++
      continue
    }
    if (parseBoolLoose(v) !== null) {
      bool++
      continue
    }
    if (parseDateLoose(v) !== null) {
      date++
      continue
    }
    str++
  }
  if (nonNull === 0) return 'unknown'
  const ratio = (n: number) => n / nonNull
  if (ratio(num) >= 0.9) return 'number'
  if (ratio(date) >= 0.8 && str === 0) return 'datetime'
  if (ratio(bool) >= 0.9 && num === 0 && str === 0) return 'boolean'
  return 'string'
}

function median(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return NaN
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function profileDataset(dataset: Dataset): ColumnProfile[] {
  const { columns, rows } = dataset
  return columns.map((name, index) => {
    const values = rows.map((r) => r[index] ?? null)
    const type = inferColumnType(values)
    const nonNullVals = values.filter((v) => v !== null && v !== '')
    const unique = new Set(nonNullVals.map((v) => String(v))).size
    const profile: ColumnProfile = {
      name,
      index,
      type,
      nonNull: nonNullVals.length,
      missing: values.length - nonNullVals.length,
      missingRatio: values.length === 0 ? 0 : (values.length - nonNullVals.length) / values.length,
      unique,
    }
    if (type === 'number') {
      const nums = nonNullVals
        .map(parseNumberLoose)
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b)
      if (nums.length > 0) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length
        const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length
        profile.min = nums[0]
        profile.max = nums[nums.length - 1]
        profile.mean = mean
        profile.median = median(nums)
        profile.std = Math.sqrt(variance)
      }
    } else if (type === 'datetime') {
      const times = nonNullVals.map(parseDateLoose).filter((t): t is number => t !== null)
      if (times.length > 0) {
        let tMin = times[0]
        let tMax = times[0]
        for (const t of times) {
          if (t < tMin) tMin = t
          if (t > tMax) tMax = t
        }
        profile.dateMin = new Date(tMin).toISOString()
        profile.dateMax = new Date(tMax).toISOString()
      }
    } else if (type === 'string' || type === 'boolean') {
      const counts = new Map<string, number>()
      for (const v of nonNullVals) {
        const k = String(v)
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      profile.topValues = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
    }
    return profile
  })
}

export function columnTypeLabel(t: ColumnType): string {
  switch (t) {
    case 'number':
      return '数值'
    case 'string':
      return '类别文本'
    case 'datetime':
      return '日期时间'
    case 'boolean':
      return '布尔值'
    default:
      return '无法识别'
  }
}
