import type { ColumnProfile, Dataset, QualityIssue, QualityReport } from '../types'
import { parseNumberLoose, parseDateLoose } from './infer'

function iqrBounds(values: number[]): { lower: number; upper: number } | null {
  if (values.length < 8) return null
  const sorted = [...values].sort((a, b) => a - b)
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  const q1 = q(0.25)
  const q3 = q(0.75)
  const iqr = q3 - q1
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr }
}

export function countDuplicateRows(dataset: Dataset): number {
  const seen = new Set<string>()
  let dup = 0
  for (const r of dataset.rows) {
    const key = JSON.stringify(r)
    if (seen.has(key)) dup++
    else seen.add(key)
  }
  return dup
}

export function checkQuality(dataset: Dataset, profiles: ColumnProfile[]): QualityReport {
  const issues: QualityIssue[] = []
  let id = 0
  const push = (issue: Omit<QualityIssue, 'id'>) => issues.push({ ...issue, id: `q${id++}` })

  const { columns, rows } = dataset

  const emptyNames = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.trim() === '')
  for (const { i } of emptyNames) {
    push({
      level: 'warning',
      message: `第 ${i + 1} 列的列名为空`,
      suggestion: '建议补充列名，或在数据处理中选择保留需要的列',
    })
  }

  const nameCount = new Map<string, number>()
  for (const c of columns) nameCount.set(c, (nameCount.get(c) ?? 0) + 1)
  for (const [name, n] of nameCount) {
    if (n > 1 && name.trim() !== '') {
      push({
        level: 'warning',
        message: `列名 "${name}" 重复出现 ${n} 次`,
        suggestion: '重复列名会导致绘图和导出错乱，建议重命名或删除多余列',
      })
    }
  }

  const duplicateRows = countDuplicateRows(dataset)
  if (duplicateRows > 0) {
    push({
      level: 'info',
      message: `检测到 ${duplicateRows} 行完全重复的数据`,
      suggestion: '可在“数据处理”中删除重复行',
    })
  }

  for (const p of profiles) {
    if (p.missing > 0) {
      push({
        level: p.missingRatio > 0.3 ? 'warning' : 'info',
        column: p.name,
        message: `列 "${p.name}" 有 ${p.missing} 个缺失值（${(p.missingRatio * 100).toFixed(1)}%）`,
        suggestion: '可删除含缺失值的行，或使用均值/中位数/众数填补',
      })
    }

    if (p.nonNull > 0 && p.unique === 1) {
      push({
        level: 'info',
        column: p.name,
        message: `列 "${p.name}" 是常数列（所有值相同）`,
        suggestion: '常数列对绘图没有帮助，可考虑移除',
      })
    }

    if (p.nonNull > 20 && p.unique === p.nonNull && (p.type === 'string' || p.type === 'number')) {
      const isNumber = p.type === 'number'
      const looksId =
        /(^|_)(id|编号|序号|代码)(_|$)/i.test(p.name) || (isNumber && Number.isInteger(p.min) && Number.isInteger(p.max) && p.min === 1 && p.max === p.nonNull)
      if (looksId) {
        push({
          level: 'info',
          column: p.name,
          message: `列 "${p.name}" 疑似 ID 列（每个值都不同）`,
          suggestion: 'ID 列通常不适合直接用于统计绘图',
        })
      }
    }

    if (p.type === 'number') {
      const nums = rows
        .map((r) => parseNumberLoose(r[p.index] ?? null))
        .filter((n): n is number => n !== null)
      const bounds = iqrBounds(nums)
      if (bounds) {
        const outliers = nums.filter((n) => n < bounds.lower || n > bounds.upper)
        if (outliers.length > 0) {
          push({
            level: 'warning',
            column: p.name,
            message: `列 "${p.name}" 存在 ${outliers.length} 个 IQR 异常值（范围 ${bounds.lower.toPrecision(4)} ~ ${bounds.upper.toPrecision(4)} 之外）`,
            suggestion: '可通过数值范围筛选排除异常值，或保留并在图表中关注',
          })
        }
      }
    }

    if (p.type === 'string') {
      let numericLike = 0
      let dateLike = 0
      let dateFail = 0
      let checked = 0
      for (const r of rows) {
        const v = r[p.index]
        if (v === null || typeof v !== 'string') continue
        checked++
        if (parseNumberLoose(v) !== null) numericLike++
        else if (/\d{4}[-/年]|\d{1,2}[-/月]\d{1,2}/.test(v)) {
          if (parseDateLoose(v) !== null) dateLike++
          else dateFail++
        }
      }
      if (checked > 0 && numericLike / checked > 0.5) {
        push({
          level: 'info',
          column: p.name,
          message: `列 "${p.name}" 中的文本大部分可转换为数值`,
          suggestion: '可在“数据处理”中将该列转换为数值类型',
        })
      }
      if (dateFail > 0 && dateLike > 0) {
        push({
          level: 'warning',
          column: p.name,
          message: `列 "${p.name}" 有 ${dateFail} 个日期解析失败的值`,
          suggestion: '可先转换为日期类型并检查无法解析的值',
        })
      }
      if (checked > 50 && p.unique > 50 && p.unique / checked > 0.5 && p.unique !== p.nonNull) {
        push({
          level: 'info',
          column: p.name,
          message: `列 "${p.name}" 是高基数类别列（${p.unique} 个唯一值）`,
          suggestion: '高基数类别列生成的图表可能难以阅读，建议先筛选或聚合',
        })
      }
    }
  }

  return { rowCount: rows.length, columnCount: columns.length, duplicateRows, issues }
}
