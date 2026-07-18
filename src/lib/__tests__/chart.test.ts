import { describe, expect, it } from 'vitest'
import { buildChart } from '../chart'
import { defaultChartConfig } from '../recommend'
import { profileDataset } from '../infer'
import type { Dataset } from '../../types'

const ds: Dataset = {
  name: 't',
  columns: ['日期', '销量', '部门', '利润'],
  rows: [
    ['2024-01-01', 10, 'A', 2],
    ['2024-01-02', 15, 'A', 4],
    ['2024-01-03', 8, 'B', -1],
    ['2024-01-04', 20, 'B', 6],
    ['2024-01-05', 12, 'B', 3],
  ],
}
const profiles = profileDataset(ds)

function build(partial: Parameters<typeof defaultChartConfig>[0]) {
  return buildChart(ds, profiles, defaultChartConfig(partial))
}

describe('buildChart', () => {
  it('折线图', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', sortBy: 'x-asc' })
    expect(r.error).toBeUndefined()
    expect(r.data).toHaveLength(1)
    expect(r.data[0].type).toBe('scatter')
    expect((r.data[0].y as number[]).length).toBe(5)
  })

  it('多序列折线图', () => {
    const r = build({ type: 'line', x: '日期', y: '销量|利润' })
    expect(r.error).toBeUndefined()
    expect(r.data).toHaveLength(2)
  })

  it('散点图', () => {
    const r = build({ type: 'scatter', x: '销量', y: '利润', color: '部门' })
    expect(r.error).toBeUndefined()
    expect(r.data).toHaveLength(2)
  })

  it('柱状图-计数聚合', () => {
    const r = build({ type: 'bar', x: '部门', aggregation: 'count' })
    expect(r.error).toBeUndefined()
    const ys = r.data[0].y as number[]
    expect(ys.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('柱状图-均值聚合', () => {
    const r = build({ type: 'bar', x: '部门', y: '销量', aggregation: 'mean' })
    expect(r.error).toBeUndefined()
    const labels = r.data[0].x as string[]
    const ys = r.data[0].y as number[]
    const ai = labels.indexOf('A')
    expect(ys[ai]).toBeCloseTo(12.5)
  })

  it('水平柱状图', () => {
    const r = build({ type: 'barh', x: '部门', y: '销量', aggregation: 'sum' })
    expect(r.error).toBeUndefined()
    expect(r.data[0].orientation).toBe('h')
  })

  it('直方图', () => {
    const r = build({ type: 'histogram', x: '销量' })
    expect(r.error).toBeUndefined()
    expect(r.data[0].type).toBe('histogram')
  })

  it('箱线图（分组与不分组）', () => {
    const g = build({ type: 'box', x: '部门', y: '销量' })
    expect(g.error).toBeUndefined()
    expect(g.data).toHaveLength(2)
    const single = build({ type: 'box', y: '销量' })
    expect(single.data).toHaveLength(1)
  })

  it('小提琴图', () => {
    const r = build({ type: 'violin', x: '部门', y: '利润' })
    expect(r.error).toBeUndefined()
    expect(r.data[0].type).toBe('violin')
  })

  it('饼图', () => {
    const r = build({ type: 'pie', x: '部门', aggregation: 'count' })
    expect(r.error).toBeUndefined()
    expect(r.data[0].type).toBe('pie')
    expect((r.data[0].values as number[]).reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('相关性热图', () => {
    const r = build({ type: 'heatmap' })
    expect(r.error).toBeUndefined()
    const z = r.data[0].z as number[][]
    expect(z).toHaveLength(2)
    expect(z[0][0]).toBeCloseTo(1)
  })

  it('类型不兼容时给出中文错误', () => {
    const r = build({ type: 'scatter', x: '部门', y: '利润' })
    expect(r.error).toContain('数值列')
    const r2 = build({ type: 'histogram', x: '部门' })
    expect(r2.error).toContain('数值列')
    const r3 = build({ type: 'line', x: '日期', y: '部门' })
    expect(r3.error).toContain('数值列')
  })

  it('缺少列时提示', () => {
    const r = build({ type: 'line', x: undefined, y: '销量' })
    expect(r.error).toContain('X 轴')
  })

  it('排序 y-desc 生效', () => {
    const r = build({ type: 'bar', x: '部门', y: '销量', aggregation: 'sum', sortBy: 'y-desc' })
    const labels = r.data[0].x as string[]
    expect(labels[0]).toBe('B')
  })

  it('类别超过 50 个时截断并给出提示', () => {
    const big: Dataset = {
      name: 't',
      columns: ['c', 'v'],
      rows: Array.from({ length: 60 }, (_, i) => [`c${i}`, i]),
    }
    const r = buildChart(big, profileDataset(big), defaultChartConfig({ type: 'bar', x: 'c', aggregation: 'count' }))
    expect((r.data[0].x as string[]).length).toBe(50)
    expect(r.notes?.some((n) => n.includes('前 50'))).toBe(true)
  })

  it('数值列超过 15 个时热图截断并提示', () => {
    const cols = Array.from({ length: 20 }, (_, i) => `n${i}`)
    const big: Dataset = {
      name: 't',
      columns: cols,
      rows: [cols.map((_, i) => i), cols.map((_, i) => i * 2), cols.map((_, i) => i + 1)],
    }
    const r = buildChart(big, profileDataset(big), defaultChartConfig({ type: 'heatmap' }))
    expect((r.data[0].x as string[]).length).toBe(15)
    expect(r.notes?.some((n) => n.includes('前 15'))).toBe(true)
  })

  it('散点颜色分组超过 20 类时合并并提示', () => {
    const big: Dataset = {
      name: 't',
      columns: ['x', 'y', 'g'],
      rows: Array.from({ length: 30 }, (_, i) => [i, i * 2, `g${i}`]),
    }
    const r = buildChart(big, profileDataset(big), defaultChartConfig({ type: 'scatter', x: 'x', y: 'y', color: 'g' }))
    expect(r.data.length).toBe(20)
    expect(r.notes?.some((n) => n.includes('其他'))).toBe(true)
  })
})
