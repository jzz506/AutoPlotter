import { useMemo } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
import type { ChartBuildResult, ChartConfig } from '../types'
import { setGraphDiv } from '../lib/plotRef'

const Plot = createPlotlyComponent(Plotly as unknown as object)

export { Plotly }

interface Props {
  chart: ChartBuildResult
  config: ChartConfig
}

export default function ChartView({ chart, config }: Props) {
  const data = useMemo(() => chart.data, [chart])
  const layout = useMemo(() => ({ autosize: false, ...chart.layout }), [chart])
  if (chart.error) {
    return <div className="chart-error">{chart.error}</div>
  }
  if (data.length === 0) {
    return <div className="empty-state">暂无可绘制的数据</div>
  }
  return (
    <div>
      {chart.notes && chart.notes.length > 0 && (
        <div className="chart-notes" data-testid="chart-notes">
          {chart.notes.map((n, i) => (
            <div key={i} className="alert alert-warning small">{n}</div>
          ))}
        </div>
      )}
      <Plot
        data={data as never}
        layout={layout as never}
        config={{ responsive: false, displaylogo: false, locale: 'zh-CN' }}
        style={{ width: config.width, height: config.height, maxWidth: '100%' }}
        onInitialized={(_fig, gd) => setGraphDiv(gd)}
        onUpdate={(_fig, gd) => setGraphDiv(gd)}
      />
    </div>
  )
}
