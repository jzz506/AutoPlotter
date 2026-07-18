import type { ChartConfig, ColumnProfile, Recommendation } from '../types'

export function defaultChartConfig(partial: Partial<ChartConfig>): ChartConfig {
  return {
    type: 'scatter',
    aggregation: 'none',
    sortBy: 'none',
    title: '',
    xLabel: '',
    yLabel: '',
    showLegend: true,
    showGrid: true,
    width: 720,
    height: 440,
    fontSize: 13,
    theme: 'light',
    ...partial,
  }
}

export function recommendCharts(profiles: ColumnProfile[], rowCount: number): Recommendation[] {
  if (rowCount === 0 || profiles.length === 0) return []
  const recs: Recommendation[] = []
  let id = 0
  const push = (title: string, reason: string, partial: Partial<ChartConfig>) => {
    recs.push({ id: `rec-${id++}`, title, reason, config: defaultChartConfig(partial) })
  }

  const numbers = profiles.filter((p) => p.type === 'number')
  const dates = profiles.filter((p) => p.type === 'datetime')
  const cats = profiles.filter((p) => (p.type === 'string' || p.type === 'boolean') && p.unique <= 50)
  const isIdLike = (p: ColumnProfile) => p.nonNull > 20 && p.unique === p.nonNull
  const usableNumbers = numbers.filter((p) => !isIdLike(p))

  if (dates.length > 0 && usableNumbers.length > 0) {
    const d = dates[0]
    const n = usableNumbers[0]
    push(
      `折线图：${n.name} 随 ${d.name} 变化`,
      `检测到日期列「${d.name}」和数值列「${n.name}」，折线图适合展示时间趋势`,
      { type: 'line', x: d.name, y: n.name, title: `${n.name} 随时间变化`, sortBy: 'x-asc' },
    )
  }

  if (usableNumbers.length >= 2) {
    push(
      `散点图：${usableNumbers[0].name} vs ${usableNumbers[1].name}`,
      `检测到两个数值列「${usableNumbers[0].name}」和「${usableNumbers[1].name}」，散点图可观察相关关系`,
      {
        type: 'scatter',
        x: usableNumbers[0].name,
        y: usableNumbers[1].name,
        title: `${usableNumbers[0].name} 与 ${usableNumbers[1].name} 的关系`,
        color: cats[0]?.name,
      },
    )
  }

  if (cats.length > 0 && usableNumbers.length > 0) {
    const c = cats[0]
    const n = usableNumbers[0]
    push(
      `柱状图：各 ${c.name} 的 ${n.name}`,
      `类别列「${c.name}」搭配数值列「${n.name}」，柱状图适合分组对比`,
      {
        type: 'bar',
        x: c.name,
        y: n.name,
        aggregation: 'mean',
        title: `各${c.name}的${n.name}（平均）`,
        sortBy: 'y-desc',
      },
    )
    push(
      `箱线图：${n.name} 按 ${c.name} 分组`,
      `类别列「${c.name}」搭配数值列「${n.name}」，箱线图可比较组内分布差异`,
      { type: 'box', x: c.name, y: n.name, title: `${n.name} 按 ${c.name} 分组的分布` },
    )
  }

  if (usableNumbers.length === 1) {
    const n = usableNumbers[0]
    push(
      `直方图：${n.name} 的分布`,
      `单个数值列「${n.name}」适合用直方图查看分布形态`,
      { type: 'histogram', x: n.name, title: `${n.name} 分布直方图` },
    )
    push(
      `箱线图：${n.name}`,
      `单个数值列「${n.name}」的箱线图可快速定位中位数和异常值`,
      { type: 'box', y: n.name, title: `${n.name} 箱线图` },
    )
  }

  if (cats.length > 0) {
    const c = cats[0]
    push(
      `频数柱状图：${c.name} 各类别计数`,
      `类别列「${c.name}」有 ${c.unique} 个唯一值，频数柱状图展示各类别出现次数`,
      { type: 'bar', x: c.name, aggregation: 'count', title: `${c.name} 频数统计`, sortBy: 'y-desc' },
    )
  }

  if (usableNumbers.length >= 3) {
    push(
      `相关性热图：${usableNumbers.length} 个数值列`,
      `检测到 ${usableNumbers.length} 个数值列，相关性热图可总览两两相关程度`,
      { type: 'heatmap', title: '数值列相关性热图' },
    )
  }

  if (dates.length > 0 && usableNumbers.length > 1) {
    push(
      `多序列折线图：${usableNumbers.map((p) => p.name).slice(0, 4).join('、')} 随 ${dates[0].name} 变化`,
      `日期列与多个数值列构成多条时间序列，可同图对比走势`,
      {
        type: 'line',
        x: dates[0].name,
        y: usableNumbers.map((p) => p.name).join('|'),
        title: '多序列时间趋势',
        sortBy: 'x-asc',
      },
    )
  }

  const seen = new Set<string>()
  return recs.filter((r) => {
    const key = `${r.config.type}|${r.config.x}|${r.config.y}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
