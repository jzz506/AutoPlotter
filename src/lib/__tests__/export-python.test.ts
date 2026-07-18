import { describe, expect, it } from 'vitest'
import { datasetToAoa, datasetToCsv } from '../export'
import { aggregateNumbers, correlationMatrix } from '../aggregate'
import { generatePythonScript } from '../python'
import { defaultChartConfig } from '../recommend'
import type { Dataset } from '../../types'

const ds: Dataset = {
  name: 't',
  columns: ['名称', '数量'],
  rows: [
    ['苹果', 3],
    ['香蕉', null],
  ],
}

describe('数据导出', () => {
  it('datasetToCsv 生成合法 CSV', () => {
    const csv = datasetToCsv(ds)
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('名称,数量')
    expect(lines[1]).toBe('苹果,3')
    expect(lines[2]).toBe('香蕉,')
  })
  it('datasetToAoa 结构正确', () => {
    const aoa = datasetToAoa(ds)
    expect(aoa).toHaveLength(3)
    expect(aoa[0]).toEqual(['名称', '数量'])
    expect(aoa[2]).toEqual(['香蕉', ''])
  })
})

describe('聚合', () => {
  const vals = [1, 2, 3, null, '4']
  it('各种聚合函数', () => {
    expect(aggregateNumbers(vals, 'sum')).toBe(10)
    expect(aggregateNumbers(vals, 'mean')).toBeCloseTo(2.5)
    expect(aggregateNumbers(vals, 'median')).toBe(2.5)
    expect(aggregateNumbers(vals, 'min')).toBe(1)
    expect(aggregateNumbers(vals, 'max')).toBe(4)
    expect(aggregateNumbers(vals, 'count')).toBe(4)
  })
  it('相关系数矩阵', () => {
    const rows = [
      [1, 2, 4],
      [2, 4, 3],
      [3, 6, 2],
      [4, 8, 1],
    ]
    const m = correlationMatrix(rows, [0, 1, 2])
    expect(m[0][1]).toBeCloseTo(1)
    expect(m[0][2]).toBeCloseTo(-1)
    expect(m[1][2]).toBeCloseTo(-1)
    expect(m[0][0]).toBeCloseTo(1)
  })
})

describe('Python 代码生成', () => {
  it('生成包含读取、处理、绘图和保存的脚本', () => {
    const script = generatePythonScript({
      fileName: 'data.csv',
      operations: [
        { kind: 'dropMissingRows' },
        { kind: 'fillMissing', column: '金额', method: 'mean' },
        { kind: 'dropDuplicates' },
        { kind: 'textToNumber', column: '金额' },
        { kind: 'filterRange', column: '金额', min: 0, max: 100 },
      ],
      chart: defaultChartConfig({ type: 'scatter', x: '学习时间', y: '考试成绩', title: '测试' }),
    })
    expect(script).toContain("pd.read_csv")
    expect(script).toContain('dropna()')
    expect(script).toContain("fillna")
    expect(script).toContain('drop_duplicates()')
    expect(script).toContain("pd.to_numeric")
    expect(script).toContain('px.scatter')
    expect(script).toContain("fig.write_html")
    expect(script).toContain("fig.write_image")
    expect(script).not.toContain('伪代码')
  })

  it('Excel 文件使用 read_excel 和工作表', () => {
    const script = generatePythonScript({
      fileName: 'data.xlsx',
      sheetName: '月度销量',
      operations: [],
      chart: null,
    })
    expect(script).toContain('read_excel')
    expect(script).toContain('月度销量')
  })

  it('多序列折线图生成 y 列表', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({ type: 'line', x: '日期', y: '甲|乙', sortBy: 'x-asc' }),
    })
    expect(script).toContain('px.line')
    expect(script).toContain('["甲", "乙"]')
    expect(script).toContain('sort_values')
  })

  it('热图使用相关系数', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({ type: 'heatmap' }),
    })
    expect(script).toContain('.corr()')
    expect(script).toContain('px.imshow')
  })

  it('误差棒：对称误差列', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({ type: 'scatter', x: 'a', y: 'b', errorMode: 'symmetric', errorCol: 'err' }),
    })
    expect(script).toContain('error_y="err"')
  })

  it('误差棒：上下误差列', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({
        type: 'line', x: 'a', y: 'b', errorMode: 'asymmetric', errorPlusCol: 'up', errorMinusCol: 'down',
      }),
    })
    expect(script).toContain('error_y="up"')
    expect(script).toContain('error_y_minus="down"')
  })

  it('误差棒：柱状图标准误', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({ type: 'bar', x: 'g', y: 'v', aggregation: 'mean', errorMode: 'sem' }),
    })
    expect(script).toContain("lambda s: s.std() / (len(s) ** 0.5)")
    expect(script).toContain("error_y='_err'")
  })

  it('对数坐标、参考线与标注', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({
        type: 'line',
        x: 'a',
        y: 'b',
        yLog: true,
        xLog: true,
        refLines: [{ axis: 'y', value: 100, label: '阈值' }],
        annotations: [{ x: 0.5, y: 0.9, text: '备注' }],
      }),
    })
    expect(script).toContain("fig.update_xaxes(type='log')")
    expect(script).toContain("fig.update_yaxes(type='log')")
    expect(script).toContain("fig.add_hline(y=100")
    expect(script).toContain('阈值')
    expect(script).toContain("fig.add_annotation(x=0.5, y=0.9")
    expect(script).toContain('备注')
  })

  it('论文图预设调整字体', () => {
    const script = generatePythonScript({
      fileName: 'd.csv',
      operations: [],
      chart: defaultChartConfig({ type: 'line', x: 'a', y: 'b', preset: 'publication' }),
    })
    expect(script).toContain("family='Arial'")
  })
})
