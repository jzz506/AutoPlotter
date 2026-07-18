import { describe, expect, it } from 'vitest'
import { recommendCharts } from '../recommend'
import { profileDataset } from '../infer'
import type { Dataset } from '../../types'

function recsFor(ds: Dataset) {
  return recommendCharts(profileDataset(ds), ds.rows.length)
}

describe('recommendCharts', () => {
  it('日期+数值推荐折线图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['日期', '销量'],
      rows: [
        ['2024-01-01', 10],
        ['2024-01-02', 12],
        ['2024-01-03', 11],
      ],
    }
    const recs = recsFor(ds)
    const line = recs.find((r) => r.config.type === 'line')
    expect(line).toBeTruthy()
    expect(line?.config.x).toBe('日期')
    expect(line?.config.y).toBe('销量')
    expect(line?.reason).toContain('日期列')
  })

  it('两个数值列推荐散点图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['x', 'y'],
      rows: [
        [1, 2],
        [2, 4],
        [3, 5],
      ],
    }
    const recs = recsFor(ds)
    expect(recs.some((r) => r.config.type === 'scatter')).toBe(true)
  })

  it('类别+数值推荐柱状图和箱线图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['部门', '销售额'],
      rows: [
        ['A', 10],
        ['B', 20],
        ['A', 15],
      ],
    }
    const recs = recsFor(ds)
    expect(recs.some((r) => r.config.type === 'bar' && r.config.aggregation === 'mean')).toBe(true)
    expect(recs.some((r) => r.config.type === 'box')).toBe(true)
  })

  it('单数值列推荐直方图和箱线图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['v'],
      rows: [[1], [2], [3], [4], [5]],
    }
    const recs = recsFor(ds)
    expect(recs.some((r) => r.config.type === 'histogram')).toBe(true)
    expect(recs.some((r) => r.config.type === 'box')).toBe(true)
  })

  it('单类别列推荐频数柱状图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['c'],
      rows: [['a'], ['b'], ['a']],
    }
    const recs = recsFor(ds)
    const bar = recs.find((r) => r.config.type === 'bar')
    expect(bar?.config.aggregation).toBe('count')
  })

  it('三个以上数值列推荐相关性热图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['a', 'b', 'c'],
      rows: [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 6],
      ],
    }
    const recs = recsFor(ds)
    expect(recs.some((r) => r.config.type === 'heatmap')).toBe(true)
  })

  it('日期+多数值列推荐多序列折线图', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['日期', '甲', '乙'],
      rows: [
        ['2024-01-01', 1, 2],
        ['2024-01-02', 2, 3],
      ],
    }
    const recs = recsFor(ds)
    const multi = recs.find((r) => r.title.includes('多序列'))
    expect(multi?.config.y).toBe('甲|乙')
  })

  it('每项推荐都有理由', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['d', 'n', 'c'],
      rows: [
        ['2024-01-01', 1, 'x'],
        ['2024-01-02', 2, 'y'],
      ],
    }
    for (const r of recsFor(ds)) {
      expect(r.reason.length).toBeGreaterThan(5)
    }
  })

  it('空数据不推荐', () => {
    expect(recommendCharts([], 0)).toEqual([])
  })
})
