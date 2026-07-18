import type { ChartBuildResult, ChartConfig, CellValue, ColumnProfile, Dataset } from '../types'
import { parseNumberLoose, parseDateLoose } from './infer'
import { aggregateNumbers, correlationMatrix, groupBy } from './aggregate'

const MAX_POINTS = 20000

function colIdx(ds: Dataset, name?: string): number {
  if (!name) return -1
  return ds.columns.indexOf(name)
}

function numAt(rows: CellValue[][], i: number): (number | null)[] {
  return rows.map((r) => parseNumberLoose(r[i] ?? null))
}

function profileOf(profiles: ColumnProfile[] | undefined, name?: string): ColumnProfile | undefined {
  return profiles?.find((p) => p.name === name)
}

function typeOf(profiles: ColumnProfile[] | undefined, name?: string): string {
  return profileOf(profiles, name)?.type ?? 'unknown'
}

const THEME = {
  light: {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    fontColor: '#1f2937',
    gridcolor: '#e5e7eb',
    colorscale: 'Viridis' as const,
    palette: ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
  },
  dark: {
    paper_bgcolor: '#111827',
    plot_bgcolor: '#1f2937',
    fontColor: '#e5e7eb',
    gridcolor: '#374151',
    colorscale: 'Viridis' as const,
    palette: ['#60a5fa', '#fbbf24', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c'],
  },
  minimal: {
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#fafafa',
    fontColor: '#374151',
    gridcolor: '#f0f0f0',
    colorscale: 'Greys' as const,
    palette: ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#111827', '#4b5563'],
  },
}

function baseLayout(config: ChartConfig) {
  const t = THEME[config.theme] ?? THEME.light
  const layout: Record<string, unknown> = {
    title: config.title ? { text: config.title } : undefined,
    width: config.width,
    height: config.height,
    font: { size: config.fontSize, color: t.fontColor },
    paper_bgcolor: t.paper_bgcolor,
    plot_bgcolor: t.plot_bgcolor,
    showlegend: config.showLegend,
    margin: { l: 70, r: 40, t: 60, b: 70 },
  }
  return layout
}

function axisLayout(config: ChartConfig, horizontal: boolean) {
  const t = THEME[config.theme] ?? THEME.light
  const axis = (title: string) => ({
    title: title ? { text: title } : undefined,
    showgrid: config.showGrid,
    gridcolor: t.gridcolor,
    zeroline: false,
  })
  if (horizontal) {
    return { xaxis: axis(config.xLabel || ''), yaxis: axis(config.yLabel || '') }
  }
  return { xaxis: axis(config.xLabel || ''), yaxis: axis(config.yLabel || '') }
}

function sortPairs(xs: string[], ys: (number | null)[], sortBy: string): [string[], (number | null)[]] {
  if (sortBy === 'none') return [xs, ys]
  const idx = xs.map((_, i) => i)
  idx.sort((a, b) => {
    switch (sortBy) {
      case 'x-asc':
        return xs[a].localeCompare(xs[b], 'zh', { numeric: true })
      case 'x-desc':
        return xs[b].localeCompare(xs[a], 'zh', { numeric: true })
      case 'y-asc':
        return (ys[a] ?? -Infinity) - (ys[b] ?? -Infinity)
      case 'y-desc':
        return (ys[b] ?? -Infinity) - (ys[a] ?? -Infinity)
      default:
        return 0
    }
  })
  return [idx.map((i) => xs[i]), idx.map((i) => ys[i])]
}

function sample<T>(arr: T[]): T[] {
  if (arr.length <= MAX_POINTS) return arr
  const step = arr.length / MAX_POINTS
  const out: T[] = []
  for (let i = 0; i < MAX_POINTS; i++) out.push(arr[Math.floor(i * step)])
  return out
}

export function buildChart(
  dataset: Dataset,
  profiles: ColumnProfile[],
  config: ChartConfig,
): ChartBuildResult {
  const { rows, columns } = dataset
  if (rows.length === 0) return { data: [], layout: {}, error: '当前没有数据，请先导入文件' }
  const layout: Record<string, unknown> = { ...baseLayout(config), ...axisLayout(config, config.type === 'barh') }
  const t = THEME[config.theme] ?? THEME.light
  const notes: string[] = []
  const err = (msg: string) => ({ data: [], layout: {}, error: msg, notes: [] })

  const needCol = (name: string | undefined, what: string): number | { error: string } => {
    if (!name) return { error: `请先选择${what}` }
    const i = colIdx(dataset, name)
    if (i < 0) return { error: `列 "${name}" 不存在于当前数据中（可能在“保留列”操作后被移除）` }
    return i
  }

  switch (config.type) {
    case 'line': {
      const xi = needCol(config.x, 'X 轴列')
      if (typeof xi !== 'number') return err(xi.error)
      const yCols = (config.y ?? '').split('|').filter(Boolean)
      if (yCols.length === 0) return err('请先选择 Y 轴列')
      const xType = typeOf(profiles, config.x)
      if (xType !== 'datetime' && xType !== 'number' && xType !== 'string') {
        return err(`折线图的 X 轴需要日期、数值或类别列，当前列「${config.x}」类型为「${xType}」`)
      }
      const data: Record<string, unknown>[] = []
      const order = rows.map((_, i) => i)
      if (config.sortBy === 'x-asc' || config.sortBy === 'x-desc') {
        const dir = config.sortBy === 'x-desc' ? -1 : 1
        const keyOf = (i: number) => {
          const v = rows[i][xi]
          if (xType === 'datetime') return parseDateLoose(v) ?? Number.POSITIVE_INFINITY
          return parseNumberLoose(v) ?? Number.POSITIVE_INFINITY
        }
        order.sort((a, b) => {
          const ka = keyOf(a)
          const kb = keyOf(b)
          if (Number.isFinite(ka) && Number.isFinite(kb)) return (ka - kb) * dir
          if (Number.isFinite(ka)) return -1
          if (Number.isFinite(kb)) return 1
          return String(rows[a][xi] ?? '').localeCompare(String(rows[b][xi] ?? ''), 'zh') * dir
        })
      }
      const sampledOrder = sample(order)
      if (sampledOrder.length < order.length) {
        notes.push(`数据点过多，已均匀采样 ${sampledOrder.length.toLocaleString()} / ${order.length.toLocaleString()} 行用于绘制`)
      }
      for (let s = 0; s < yCols.length; s++) {
        const yi = colIdx(dataset, yCols[s])
        if (yi < 0) return err(`列 "${yCols[s]}" 不存在`)
        if (typeOf(profiles, yCols[s]) !== 'number') {
          return err(`折线图的 Y 轴需要数值列，「${yCols[s]}」不是数值列，请先在数据处理中转换类型`)
        }
        const xs: (string | number | null)[] = []
        const ys: (number | null)[] = []
        for (const i of sampledOrder) {
          const xv = rows[i][xi]
          if (xType === 'datetime') {
            const t = parseDateLoose(xv)
            xs.push(t !== null ? new Date(t).toISOString() : null)
          } else {
            xs.push(parseNumberLoose(xv) ?? (xv === null ? null : String(xv)))
          }
          ys.push(parseNumberLoose(rows[i][yi]))
        }
        data.push({
          type: 'scatter',
          mode: 'lines+markers',
          name: yCols[s],
          x: xs,
          y: ys,
          marker: { color: t.palette[s % t.palette.length] },
          line: { color: t.palette[s % t.palette.length], width: 2 },
          connectgaps: false,
        })
      }
      return { data, layout, notes }
    }

    case 'scatter': {
      const xi = needCol(config.x, 'X 轴列')
      if (typeof xi !== 'number') return err(xi.error)
      const yi = needCol(config.y, 'Y 轴列')
      if (typeof yi !== 'number') return err(yi.error)
      if (typeOf(profiles, config.x) !== 'number' || typeOf(profiles, config.y) !== 'number') {
        return err(`散点图要求 X 和 Y 都是数值列；当前 X「${typeOf(profiles, config.x)}」，Y「${typeOf(profiles, config.y)}」`)
      }
      const ci = colIdx(dataset, config.color)
      const data: Record<string, unknown>[] = []
      const idx = sample(rows.map((_, i) => i))
      if (idx.length < rows.length) {
        notes.push(`数据点过多，已均匀采样 ${idx.length.toLocaleString()} / ${rows.length.toLocaleString()} 行用于绘制`)
      }
      if (ci >= 0) {
        let groups = groupBy(idx, (i) => String(rows[i][ci] ?? '(缺失)'))
        if (groups.size > 20) {
          notes.push(`颜色分组超过 20 类，仅保留频次最高的 19 类，其余合并为「其他」`)
          const counts = new Map<string, number>()
          for (const i of idx) {
            const k = String(rows[i][ci] ?? '(缺失)')
            counts.set(k, (counts.get(k) ?? 0) + 1)
          }
          const top = new Set([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 19).map(([k]) => k))
          groups = groupBy(idx, (i) => {
            const k = String(rows[i][ci] ?? '(缺失)')
            return top.has(k) ? k : '其他'
          })
        }
        let s = 0
        for (const [key, ids] of groups) {
          data.push({
            type: 'scatter',
            mode: 'markers',
            name: key,
            x: ids.map((i) => parseNumberLoose(rows[i][xi])),
            y: ids.map((i) => parseNumberLoose(rows[i][yi])),
            marker: { color: t.palette[s++ % t.palette.length], size: 7, opacity: 0.75 },
          })
        }
      } else {
        data.push({
          type: 'scatter',
          mode: 'markers',
          x: idx.map((i) => parseNumberLoose(rows[i][xi])),
          y: idx.map((i) => parseNumberLoose(rows[i][yi])),
          marker: { color: t.palette[0], size: 7, opacity: 0.75 },
        })
      }
      return { data, layout, notes }
    }

    case 'bar':
    case 'barh': {
      const xi = needCol(config.x, config.type === 'bar' ? 'X 轴（类别）列' : '类别轴列')
      if (typeof xi !== 'number') return err(xi.error)
      const agg = config.aggregation === 'none' ? 'mean' : config.aggregation
      let ys: (number | null)[]
      let labels: string[]
      if (agg === 'count' || !config.y) {
        const counts = new Map<string, number>()
        for (const r of rows) {
          const k = String(r[xi] ?? '(缺失)')
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        labels = [...counts.keys()]
        ys = [...counts.values()]
      } else {
        const yi = needCol(config.y, 'Y 轴（数值）列')
        if (typeof yi !== 'number') return err(yi.error)
        if (typeOf(profiles, config.y) !== 'number') {
          return err(`柱状图的 Y 轴需要数值列，「${config.y}」类型为「${typeOf(profiles, config.y)}」；或改用“计数”聚合`)
        }
        const groups = groupBy(rows, (r) => String(r[xi] ?? '(缺失)'))
        labels = [...groups.keys()]
        ys = labels.map((k) => aggregateNumbers(groups.get(k)!.map((r) => r[yi] ?? null), agg))
      }
      ;[labels, ys] = sortPairs(labels, ys, config.sortBy)
      if (labels.length > 50) {
        notes.push(`类别数量过多（${labels.length} 个），按当前排序仅显示前 50 个`)
        labels = labels.slice(0, 50)
        ys = ys.slice(0, 50)
      }
      const horizontal = config.type === 'barh'
      const trace: Record<string, unknown> = {
        type: 'bar',
        orientation: horizontal ? 'h' : 'v',
        marker: { color: t.palette[0] },
      }
      if (horizontal) {
        trace.x = ys
        trace.y = labels
        layout.yaxis = { ...(layout.yaxis as object), autorange: 'reversed' }
      } else {
        trace.x = labels
        trace.y = ys
      }
      return { data: [trace], layout, notes }
    }

    case 'histogram': {
      const xi = needCol(config.x, '数值列')
      if (typeof xi !== 'number') return err(xi.error)
      if (typeOf(profiles, config.x) !== 'number') {
        return err(`直方图需要数值列，「${config.x}」类型为「${typeOf(profiles, config.x)}」`)
      }
      const xs = numAt(rows, xi).filter((n): n is number => n !== null)
      if (xs.length === 0) return err(`列「${config.x}」没有可用的数值`)
      const data = [
        {
          type: 'histogram',
          x: xs,
          marker: { color: t.palette[0], line: { color: t.paper_bgcolor, width: 1 } },
          opacity: 0.85,
        },
      ]
      layout.bargap = 0.05
      return { data, layout, notes }
    }

    case 'box':
    case 'violin': {
      const plotType = config.type === 'box' ? 'box' : 'violin'
      const yi = needCol(config.y, '数值列')
      if (typeof yi !== 'number') return err(yi.error)
      if (typeOf(profiles, config.y) !== 'number') {
        return err(`「${config.y}」不是数值列，无法绘制${config.type === 'box' ? '箱线图' : '小提琴图'}`)
      }
      const xi = colIdx(dataset, config.x)
      const data: Record<string, unknown>[] = []
      if (xi >= 0) {
        const groups = groupBy(rows, (r) => String(r[xi] ?? '(缺失)'))
        if (groups.size > 50) return err(`分组列「${config.x}」有 ${groups.size} 个类别，过多无法展示，请先筛选`)
        let s = 0
        for (const [key, grp] of groups) {
          data.push({
            type: plotType,
            name: key,
            y: grp.map((r) => parseNumberLoose(r[yi])).filter((n) => n !== null),
            marker: { color: t.palette[s % t.palette.length] },
            boxpoints: plotType === 'box' ? 'outliers' : false,
            ...(plotType === 'violin' ? { box: { visible: true }, meanline: { visible: true } } : {}),
          })
          s++
        }
      } else {
        data.push({
          type: plotType,
          name: config.y,
          y: numAt(rows, yi).filter((n) => n !== null),
          marker: { color: t.palette[0] },
          boxpoints: plotType === 'box' ? 'outliers' : false,
          ...(plotType === 'violin' ? { box: { visible: true }, meanline: { visible: true } } : {}),
        })
      }
      return { data, layout, notes }
    }

    case 'pie': {
      const xi = needCol(config.x, '类别列')
      if (typeof xi !== 'number') return err(xi.error)
      let labels: string[]
      let values: number[]
      if (config.y && config.aggregation !== 'count') {
        const yi = needCol(config.y, '数值列')
        if (typeof yi !== 'number') return err(yi.error)
        if (typeOf(profiles, config.y) !== 'number') {
          return err(`饼图的数值列必须是数值类型，「${config.y}」类型为「${typeOf(profiles, config.y)}」`)
        }
        const pieAgg = config.aggregation === 'none' ? 'sum' : config.aggregation
        const groups = groupBy(rows, (r) => String(r[xi] ?? '(缺失)'))
        labels = [...groups.keys()]
        values = labels.map((k) => aggregateNumbers(groups.get(k)!.map((r) => r[yi] ?? null), pieAgg) ?? 0)
      } else {
        const counts = new Map<string, number>()
        for (const r of rows) {
          const k = String(r[xi] ?? '(缺失)')
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        labels = [...counts.keys()]
        values = [...counts.values()]
      }
      if (labels.length > 30) {
        notes.push(`类别数量过多（${labels.length} 个），饼图仅显示前 20 个，其余合并为「其他」`)
        const combined = labels.map((l, i) => ({ l, v: values[i] })).sort((a, b) => b.v - a.v)
        const top = combined.slice(0, 20)
        const rest = combined.slice(20)
        labels = [...top.map((c) => c.l), '其他']
        values = [...top.map((c) => c.v), rest.reduce((s, c) => s + c.v, 0)]
      }
      const data = [
        {
          type: 'pie',
          labels,
          values,
          marker: { colors: labels.map((_, i) => t.palette[i % t.palette.length]) },
          textinfo: 'label+percent',
          hole: 0,
        },
      ]
      return { data, layout, notes }
    }

    case 'heatmap': {
      let numProfiles = profiles.filter((p) => p.type === 'number' && columns.includes(p.name))
      if (numProfiles.length < 2) {
        return err(`相关性热图至少需要 2 个数值列，当前只有 ${numProfiles.length} 个`)
      }
      if (numProfiles.length > 15) {
        notes.push(`数值列过多（${numProfiles.length} 个），相关性热图仅显示前 15 列`)
        numProfiles = numProfiles.slice(0, 15)
      }
      const idxs = numProfiles.map((p) => colIdx(dataset, p.name))
      const matrix = correlationMatrix(rows, idxs)
      const z = matrix.map((row) => row.map((v) => (Number.isNaN(v) ? null : v)))
      const data = [
        {
          type: 'heatmap',
          z,
          x: numProfiles.map((p) => p.name),
          y: numProfiles.map((p) => p.name),
          colorscale: 'RdBu',
          zmin: -1,
          zmax: 1,
          reversescale: true,
          text: z.map((row) => row.map((v) => (v === null ? '' : v.toFixed(2)))),
          texttemplate: '%{text}',
        },
      ]
      return { data, layout, notes }
    }
  }
}

export function chartNeeds(config: ChartConfig): { needsX: boolean; needsY: boolean; yOptional: boolean } {
  switch (config.type) {
    case 'histogram':
      return { needsX: true, needsY: false, yOptional: true }
    case 'box':
    case 'violin':
      return { needsX: false, needsY: true, yOptional: false }
    case 'heatmap':
      return { needsX: false, needsY: false, yOptional: true }
    case 'pie':
      return { needsX: true, needsY: false, yOptional: true }
    case 'bar':
    case 'barh':
      return { needsX: true, needsY: false, yOptional: true }
    default:
      return { needsX: true, needsY: true, yOptional: false }
  }
}

export const CHART_TYPE_LABELS: Record<string, string> = {
  line: '折线图',
  scatter: '散点图',
  bar: '柱状图',
  barh: '水平柱状图',
  histogram: '直方图',
  box: '箱线图',
  violin: '小提琴图',
  pie: '饼图',
  heatmap: '相关性热图',
}
