import type { Recommendation } from '../types'
import { useApp } from '../state/AppContext'
import { CHART_TYPE_LABELS } from '../lib/chart'

interface Props {
  recommendations: Recommendation[]
  onUse: (rec: Recommendation) => void
}

export default function RecommendPanel({ recommendations, onUse }: Props) {
  const { state } = useApp()
  return (
    <section className="panel" data-testid="recommend-panel">
      <h2>推荐图表</h2>
      <p className="muted">基于列类型和确定性规则自动推荐，不使用任何云端模型。</p>
      {recommendations.length === 0 ? (
        <div className="empty-state">当前数据无法生成推荐，请检查是否包含数值、类别或日期列。</div>
      ) : (
        <div className="rec-grid">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rec-card" data-testid="rec-card">
              <div className="rec-type">{CHART_TYPE_LABELS[rec.config.type]}</div>
              <div className="rec-title">{rec.title}</div>
              <div className="rec-reason">{rec.reason}</div>
              <button
                className="btn btn-primary"
                data-testid={`use-rec-${rec.id}`}
                disabled={state.chart?.x === rec.config.x && state.chart?.y === rec.config.y && state.chart?.type === rec.config.type}
                onClick={() => onUse(rec)}
              >采用此推荐</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
