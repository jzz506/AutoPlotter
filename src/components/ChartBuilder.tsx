import { useMemo, useState } from 'react'
import type { ChartType, ColumnProfile, Dataset, ErrorMode } from '../types'
import { useApp } from '../state/AppContext'
import { buildChart, CHART_TYPE_LABELS, chartNeeds, PRESET_LABELS } from '../lib/chart'
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
  const showErrorBars = config.type === 'line' || config.type === 'scatter' || config.type === 'bar' || config.type === 'barh'
  const showLogX = config.type !== 'pie' && config.type !== 'heatmap'
  const showLogY = config.type !== 'pie' && config.type !== 'heatmap'

  const [refAxis, setRefAxis] = useState<'x' | 'y'>('y')
  const [refValue, setRefValue] = useState('')
  const [refLabel, setRefLabel] = useState('')
  const [annX, setAnnX] = useState('0.5')
  const [annY, setAnnY] = useState('0.9')
  const [annText, setAnnText] = useState('')

  const applyPreset = (preset: typeof config.preset) => {
    if (preset === 'publication') {
      setConfig({ preset, width: 640, height: 480, fontSize: 12, theme: 'light' })
    } else if (preset === 'presentation') {
      setConfig({ preset, width: 960, height: 540, fontSize: 14, showLegend: true })
    } else {
      setConfig({ preset, width: 720, height: 440, fontSize: 13 })
    }
  }

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
            <span>绘图预设</span>
            <select
              value={config.preset}
              data-testid="chart-preset"
              onChange={(e) => applyPreset(e.target.value as typeof config.preset)}
            >
              {Object.entries(PRESET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          {showErrorBars && (
            <>
              <label className="field">
                <span>误差棒</span>
                <select
                  value={config.errorMode}
                  data-testid="error-mode"
                  onChange={(e) => setConfig({ errorMode: e.target.value as ErrorMode })}
                >
                  <option value="none">无</option>
                  <option value="symmetric">对称误差（指定误差列）</option>
                  <option value="asymmetric">上下误差（分别指定两列）</option>
                  <option value="std">标准差（按 X 自动计算）</option>
                  <option value="sem">标准误（按 X 自动计算）</option>
                </select>
              </label>
              {config.errorMode === 'symmetric' && (
                <label className="field">
                  <span>误差列</span>
                  <select value={config.errorCol ?? ''} data-testid="error-col" onChange={(e) => setConfig({ errorCol: e.target.value || undefined })}>
                    <option value="">请选择</option>
                    {numberCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
              {config.errorMode === 'asymmetric' && (
                <>
                  <label className="field">
                    <span>上误差列</span>
                    <select value={config.errorPlusCol ?? ''} onChange={(e) => setConfig({ errorPlusCol: e.target.value || undefined })}>
                      <option value="">请选择</option>
                      {numberCols.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>下误差列</span>
                    <select value={config.errorMinusCol ?? ''} onChange={(e) => setConfig({ errorMinusCol: e.target.value || undefined })}>
                      <option value="">请选择</option>
                      {numberCols.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </>
              )}
              {(config.errorMode === 'std' || config.errorMode === 'sem') && config.type === 'scatter' && (
                <p className="muted small">散点图不支持自动标准差/标准误，请改用折线图或柱状图，或指定误差列。</p>
              )}
            </>
          )}

          {(showLogX || showLogY) && (
            <div className="row">
              {showLogX && (
                <label className="check-label">
                  <input type="checkbox" checked={config.xLog} data-testid="x-log" onChange={(e) => setConfig({ xLog: e.target.checked })} />
                  X 对数坐标
                </label>
              )}
              {showLogY && (
                <label className="check-label">
                  <input type="checkbox" checked={config.yLog} data-testid="y-log" onChange={(e) => setConfig({ yLog: e.target.checked })} />
                  Y 对数坐标
                </label>
              )}
            </div>
          )}

          <details className="extras" data-testid="extras-refline">
            <summary>参考线（{config.refLines.length}）</summary>
            <div className="row">
              <select value={refAxis} onChange={(e) => setRefAxis(e.target.value as 'x' | 'y')}>
                <option value="y">水平（Y = 值）</option>
                <option value="x">垂直（X = 值）</option>
              </select>
              <input type="number" placeholder="数值" value={refValue} onChange={(e) => setRefValue(e.target.value)} />
              <input placeholder="标签（可选）" value={refLabel} onChange={(e) => setRefLabel(e.target.value)} />
              <button
                className="btn small-btn"
                disabled={refValue === '' || Number.isNaN(Number(refValue))}
                onClick={() => {
                  setConfig({ refLines: [...config.refLines, { axis: refAxis, value: Number(refValue), label: refLabel }] })
                  setRefValue('')
                  setRefLabel('')
                }}
              >添加</button>
            </div>
            {config.refLines.map((rl, i) => (
              <div key={i} className="row small">
                <span>{rl.axis === 'y' ? '水平' : '垂直'} {rl.value}{rl.label ? `（${rl.label}）` : ''}</span>
                <button className="btn btn-ghost small-btn" onClick={() => setConfig({ refLines: config.refLines.filter((_, j) => j !== i) })}>删除</button>
              </div>
            ))}
          </details>

          <details className="extras" data-testid="extras-annotation">
            <summary>文本标注（{config.annotations.length}）</summary>
            <div className="row">
              <input placeholder="文本" value={annText} data-testid="ann-text" onChange={(e) => setAnnText(e.target.value)} />
              <input type="number" step="0.05" min="0" max="1" title="横向位置（0-1）" value={annX} onChange={(e) => setAnnX(e.target.value)} />
              <input type="number" step="0.05" min="0" max="1" title="纵向位置（0-1）" value={annY} onChange={(e) => setAnnY(e.target.value)} />
              <button
                className="btn small-btn"
                disabled={!annText.trim()}
                onClick={() => {
                  setConfig({
                    annotations: [...config.annotations, { x: Number(annX), y: Number(annY), text: annText.trim() }],
                  })
                  setAnnText('')
                }}
              >添加</button>
            </div>
            <p className="muted small">位置为图表区域相对坐标（0–1）。</p>
            {config.annotations.map((an, i) => (
              <div key={i} className="row small">
                <span>“{an.text}” @ ({an.x}, {an.y})</span>
                <button className="btn btn-ghost small-btn" onClick={() => setConfig({ annotations: config.annotations.filter((_, j) => j !== i) })}>删除</button>
              </div>
            ))}
          </details>

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
