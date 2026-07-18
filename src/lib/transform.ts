import type { CellValue, Dataset, Operation } from '../types'
import { parseNumberLoose, parseDateLoose } from './infer'

function colIndex(ds: Dataset, name: string): number {
  return ds.columns.indexOf(name)
}

function isMissing(v: CellValue): boolean {
  return v === null || v === ''
}

function modeOf(values: CellValue[]): CellValue {
  const counts = new Map<string, { v: CellValue; n: number }>()
  for (const v of values) {
    const k = String(v)
    const cur = counts.get(k)
    if (cur) cur.n++
    else counts.set(k, { v, n: 1 })
  }
  let best: CellValue = null
  let bestN = -1
  for (const { v, n } of counts.values()) {
    if (n > bestN) {
      bestN = n
      best = v
    }
  }
  return best
}

export function applyOperation(ds: Dataset, op: Operation): Dataset {
  switch (op.kind) {
    case 'dropMissingRows': {
      const idxs =
        op.columns && op.columns.length > 0
          ? op.columns.map((c) => colIndex(ds, c)).filter((i) => i >= 0)
          : ds.columns.map((_, i) => i)
      const rows = ds.rows.filter((r) => idxs.every((i) => !isMissing(r[i] ?? null)))
      return { ...ds, rows }
    }
    case 'fillMissing': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const present = ds.rows.map((r) => r[i] ?? null).filter((v) => !isMissing(v))
      let fill: CellValue = null
      if (op.method === 'mean' || op.method === 'median') {
        const nums = present.map(parseNumberLoose).filter((n): n is number => n !== null)
        if (nums.length === 0) return ds
        if (op.method === 'mean') {
          fill = nums.reduce((a, b) => a + b, 0) / nums.length
        } else {
          const sorted = [...nums].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          fill = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        }
      } else {
        fill = modeOf(present)
      }
      const rows = ds.rows.map((r) => {
        if (isMissing(r[i] ?? null)) {
          const nr = [...r]
          nr[i] = fill
          return nr
        }
        return r
      })
      return { ...ds, rows }
    }
    case 'dropDuplicates': {
      const seen = new Set<string>()
      const rows = ds.rows.filter((r) => {
        const k = JSON.stringify(r)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      return { ...ds, rows }
    }
    case 'textToNumber': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const rows = ds.rows.map((r) => {
        const v = r[i] ?? null
        if (isMissing(v) || typeof v === 'number') return r
        const n = parseNumberLoose(v)
        if (n === null) return r
        const nr = [...r]
        nr[i] = n
        return nr
      })
      return { ...ds, rows }
    }
    case 'toDate': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const rows = ds.rows.map((r) => {
        const v = r[i] ?? null
        if (isMissing(v)) return r
        const t = parseDateLoose(v)
        if (t === null) return r
        const nr = [...r]
        nr[i] = new Date(t).toISOString().slice(0, 10)
        return nr
      })
      return { ...ds, rows }
    }
    case 'keepColumns': {
      const keepIdx = op.columns.map((c) => colIndex(ds, c)).filter((i) => i >= 0)
      if (keepIdx.length === 0) return ds
      const columns = keepIdx.map((i) => ds.columns[i])
      const rows = ds.rows.map((r) => keepIdx.map((i) => r[i] ?? null))
      return { ...ds, columns, rows }
    }
    case 'sort': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const dir = op.order === 'asc' ? 1 : -1
      const keys = ds.rows.map((r) => {
        const v = r[i] ?? null
        return { num: parseNumberLoose(v), str: v === null ? '' : String(v), missing: isMissing(v) }
      })
      const order = ds.rows.map((_, k) => k)
      order.sort((a, b) => {
        const ka = keys[a]
        const kb = keys[b]
        if (ka.missing && kb.missing) return 0
        if (ka.missing) return 1
        if (kb.missing) return -1
        if (ka.num !== null && kb.num !== null) return (ka.num - kb.num) * dir
        return ka.str.localeCompare(kb.str, 'zh') * dir
      })
      return { ...ds, rows: order.map((k) => ds.rows[k]) }
    }
    case 'filterCategory': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const allow = new Set(op.values)
      const rows = ds.rows.filter((r) => allow.has(String(r[i] ?? '(缺失)')))
      return { ...ds, rows }
    }
    case 'filterRange': {
      const i = colIndex(ds, op.column)
      if (i < 0) return ds
      const rows = ds.rows.filter((r) => {
        const v = r[i] ?? null
        if (isMissing(v)) return false
        const n = parseNumberLoose(v)
        if (n === null) return false
        if (op.min !== undefined && n < op.min) return false
        if (op.max !== undefined && n > op.max) return false
        return true
      })
      return { ...ds, rows }
    }
  }
}

export function applyOperations(ds: Dataset, ops: Operation[]): Dataset {
  return ops.reduce((acc, op) => applyOperation(acc, op), ds)
}

export function describeOperation(op: Operation): string {
  switch (op.kind) {
    case 'dropMissingRows':
      return op.columns && op.columns.length > 0
        ? `删除以下列含缺失值的行：${op.columns.join('、')}`
        : '删除所有含缺失值的行'
    case 'fillMissing': {
      const m = { mean: '均值', median: '中位数', mode: '众数' }[op.method]
      return `用${m}填补 "${op.column}" 的缺失值`
    }
    case 'dropDuplicates':
      return '删除重复行'
    case 'textToNumber':
      return `将 "${op.column}" 转换为数值`
    case 'toDate':
      return `将 "${op.column}" 转换为日期`
    case 'keepColumns':
      return `保留列：${op.columns.join('、')}`
    case 'sort':
      return `按 "${op.column}" ${op.order === 'asc' ? '升序' : '降序'}排序`
    case 'filterCategory':
      return `筛选 "${op.column}" 属于：${op.values.join('、')}`
    case 'filterRange':
      return `筛选 "${op.column}" 在 ${op.min ?? '-∞'} ~ ${op.max ?? '+∞'} 之间`
  }
}
