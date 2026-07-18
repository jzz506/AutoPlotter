import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ChartBuildResult, ChartConfig, Dataset } from '../types'
import { CHART_TYPE_LABELS } from './chart'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function saveBlobViaTauri(blob: Blob, filename: string): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename })
    if (!path) return true
    const buf = new Uint8Array(await blob.arrayBuffer())
    await writeFile(path, buf)
    return true
  } catch (e) {
    console.error('Tauri 保存失败', e)
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  if (isTauri()) {
    void saveBlobViaTauri(blob, filename).then((ok) => {
      if (!ok) downloadBlobInBrowser(blob, filename)
    })
    return
  }
  downloadBlobInBrowser(blob, filename)
}

function downloadBlobInBrowser(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

export function datasetToCsv(ds: Dataset): string {
  return Papa.unparse({ fields: ds.columns, data: ds.rows.map((r) => r.map((v) => (v === null ? '' : v))) })
}

export function exportCsv(ds: Dataset, filename = 'autoplotter-data.csv') {
  downloadText('﻿' + datasetToCsv(ds), filename, 'text/csv')
}

export function datasetToAoa(ds: Dataset): (string | number | boolean)[][] {
  return [ds.columns, ...ds.rows.map((r) => r.map((v) => (v === null ? '' : v)))]
}

export function exportXlsx(ds: Dataset, filename = 'autoplotter-data.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(datasetToAoa(ds))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '数据')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

export function exportConfigJson(config: ChartConfig, filename = 'autoplotter-chart-config.json') {
  downloadText(JSON.stringify(config, null, 2), filename, 'application/json')
}

export async function exportChartImage(
  plotly: { toImage: (gd: unknown, opts: Record<string, unknown>) => Promise<string> },
  gd: unknown,
  format: 'png' | 'svg',
  config: ChartConfig,
) {
  const dataUrl = await plotly.toImage(gd, {
    format,
    width: config.width,
    height: config.height,
    scale: format === 'png' ? 2 : 1,
  })
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  downloadBlob(blob, `autoplotter-chart.${format}`)
}

export function exportStandaloneHtml(
  chart: ChartBuildResult,
  config: ChartConfig,
  plotlySource: string,
  filename = 'autoplotter-chart.html',
) {
  const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(config.title || 'AutoPlotter 图表')}</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;background:#fff}#chart{width:100vw;height:100vh;box-sizing:border-box}header{padding:8px 16px;font-size:13px;color:#666}</style>
</head>
<body>
<header>由 AutoPlotter 导出 · ${escapeHtml(CHART_TYPE_LABELS[config.type] ?? config.type)} · 数据仅保留在本文件中</header>
<div id="chart"></div>
<script>${plotlySource.replace(/<\/script/gi, '<\\/script')}</script>
<script>
var data = ${safeJson(chart.data)};
var layout = ${safeJson(chart.layout)};
layout.width = undefined;
layout.height = undefined;
layout.autosize = true;
Plotly.newPlot('chart', data, layout, { responsive: true, displaylogo: false });
</script>
</body>
</html>`
  downloadText(html, filename, 'text/html')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
