import type { QualityReport } from '../types'

const LEVEL_LABEL = { info: '提示', warning: '警告', error: '严重' } as const

export default function QualityReportPanel({ report }: { report: QualityReport }) {
  return (
    <section className="panel" data-testid="quality-report">
      <h2>数据质量报告</h2>
      <p className="muted">以下仅为检查报告和建议，不会自动修改原始数据。</p>
      <div className="stat-cards">
        <div className="stat-card"><span className="stat-label">总行数</span><span className="stat-value">{report.rowCount.toLocaleString()}</span></div>
        <div className="stat-card"><span className="stat-label">重复行</span><span className="stat-value" data-testid="dup-rows">{report.duplicateRows.toLocaleString()}</span></div>
        <div className="stat-card"><span className="stat-label">发现问题</span><span className="stat-value">{report.issues.length}</span></div>
      </div>
      {report.issues.length === 0 ? (
        <div className="alert alert-success">未发现明显的数据质量问题。</div>
      ) : (
        <ul className="issue-list">
          {report.issues.map((issue) => (
            <li key={issue.id} className={`issue issue-${issue.level}`}>
              <span className="issue-level">{LEVEL_LABEL[issue.level]}</span>
              <div>
                <div>{issue.message}</div>
                {issue.suggestion && <div className="muted small">建议：{issue.suggestion}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
