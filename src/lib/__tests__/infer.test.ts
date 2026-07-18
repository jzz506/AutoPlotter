import { describe, expect, it } from 'vitest'
import { inferColumnType, parseDateLoose, parseNumberLoose, profileDataset } from '../infer'
import type { Dataset } from '../../types'

describe('inferColumnType', () => {
  it('识别数值列', () => {
    expect(inferColumnType([1, 2, 3, 4.5, null])).toBe('number')
    expect(inferColumnType(['1', '2.5', '-3', '1,000'])).toBe('number')
  })
  it('识别日期列', () => {
    expect(inferColumnType(['2024-01-01', '2024-01-02', '2024-01-03'])).toBe('datetime')
    expect(inferColumnType(['2024/01/01', '2024/02/01', null])).toBe('datetime')
    expect(inferColumnType(['2024年1月5日', '2024年2月6日'])).toBe('datetime')
  })
  it('识别布尔列', () => {
    expect(inferColumnType([true, false, true])).toBe('boolean')
    expect(inferColumnType(['是', '否', '是'])).toBe('boolean')
  })
  it('识别类别文本列', () => {
    expect(inferColumnType(['苹果', '香蕉', '苹果'])).toBe('string')
  })
  it('空列无法识别', () => {
    expect(inferColumnType([null, null, ''])).toBe('unknown')
  })
  it('纯数字字符串不算日期', () => {
    expect(parseDateLoose('20240101')).toBeNull()
    expect(parseNumberLoose('20240101')).toBe(20240101)
  })
})

describe('profileDataset', () => {
  const ds: Dataset = {
    name: 't',
    columns: ['num', 'cat', 'dt'],
    rows: [
      [1, 'a', '2024-01-01'],
      [2, 'b', '2024-01-02'],
      [3, 'a', '2024-01-03'],
      [null, 'a', null],
    ],
  }
  it('生成完整列档案', () => {
    const p = profileDataset(ds)
    expect(p).toHaveLength(3)
    const num = p[0]
    expect(num.type).toBe('number')
    expect(num.nonNull).toBe(3)
    expect(num.missing).toBe(1)
    expect(num.missingRatio).toBeCloseTo(0.25)
    expect(num.min).toBe(1)
    expect(num.max).toBe(3)
    expect(num.mean).toBe(2)
    expect(num.median).toBe(2)
    expect(num.std).toBeCloseTo(Math.sqrt(2 / 3))
    const cat = p[1]
    expect(cat.type).toBe('string')
    expect(cat.unique).toBe(2)
    expect(cat.topValues?.[0]).toEqual({ value: 'a', count: 3 })
    const dt = p[2]
    expect(dt.type).toBe('datetime')
    expect(dt.dateMin?.slice(0, 10)).toBe('2024-01-01')
    expect(dt.dateMax?.slice(0, 10)).toBe('2024-01-03')
  })
})
