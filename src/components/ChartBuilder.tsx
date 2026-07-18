import { useMemo } from 'react'
import type { ChartType, ColumnProfile, Dataset } from '../types'
import { useApp } from '../state/AppContext'
import { buildChart, CHART_TYPE_LABELS, chartNeeds } from '../lib/chart'
import { defaultChartConfig } from '../lib/recommend'
import ChartView from './ChartView'

interface Props {
  working: Dataset
  profiles: ColumnProfile[]
}

const CHART_TYPES = Object.keys(CHART_TYPE_LABELS) as ChartType[]

export default function ChartBuilder({ working, profiles }: Props) {
  const { state, dispatch } = useApp()
  const config = state.chart ?? defaultChartConfig({ type: 'scatter' })
  const setConfig = (patch: Partial<typeof config>) =>
    dispatch({ type: 'SET_CHART', chart: { ...config, ...patch } })

  const needs = chartNeeds(config)
  const numberCols = profiles.filter((p) => p.type === 'number').map((p) => p.name)
  const catCols = profiles.filter((p) => p.type === 'string' || p.type === 'boolean').map((p) => p.name)
  const dateCols = profiles.filter((p) => p.type === 'datetime').map((p) => p.name)

  const chart = useMemo(
    () => (state.chart ? buildChart(working, profiles, state.chart) : null),
    [working, profiles, state.chart],
  )

  const xOptions = useMemo(() => {
    switch (config.type) {
      case 'scatter':
      case 'histogram':
        return numberCols
      case 'line':
        return [...dateCols, ...numberCols, ...catCols]
      case 'pie':
        return catCols
      case 'bar':
      case 'barh':
      case 'box':
      case 'violin':
        return [...catCols, ...dateCols]
      default:
        return working.columns
    }
  }, [config.type, numberCols, catCols, dateCols, working.columns])

  const yOptions = useMemo(() => {
    switch (config.type) {
      case 'scatter':
      case 'line':
      case 'box':
      case 'violin':
        return numberCols
      case 'bar':
      case 'barh':
      case 'pie':
        return numberCols
      default:
        return working.columns
    }
  }, [config.type, numberCols, working.columns])

  const showAggregation = config.type === 'bar' || config.type === 'barh' || config.type === 'pie'
  const showSort = config.type === 'bar' || config.type === 'barh' || config.type === 'line'
  const showColor = config.type === 'scatter'

  return (
    <section className="panel" data-testid="chart-builder">
      <h2>手动绘图</h2>
      {!state.chart && (
        <p className="muted">选择图表类型和轴列开始绘图；也可以在“推荐图表”中一键采用推荐。</p>
      )}
      <div className="chart-layout">
        <div className="chart-form">
          <label className="field">
            <span>图表类型</span>
            <select
              value={config.type}
              data-testid="chart-type"
              onChange={(e) => setConfig({ type: e.target.value as ChartType, x: undefined, y: undefined, color: undefined })}
            >
              {CHART_TYPES.map((t) => <option key={t} value={t}>{CHART_TYPE_LABELS[t]}</option>)}
            </select>
          </label>

          {needs.needsX && (
            <label className="field">
              <span>X 轴{config.type === 'pie' ? '（类别）' : ''}</span>
              <select value={config.x ?? ''} data-testid="chart-x" onChange={(e) => setConfig({ x: e.target.value || undefined })}>
                <option value="">请选择</option>
                {xOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          {config.type === 'box' || config.type === 'violin' ? (
            <label className="field">
              <span>分组列（可选）</span>
              <select value={config.x ?? ''} data-testid="chart-x" onChange={(e) => setConfig({ x: e.target.value || undefined })}>
                <option value="">不分组</option>
                {xOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : null}

          {(needs.needsY || needs.yOptional) && config.type !== 'heatmap' && (
            <label className="field">
              <span>Y 轴{needs.yOptional ? '（可选，不选则计数）' : ''}</span>
              <select value={config.y ?? ''} data-testid="chart-y" onChange={(e) => setConfig({ y: e.target.value || undefined })}>
                <option value="">{needs.yOptional ? '（计数）' : '请选择'}</option>
                {yOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          {showColor && (
            <label className="field">
              <span>颜色分组列（可选）</span>
              <select value={config.color ?? ''} onChange={(e) => setConfig({ color: e.target.value || undefined })}>
                <option value="">不分组</option>
                {catCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          {showAggregation && (
            <label className="field">
              <span>聚合方式</span>
              <select
                value={config.aggregation}
                data-testid="chart-agg"
                onChange={(e) => setConfig({ aggregation: e.target.value as typeof config.aggregation })}
              >
                <option value="count">计数</option>
                <option value="sum">求和</option>
                <option value="mean">平均值</option>
                <option value="median">中位数</option>
                <option value="min">最小值</option>
                <option value="max">最大值</option>
              </select>
            </label>
          )}

          {showSort && (
            <label className="field">
              <span>排序方式</span>
              <select value={config.sortBy} onChange={(e) => setConfig({ sortBy: e.target.value as typeof config.sortBy })}>
                <option value="none">不排序</option>
                <option value="x-asc">X 升序</option>
                <option value="x-desc">X 降序</option>
                <option value="y-asc">Y 升序</option>
                <option value="y-desc">Y 降序</option>
              </select>
            </label>
          )}

          <label className="field">
            <span>图表标题</span>
            <input value={config.title} data-testid="chart-title" onChange={(e) => setConfig({ title: e.target.value })} placeholder="请输入标题" />
          </label>
          <label className="field">
            <span>X 轴名称</span>
            <input value={config.xLabel} onChange={(e) => setConfig({ xLabel: e.target.value })} placeholder={config.x ?? ''} />
          </label>
          <label className="field">
            <span>Y 轴名称</span>
            <input value={config.yLabel} onChange={(e) => setConfig({ yLabel: e.target.value })} placeholder={config.y ?? ''} />
          </label>

          <div className="row">
            <label className="check-label">
              <input type="checkbox" checked={config.showLegend} onChange={(e) => setConfig({ showLegend: e.target.checked })} />
              显示图例
            </label>
            <label className="check-label">
              <input type="checkbox" checked={config.showGrid} onChange={(e) => setConfig({ showGrid: e.target.checked })} />
              显示网格
            </label>
          </div>

          <div className="row">
            <label className="field inline">
              <span>宽</span>
              <input type="number" min={300} max={2000} value={config.width} onChange={(e) => setConfig({ width: Number(e.target.value) || 720 })} />
            </label>
            <label className="field inline">
              <span>高</span>
              <input type="number" min={200} max={1600} value={config.height} onChange={(e) => setConfig({ height: Number(e.target.value) || 440 })} />
            </label>
            <label className="field inline">
              <span>字号</span>
              <input type="number" min={8} max={28} value={config.fontSize} onChange={(e) => setConfig({ fontSize: Number(e.target.value) || 13 })} />
            </label>
          </div>

          <label className="field">
            <span>图表主题</span>
            <select value={config.theme} data-testid="chart-theme" onChange={(e) => setConfig({ theme: e.target.value as typeof config.theme })}>
              <option value="light">明亮</option>
              <option value="dark">深色</option>
              <option value="minimal">简约</option>
            </select>
          </label>

          {!state.chart && (
            <button
              className="btn btn-primary"
              data-testid="btn-draw"
              disabled={config.type === 'heatmap' ? numberCols.length < 2 : false}
              onClick={() => dispatch({ type: 'SET_CHART', chart: config })}
            >绘制图表</button>
          )}
        </div>

        <div className="chart-canvas" data-testid="chart-canvas">
          {chart ? (
            <ChartView chart={chart} config={state.chart!} />
          ) : (
            <div className="empty-state">图表预览区：配置完成后自动显示</div>
          )}
        </div>
      </div>
    </section>
  )
}
