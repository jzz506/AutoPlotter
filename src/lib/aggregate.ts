import type { Aggregation, CellValue } from '../types'
import { parseNumberLoose } from './infer'

export interface GroupedRows {
  key: string
  values: CellValue[]
}

export function aggregateNumbers(values: CellValue[], agg: Aggregation): number | null {
  const nums = values.map(parseNumberLoose).filter((n): n is number => n !== null)
  switch (agg) {
    case 'count':
      return values.filter((v) => v !== null && v !== '').length
    case 'sum':
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0)
    case 'mean':
      return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length
    case 'median': {
      if (nums.length === 0) return null
      const s = [...nums].sort((a, b) => a - b)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
    }
    case 'min': {
      if (nums.length === 0) return null
      let m = nums[0]
      for (const n of nums) if (n < m) m = n
      return m
    }
    case 'max': {
      if (nums.length === 0) return null
      let m = nums[0]
      for (const n of nums) if (n > m) m = n
      return m
    }
    default:
      return null
  }
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = keyFn(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}

export function correlationMatrix(rows: CellValue[][], colIdxs: number[]): number[][] {
  const series = colIdxs.map((i) => rows.map((r) => parseNumberLoose(r[i] ?? null)))
  const n = series.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(null) as number[])
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      const xs: number[] = []
      const ys: number[] = []
      for (let k = 0; k < series[a].length; k++) {
        const x = series[a][k]
        const y = series[b][k]
        if (x !== null && y !== null) {
          xs.push(x)
          ys.push(y)
        }
      }
      let r = NaN
      if (xs.length >= 3) {
        const mx = xs.reduce((s, v) => s + v, 0) / xs.length
        const my = ys.reduce((s, v) => s + v, 0) / ys.length
        let num = 0
        let dx = 0
        let dy = 0
        for (let k = 0; k < xs.length; k++) {
          num += (xs[k] - mx) * (ys[k] - my)
          dx += (xs[k] - mx) ** 2
          dy += (ys[k] - my) ** 2
        }
        r = dx === 0 || dy === 0 ? NaN : num / Math.sqrt(dx * dy)
      }
      matrix[a][b] = r
      matrix[b][a] = r
    }
  }
  return matrix
}
