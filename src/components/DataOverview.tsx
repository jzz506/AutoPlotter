import type { ColumnProfile, Dataset } from '../types'
import { columnTypeLabel } from '../lib/infer'

interface Props {
  dataset: Dataset
  profiles: ColumnProfile[]
  fileName: string | null
  sheetName: string | null
}

function fmt(n: number | undefined, digits = 3): string {
  if (n === undefined || Number.isNaN(n)) return '—'
  if (Number.isInteger(n)) return n.toLocaleString()
  return Number(n.toPrecision(digits)).toLocaleString()
}

export default function DataOverview({ dataset, profiles, fileName, sheetName }: Props) {
  return (
    <section className="panel" data-testid="data-overview">
      <h2>数据概览</h2>
      <div className="stat-cards">
        <div className="stat-card"><span className="stat-label">文件名</span><span className="stat-value" data-testid="ov-filename">{fileName}</span></div>
        {sheetName && <div className="stat-card"><span className="stat-label">工作表</span><span className="stat-value">{sheetName}</span></div>}
        <div className="stat-card"><span className="stat-label">行数</span><span className="stat-value" data-testid="ov-rows">{dataset.rows.length.toLocaleString()}</span></div>
        <div className="stat-card"><span className="stat-label">列数</span><span className="stat-value" data-testid="ov-cols">{dataset.columns.length}</span></div>
      </div>
      <h3>列类型识别</h3>
      <div className="table-wrap">
        <table className="data-table" data-testid="profile-table">
          <thead>
            <tr>
              <th>列名</th>
              <th>推断类型</th>
              <th>非空</th>
              <th>缺失</th>
              <th>缺失比例</th>
              <th>唯一值</th>
              <th>统计信息</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.index}>
                <td>{p.name || <em className="muted">（空列名）</em>}</td>
                <td><span className={`type-badge type-${p.type}`}>{columnTypeLabel(p.type)}</span></td>
                <td>{p.nonNull.toLocaleString()}</td>
                <td>{p.missing.toLocaleString()}</td>
                <td>{(p.missingRatio * 100).toFixed(1)}%</td>
                <td>{p.unique.toLocaleString()}</td>
                <td className="stat-cell">
                  {p.type === 'number' && (
                    <span>最小 {fmt(p.min)} / 最大 {fmt(p.max)} / 均值 {fmt(p.mean)} / 中位数 {fmt(p.median)} / 标准差 {fmt(p.std)}</span>
                  )}
                  {p.type === 'datetime' && <span>{p.dateMin?.slice(0, 10)} ~ {p.dateMax?.slice(0, 10)}</span>}
                  {(p.type === 'string' || p.type === 'boolean') && p.topValues && (
                    <span>{p.topValues.map((t) => `${t.value}(${t.count})`).join('，')}</span>
                  )}
                  {p.type === 'unknown' && <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
