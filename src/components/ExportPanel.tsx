import { useState } from 'react'
import type { ColumnProfile, Dataset } from '../types'
import { useApp } from '../state/AppContext'
import { buildChart } from '../lib/chart'
import { exportChartImage, exportConfigJson, exportCsv, exportStandaloneHtml, exportXlsx } from '../lib/export'
import { getGraphDiv } from '../lib/plotRef'
import { Plotly } from './ChartView'

interface Props {
  working: Dataset
  profiles: ColumnProfile[]
}

export default function ExportPanel({ working, profiles }: Props) {
  const { state, dispatch } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const toast = (kind: 'success' | 'error', message: string) =>
    dispatch({ type: 'TOAST', toast: { id: Date.now() + Math.random(), kind, message } })

  const hasChart = !!state.chart && !buildChart(working, profiles, state.chart).error

  const exportImage = async (format: 'png' | 'svg') => {
    if (!state.chart) return
    setBusy(format)
    try {
      const gd = getGraphDiv()
      if (!gd) throw new Error('图表尚未渲染，请先在“手动绘图”中生成图表')
      await exportChartImage(Plotly as never, gd, format, state.chart)
      toast('success', `已导出 ${format.toUpperCase()} 图片`)
    } catch (e) {
      toast('error', `导出失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const exportHtml = async () => {
    if (!state.chart) return
    setBusy('html')
    try {
      const chart = buildChart(working, profiles, state.chart)
      if (chart.error) throw new Error(chart.error)
      const mod = await import('plotly.js-dist-min/plotly.min.js?raw')
      exportStandaloneHtml(chart, state.chart, mod.default)
      toast('success', '已导出独立可交互 HTML')
    } catch (e) {
      toast('error', `导出失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel" data-testid="export-panel">
      <h2>导出</h2>
      <h3>图表导出</h3>
      {!hasChart && <p className="muted">请先在“推荐图表”或“手动绘图”中生成一个有效的图表。</p>}
      <div className="row">
        <button className="btn" data-testid="export-png" disabled={!hasChart || busy !== null} onClick={() => exportImage('png')}>
          {busy === 'png' ? '导出中…' : '导出 PNG'}
        </button>
        <button className="btn" data-testid="export-svg" disabled={!hasChart || busy !== null} onClick={() => exportImage('svg')}>
          {busy === 'svg' ? '导出中…' : '导出 SVG'}
        </button>
        <button className="btn" data-testid="export-html" disabled={!hasChart || busy !== null} onClick={exportHtml}>
          {busy === 'html' ? '导出中…' : '导出交互式 HTML'}
        </button>
        <button
          className="btn"
          data-testid="export-json"
          disabled={!state.chart}
          onClick={() => state.chart && exportConfigJson(state.chart)}
        >导出图表配置 JSON</button>
      </div>
      <h3>数据导出</h3>
      <div className="row">
        <button className="btn" data-testid="export-csv" disabled={!state.original} onClick={() => exportCsv(working)}>
          导出处理后 CSV（{working.rows.length.toLocaleString()} 行）
        </button>
        <button className="btn" data-testid="export-xlsx" disabled={!state.original} onClick={() => exportXlsx(working)}>
          导出处理后 XLSX
        </button>
      </div>
      <p className="muted">导出的数据为当前应用处理步骤后的结果。</p>
    </section>
  )
}
