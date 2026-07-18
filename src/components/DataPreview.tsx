import { useMemo, useState } from 'react'
import type { Dataset } from '../types'

const PAGE_SIZES = [20, 50, 100]

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(8)))
  return String(v)
}

export default function DataPreview({ dataset, totalRows }: { dataset: Dataset; totalRows: number }) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const pageCount = Math.max(1, Math.ceil(dataset.rows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const rows = useMemo(
    () => dataset.rows.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [dataset, safePage, pageSize],
  )

  return (
    <section className="panel" data-testid="data-preview">
      <h2>数据预览</h2>
      <p className="muted">
        当前显示处理后的数据（{dataset.rows.length.toLocaleString()} 行
        {dataset.rows.length !== totalRows ? `，原始 ${totalRows.toLocaleString()} 行` : ''}）。
      </p>
      <div className="table-wrap">
        <table className="data-table" data-testid="preview-table">
          <thead>
            <tr>
              <th>#</th>
              {dataset.columns.map((c, i) => (
                <th key={i}>{c || <em className="muted">（空）</em>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={safePage * pageSize + ri}>
                <td className="muted">{safePage * pageSize + ri + 1}</td>
                {r.map((v, ci) => (
                  <td key={ci} className={v === null ? 'cell-missing' : ''}>{v === null ? '缺失' : fmtCell(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="btn btn-ghost" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>上一页</button>
        <span data-testid="page-info">第 {safePage + 1} / {pageCount} 页</span>
        <button className="btn btn-ghost" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>下一页</button>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}>
          {PAGE_SIZES.map((s) => <option key={s} value={s}>每页 {s} 行</option>)}
        </select>
      </div>
    </section>
  )
}
