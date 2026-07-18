import type { ChartConfig, Operation } from '../types'
import { CHART_TYPE_LABELS } from './chart'

function pyStr(s: string): string {
  return JSON.stringify(s)
}

function opToPython(op: Operation): string[] {
  switch (op.kind) {
    case 'dropMissingRows': {
      const lines = [`df = df.replace(r'^\\s*$', pd.NA, regex=True)`]
      lines.push(
        op.columns && op.columns.length > 0
          ? `df = df.dropna(subset=[${op.columns.map(pyStr).join(', ')}])`
          : 'df = df.dropna()',
      )
      return lines
    }
    case 'fillMissing': {
      const col = pyStr(op.column)
      const numExpr = `pd.to_numeric(df[${col}].astype(str).str.replace(',', '', regex=False).str.rstrip('%'), errors='coerce')`
      if (op.method === 'mean') return [`df[${col}] = df[${col}].fillna((${numExpr}).mean())`]
      if (op.method === 'median') return [`df[${col}] = df[${col}].fillna((${numExpr}).median())`]
      return [
        `_mode = df[${col}].mode()`,
        `df[${col}] = df[${col}].fillna(_mode.iloc[0] if len(_mode) > 0 else '')`,
      ]
    }
    case 'dropDuplicates':
      return ['df = df.drop_duplicates()']
    case 'textToNumber': {
      const col = pyStr(op.column)
      return [
        `_conv = pd.to_numeric(df[${col}].astype(str).str.replace(',', '', regex=False).str.rstrip('%'), errors='coerce')`,
        `df[${col}] = _conv.combine_first(df[${col}])  # 解析失败时保留原值`,
      ]
    }
    case 'toDate':
      return [
        `_parsed = pd.to_datetime(df[${pyStr(op.column)}], errors='coerce')`,
        `df[${pyStr(op.column)}] = _parsed.dt.strftime('%Y-%m-%d').where(_parsed.notna(), df[${pyStr(op.column)}])  # 解析失败保留原值`,
      ]
    case 'keepColumns':
      return [`df = df[[${op.columns.map(pyStr).join(', ')}]]`]
    case 'sort':
      return [
        `df['_sort_num'] = pd.to_numeric(df[${pyStr(op.column)}], errors='coerce')`,
        `df = df.sort_values(by=['_sort_num', ${pyStr(op.column)}], ascending=${op.order === 'asc' ? '[True, True]' : '[False, False]'}, na_position='last').drop(columns='_sort_num')`,
      ]
    case 'filterCategory':
      return [
        `df = df[df[${pyStr(op.column)}].astype(object).where(df[${pyStr(op.column)}].notna(), '(缺失)').astype(str).isin([${op.values.map(pyStr).join(', ')}])]`,
      ]
    case 'filterRange': {
      const col = pyStr(op.column)
      const lines = [`df[${col}] = pd.to_numeric(df[${col}], errors='coerce')`]
      if (op.min !== undefined) lines.push(`df = df[df[${col}] >= ${op.min}]`)
      if (op.max !== undefined) lines.push(`df = df[df[${col}] <= ${op.max}]`)
      return lines
    }
  }
}

function chartToPython(config: ChartConfig): string[] {
  const lines: string[] = []
  const title = pyStr(config.title || CHART_TYPE_LABELS[config.type] || 'chart')
  const common = `title=${title}, width=${config.width}, height=${config.height}, template='plotly${config.theme === 'dark' ? '_dark' : ''}'`
  const groupErr = config.errorMode === 'std' || config.errorMode === 'sem'
  const errFunc = config.errorMode === 'sem' ? "lambda s: s.std() / (len(s) ** 0.5)" : "'std'"
  switch (config.type) {
    case 'line': {
      const yCols = (config.y ?? '').split('|').filter(Boolean)
      const x = pyStr(config.x ?? '')
      if (config.sortBy === 'x-asc' || config.sortBy === 'x-desc' || groupErr) {
        lines.push(`df = df.sort_values(by=${x}, ascending=${config.sortBy === 'x-desc' ? 'False' : 'True'})`)
      }
      if (groupErr) {
        lines.push(
          `_grp = df.groupby(${x}, sort=True)`,
          `_mean = _grp[[${yCols.map(pyStr).join(', ')}]].mean().reset_index()`,
          `fig = px.line(_mean, x=${x}, y=[${yCols.map(pyStr).join(', ')}], ${common})`,
        )
        for (const [i, col] of yCols.entries()) {
          lines.push(
            `fig.data[${i}].error_y = dict(type='data', visible=True, array=_grp[${pyStr(col)}].agg(${errFunc}).reindex(_mean[${x}]).tolist())`,
          )
        }
      } else {
        let errArgs = ''
        if (config.errorMode === 'symmetric' && config.errorCol) {
          errArgs = `, error_y=${pyStr(config.errorCol)}`
        } else if (config.errorMode === 'asymmetric' && config.errorPlusCol && config.errorMinusCol) {
          errArgs = `, error_y=${pyStr(config.errorPlusCol)}, error_y_minus=${pyStr(config.errorMinusCol)}`
        }
        lines.push(`fig = px.line(df, x=${x}, y=[${yCols.map(pyStr).join(', ')}]${errArgs}, ${common})`)
      }
      break
    }
    case 'scatter': {
      let errArgs = ''
      if (config.errorMode === 'symmetric' && config.errorCol) {
        errArgs = `, error_y=${pyStr(config.errorCol)}`
      } else if (config.errorMode === 'asymmetric' && config.errorPlusCol && config.errorMinusCol) {
        errArgs = `, error_y=${pyStr(config.errorPlusCol)}, error_y_minus=${pyStr(config.errorMinusCol)}`
      }
      lines.push(
        `fig = px.scatter(df, x=${pyStr(config.x ?? '')}, y=${pyStr(config.y ?? '')}${config.color ? `, color=${pyStr(config.color)}` : ''}${errArgs}, ${common})`,
      )
      if (groupErr) lines.push('# 注意：网页端散点图不支持自动标准差/标准误，此处与网页一致未绘制误差棒')
      break
    }
    case 'bar':
    case 'barh': {
      const x = pyStr(config.x ?? '')
      const orient = config.type === 'barh' ? ', orientation="h"' : ''
      const errParam = config.type === 'barh' ? 'error_x' : 'error_y'
      if (config.aggregation === 'count' || !config.y) {
        lines.push(
          `_counts = df[${x}].astype(str).value_counts().reset_index()`,
          `_counts.columns = [${x}, 'count']`,
          `fig = px.bar(_counts, x=${config.type === 'barh' ? "'count'" : x}, y=${config.type === 'barh' ? x : "'count'"}${orient}, ${common})`,
        )
      } else {
        const y = pyStr(config.y)
        const aggFn = config.aggregation === 'none' ? 'mean' : config.aggregation
        lines.push(`_agg = df.groupby(df[${x}].astype(str))[${y}].agg('${aggFn}').reset_index()`)
        if (groupErr) {
          lines.push(
            `_agg['_err'] = df.groupby(df[${x}].astype(str))[${y}].agg(${errFunc}).reindex(_agg[${x}].astype(str)).tolist()`,
          )
        } else if (config.errorMode === 'symmetric' && config.errorCol) {
          lines.push(`_agg['_err'] = df.groupby(df[${x}].astype(str))[${pyStr(config.errorCol)}].mean().reindex(_agg[${x}].astype(str)).tolist()`)
        } else if (config.errorMode === 'asymmetric' && config.errorPlusCol && config.errorMinusCol) {
          lines.push(
            `_agg['_err'] = df.groupby(df[${x}].astype(str))[${pyStr(config.errorPlusCol)}].mean().reindex(_agg[${x}].astype(str)).tolist()`,
            `_agg['_errm'] = df.groupby(df[${x}].astype(str))[${pyStr(config.errorMinusCol)}].mean().reindex(_agg[${x}].astype(str)).tolist()`,
          )
        }
        const errArg = config.errorMode === 'none' ? '' : config.errorMode === 'asymmetric' ? `, ${errParam}='_err', ${errParam}_minus='_errm'` : `, ${errParam}='_err'`
        lines.push(
          `fig = px.bar(_agg, x=${config.type === 'barh' ? y : x}, y=${config.type === 'barh' ? x : y}${orient}${errArg}, ${common})`,
        )
      }
      break
    }
    case 'histogram':
      lines.push(`fig = px.histogram(df, x=${pyStr(config.x ?? '')}, ${common})`)
      break
    case 'box':
      lines.push(
        `fig = px.box(df, ${config.x ? `x=${pyStr(config.x)}, ` : ''}y=${pyStr(config.y ?? '')}, ${common})`,
      )
      break
    case 'violin':
      lines.push(
        `fig = px.violin(df, ${config.x ? `x=${pyStr(config.x)}, ` : ''}y=${pyStr(config.y ?? '')}, box=True, ${common})`,
      )
      break
    case 'pie': {
      const x = pyStr(config.x ?? '')
      if (config.y && config.aggregation !== 'count') {
        const pieAgg = config.aggregation === 'none' ? 'sum' : config.aggregation
        lines.push(
          `_agg = df.groupby(df[${x}].astype(str))[${pyStr(config.y)}].agg('${pieAgg}').reset_index()`,
          `fig = px.pie(_agg, names=${x}, values=${pyStr(config.y)}, ${common})`,
        )
      } else {
        lines.push(
          `_counts = df[${x}].astype(str).value_counts().reset_index()`,
          `_counts.columns = [${x}, 'count']`,
          `fig = px.pie(_counts, names=${x}, values='count', ${common})`,
        )
      }
      break
    }
    case 'heatmap':
      lines.push(
        `_num = df.select_dtypes(include='number')`,
        `_corr = _num.corr()`,
        `fig = px.imshow(_corr, text_auto='.2f', zmin=-1, zmax=1, color_continuous_scale='RdBu_r', ${common})`,
      )
      break
  }

  if (config.preset === 'publication') {
    lines.push(`fig.update_layout(font=dict(family='Arial', size=${Math.round(config.fontSize * 1.15)}))`)
  } else if (config.preset === 'presentation') {
    lines.push(`fig.update_layout(font=dict(size=${Math.round(config.fontSize * 1.6)}))`)
  }
  if (config.xLog) lines.push(`fig.update_xaxes(type='log')`)
  if (config.yLog) lines.push(`fig.update_yaxes(type='log')`)
  for (const rl of config.refLines) {
    if (rl.axis === 'y') {
      lines.push(`fig.add_hline(y=${rl.value}, line_dash='dash', line_color='#94a3b8'${rl.label ? `, annotation_text=${pyStr(rl.label)}` : ''})`)
    } else {
      lines.push(`fig.add_vline(x=${rl.value}, line_dash='dash', line_color='#94a3b8'${rl.label ? `, annotation_text=${pyStr(rl.label)}` : ''})`)
    }
  }
  for (const an of config.annotations) {
    lines.push(`fig.add_annotation(x=${an.x}, y=${an.y}, xref='paper', yref='paper', text=${pyStr(an.text)}, showarrow=False)`)
  }
  return lines
}

export interface PythonScriptOptions {
  fileName: string
  sheetName?: string
  operations: Operation[]
  chart: ChartConfig | null
}

export function generatePythonScript(opts: PythonScriptOptions): string {
  const { fileName, sheetName, operations, chart } = opts
  const isExcel = /\.(xlsx|xls)$/i.test(fileName)
  const lines: string[] = [
    '#!/usr/bin/env python3',
    '# -*- coding: utf-8 -*-',
    '"""',
    '由 AutoPlotter 生成的可复现脚本',
    '依赖：pip install pandas plotly openpyxl xlrd kaleido',
    `原始数据文件：${fileName}（请与本脚本放在同一目录）`,
    '"""',
    'import pandas as pd',
    'import plotly.express as px',
    '',
    '# ---------- 1. 读取原始数据 ----------',
  ]
  if (isExcel) {
    lines.push(
      `df = pd.read_excel(${pyStr(fileName)}${sheetName ? `, sheet_name=${pyStr(sheetName)}` : ''})`,
    )
  } else {
    lines.push(
      `df = pd.read_csv(${pyStr(fileName)}, sep=None, engine='python', encoding='utf-8')`,
      '# 如遇到编码错误，尝试：encoding="gb18030"',
    )
  }
  lines.push('', '# ---------- 2. 重现数据处理步骤 ----------')
  if (operations.length === 0) {
    lines.push('# （未应用任何处理步骤）')
  } else {
    for (const op of operations) {
      lines.push(...opToPython(op))
    }
  }
  lines.push('df = df.reset_index(drop=True)')
  lines.push('')
  lines.push('# 导出处理后的数据')
  lines.push("df.to_csv('processed_data.csv', index=False, encoding='utf-8-sig')")
  if (chart) {
    lines.push('', '# ---------- 3. 生成图表 ----------')
    lines.push(...chartToPython(chart))
    lines.push('')
    lines.push('# ---------- 4. 保存图表 ----------')
    lines.push("fig.write_html('chart.html')  # 交互式 HTML")
    lines.push("fig.write_image('chart.png')  # 需要 kaleido：pip install kaleido")
    lines.push('fig.show()')
  }
  lines.push('')
  return lines.join('\n')
}
