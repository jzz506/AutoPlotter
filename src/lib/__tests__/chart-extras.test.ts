import { describe, expect, it } from 'vitest'
import { buildChart, stdSem } from '../chart'
import { defaultChartConfig } from '../recommend'
import { profileDataset } from '../infer'
import type { Dataset } from '../../types'

const ds: Dataset = {
  name: 't',
  columns: ['日期', '销量', '部门', '误差'],
  rows: [
    ['2024-01-01', 10, 'A', 1],
    ['2024-01-02', 15, 'A', 2],
    ['2024-01-03', 8, 'B', 1.5],
    ['2024-01-04', 20, 'B', 2.5],
    ['2024-01-05', 12, 'B', 1],
  ],
}
const profiles = profileDataset(ds)

function build(partial: Parameters<typeof defaultChartConfig>[0]) {
  return buildChart(ds, profiles, defaultChartConfig(partial))
}

describe('误差棒', () => {
  it('折线图-对称误差列', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', errorMode: 'symmetric', errorCol: '误差' })
    expect(r.error).toBeUndefined()
    const ey = r.data[0].error_y as { array: number[]; symmetric: boolean }
    expect(ey.symmetric).toBe(true)
    expect(ey.array).toEqual([1, 2, 1.5, 2.5, 1])
  })

  it('折线图-上下误差列', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', errorMode: 'asymmetric', errorPlusCol: '误差', errorMinusCol: '误差' })
    const ey = r.data[0].error_y as { array: number[]; arrayminus: number[] }
    expect(ey.array).toHaveLength(5)
    expect(ey.arrayminus).toHaveLength(5)
  })

  it('折线图-标准差自动计算（按 X 分组）', () => {
    const d2: Dataset = {
      name: 't',
      columns: ['x', 'y'],
      rows: [
        [1, 10],
        [1, 14],
        [2, 20],
        [2, 24],
      ],
    }
    const r = buildChart(d2, profileDataset(d2), defaultChartConfig({ type: 'line', x: 'x', y: 'y', errorMode: 'std' }))
    expect(r.error).toBeUndefined()
    expect((r.data[0].y as number[])[0]).toBeCloseTo(12)
    const ey = r.data[0].error_y as { array: number[] }
    expect(ey.array[0]).toBeCloseTo(Math.sqrt(8))
  })

  it('柱状图-标准误自动计算', () => {
    const r = build({ type: 'bar', x: '部门', y: '销量', aggregation: 'mean', errorMode: 'sem' })
    expect(r.error).toBeUndefined()
    const ey = r.data[0].error_y as { array: (number | null)[] }
    expect(ey.array).toHaveLength(2)
    expect(ey.array[0]).toBeCloseTo(Math.sqrt((6.25 + 6.25) / 1) / Math.sqrt(2), 3)
  })

  it('散点图-自动标准差给出明确错误', () => {
    const r = build({ type: 'scatter', x: '销量', y: '误差', errorMode: 'std' })
    expect(r.error).toContain('散点图不支持')
  })

  it('误差列不存在给出错误', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', errorMode: 'symmetric', errorCol: '不存在' })
    expect(r.error).toContain('误差列')
  })

  it('上下误差模式缺列给出提示', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', errorMode: 'asymmetric' })
    expect(r.error).toContain('上误差列')
  })
})

describe('stdSem', () => {
  it('标准差与标准误', () => {
    const vals = [2, 4, 4, 4, 5, 5, 7, 9]
    expect(stdSem(vals, 'std')).toBeCloseTo(2.138, 2)
    expect(stdSem(vals, 'sem')).toBeCloseTo(2.138 / Math.sqrt(8), 2)
  })
  it('单值返回 null', () => {
    expect(stdSem([5], 'std')).toBeNull()
  })
})

describe('对数坐标', () => {
  it('Y 对数坐标写入布局', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', yLog: true })
    expect((r.layout.yaxis as { type: string }).type).toBe('log')
  })
  it('非正值给出提示', () => {
    const d2: Dataset = {
      name: 't',
      columns: ['x', 'y'],
      rows: [
        [1, 10],
        [2, -5],
        [3, 0],
        [4, 8],
      ],
    }
    const r = buildChart(d2, profileDataset(d2), defaultChartConfig({ type: 'line', x: 'x', y: 'y', yLog: true }))
    expect(r.notes?.some((n) => n.includes('非正值'))).toBe(true)
  })
})

describe('参考线与文本标注', () => {
  it('参考线生成 shapes 和标签', () => {
    const r = build({
      type: 'line',
      x: '日期',
      y: '销量',
      refLines: [
        { axis: 'y', value: 15, label: '目标线' },
        { axis: 'x', value: 3, label: '' },
      ],
    })
    const shapes = r.layout.shapes as unknown[]
    expect(shapes).toHaveLength(2)
    const anns = r.layout.annotations as { text: string }[]
    expect(anns.some((a) => a.text === '目标线')).toBe(true)
  })
  it('文本标注写入布局', () => {
    const r = build({
      type: 'line',
      x: '日期',
      y: '销量',
      annotations: [{ x: 0.5, y: 0.9, text: '峰值区域' }],
    })
    const anns = r.layout.annotations as { text: string; x: number }[]
    expect(anns[0].text).toBe('峰值区域')
    expect(anns[0].x).toBe(0.5)
  })
})

describe('绘图预设', () => {
  it('汇报图放大字号', () => {
    const web = build({ type: 'line', x: '日期', y: '销量', fontSize: 13, preset: 'web' })
    const pres = build({ type: 'line', x: '日期', y: '销量', fontSize: 13, preset: 'presentation' })
    const webSize = (web.layout.font as { size: number }).size
    const presSize = (pres.layout.font as { size: number }).size
    expect(presSize).toBeGreaterThan(webSize)
  })
  it('论文图使用 Arial', () => {
    const r = build({ type: 'line', x: '日期', y: '销量', preset: 'publication' })
    expect((r.layout.font as { family: string }).family).toContain('Arial')
  })
})
