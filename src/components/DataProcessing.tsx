import { useMemo, useState } from 'react'
import type { ColumnProfile, Dataset, Operation } from '../types'
import { useApp } from '../state/AppContext'
import { describeOperation } from '../lib/transform'
import { columnTypeLabel } from '../lib/infer'

interface Props {
  working: Dataset
  profiles: ColumnProfile[]
}

export default function DataProcessing({ working, profiles }: Props) {
  const { state, dispatch } = useApp()
  const ops = state.operations
  const setOps = (operations: Operation[]) => dispatch({ type: 'SET_OPERATIONS', operations })

  const [fillCol, setFillCol] = useState('')
  const [fillMethod, setFillMethod] = useState<'mean' | 'median' | 'mode'>('mean')
  const [convCol, setConvCol] = useState('')
  const [dateCol, setDateCol] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [keepSel, setKeepSel] = useState<Set<string> | null>(null)
  const [catCol, setCatCol] = useState('')
  const [catSel, setCatSel] = useState<Set<string>>(new Set())
  const [rangeCol, setRangeCol] = useState('')
  const [rangeMin, setRangeMin] = useState('')
  const [rangeMax, setRangeMax] = useState('')

  const addOp = (op: Operation) => setOps([...ops, op])

  const catProfile = profiles.find((p) => p.name === catCol)
  const catValues = useMemo(() => {
    if (!catCol) return []
    const idx = working.columns.indexOf(catCol)
    if (idx < 0) return []
    const counts = new Map<string, number>()
    for (const r of working.rows) {
      const k = String(r[idx] ?? '(缺失)')
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  }, [working, catCol])

  const keepList = keepSel ?? new Set(working.columns)

  return (
    <section className="panel" data-testid="data-processing">
      <h2>数据处理</h2>
      <p className="muted">所有操作只作用于内存中的数据副本，原始数据不会被修改。</p>

      <div className="proc-grid">
        <div className="proc-block">
          <h3>缺失值</h3>
          <div className="row">
            <button className="btn" onClick={() => addOp({ kind: 'dropMissingRows' })}>删除含缺失值的行</button>
          </div>
          <div className="row">
            <select value={fillCol} onChange={(e) => setFillCol(e.target.value)} data-testid="fill-col">
              <option value="">选择要填补的列</option>
              {working.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={fillMethod} onChange={(e) => setFillMethod(e.target.value as typeof fillMethod)}>
              <option value="mean">均值</option>
              <option value="median">中位数</option>
              <option value="mode">众数</option>
            </select>
            <button
              className="btn"
              disabled={!fillCol}
              onClick={() => addOp({ kind: 'fillMissing', column: fillCol, method: fillMethod })}
            >填补缺失值</button>
          </div>
        </div>

        <div className="proc-block">
          <h3>重复与类型</h3>
          <div className="row">
            <button className="btn" onClick={() => addOp({ kind: 'dropDuplicates' })} data-testid="btn-drop-dup">删除重复行</button>
          </div>
          <div className="row">
            <select value={convCol} onChange={(e) => setConvCol(e.target.value)}>
              <option value="">选择列转数值</option>
              {working.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn" disabled={!convCol} onClick={() => addOp({ kind: 'textToNumber', column: convCol })}>转换为数值</button>
          </div>
          <div className="row">
            <select value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
              <option value="">选择列转日期</option>
              {working.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn" disabled={!dateCol} onClick={() => addOp({ kind: 'toDate', column: dateCol })}>转换为日期</button>
          </div>
        </div>

        <div className="proc-block">
          <h3>保留列</h3>
          <div className="keep-cols">
            {working.columns.map((c) => (
              <label key={c} className="check-label">
                <input
                  type="checkbox"
                  checked={keepList.has(c)}
                  onChange={(e) => {
                    const next = new Set(keepList)
                    if (e.target.checked) next.add(c)
                    else next.delete(c)
                    setKeepSel(next)
                  }}
                />
                {c} <span className="muted small">（{columnTypeLabel(profiles.find((p) => p.name === c)?.type ?? 'unknown')}）</span>
              </label>
            ))}
          </div>
          <button
            className="btn"
            disabled={keepList.size === 0 || keepList.size === working.columns.length}
            onClick={() => {
              addOp({ kind: 'keepColumns', columns: working.columns.filter((c) => keepList.has(c)) })
              setKeepSel(null)
            }}
          >应用保留列</button>
        </div>

        <div className="proc-block">
          <h3>排序</h3>
          <div className="row">
            <select value={sortCol} onChange={(e) => setSortCol(e.target.value)}>
              <option value="">选择排序列</option>
              {working.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}>
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </select>
            <button className="btn" disabled={!sortCol} onClick={() => addOp({ kind: 'sort', column: sortCol, order: sortOrder })}>排序</button>
          </div>
        </div>

        <div className="proc-block">
          <h3>按类别筛选</h3>
          <div className="row">
            <select
              value={catCol}
              data-testid="filter-cat-col"
              onChange={(e) => {
                setCatCol(e.target.value)
                setCatSel(new Set())
              }}
            >
              <option value="">选择类别列</option>
              {profiles.filter((p) => p.type === 'string' || p.type === 'boolean').map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          {catCol && (
            <>
              <div className="keep-cols tall">
                {catValues.map(([v, n]) => (
                  <label key={v} className="check-label">
                    <input
                      type="checkbox"
                      checked={catSel.has(v)}
                      onChange={(e) => {
                        const next = new Set(catSel)
                        if (e.target.checked) next.add(v)
                        else next.delete(v)
                        setCatSel(next)
                      }}
                    />
                    {v} <span className="muted small">({n})</span>
                  </label>
                ))}
              </div>
              {catProfile && catProfile.unique > catValues.length && (
                <p className="muted small">仅显示前 {catValues.length} 个高频值</p>
              )}
              <button
                className="btn"
                disabled={catSel.size === 0}
                onClick={() => addOp({ kind: 'filterCategory', column: catCol, values: [...catSel] })}
              >筛选所选类别</button>
            </>
          )}
        </div>

        <div className="proc-block">
          <h3>按数值范围筛选</h3>
          <div className="row">
            <select value={rangeCol} onChange={(e) => setRangeCol(e.target.value)} data-testid="filter-range-col">
              <option value="">选择数值列</option>
              {profiles.filter((p) => p.type === 'number').map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <input type="number" placeholder="最小值" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
            <input type="number" placeholder="最大值" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} />
            <button
              className="btn"
              disabled={!rangeCol || (rangeMin === '' && rangeMax === '')}
              onClick={() =>
                addOp({
                  kind: 'filterRange',
                  column: rangeCol,
                  min: rangeMin === '' ? undefined : Number(rangeMin),
                  max: rangeMax === '' ? undefined : Number(rangeMax),
                })
              }
            >筛选范围</button>
          </div>
        </div>
      </div>

      <h3>已应用的处理步骤（{ops.length}）</h3>
      {ops.length === 0 ? (
        <p className="muted">尚未应用任何处理步骤，当前显示原始数据。</p>
      ) : (
        <ol className="op-list" data-testid="op-list">
          {ops.map((op, i) => (
            <li key={i}>
              <span>{describeOperation(op)}</span>
              <button className="btn btn-ghost small-btn" onClick={() => setOps(ops.filter((_, j) => j !== i))}>撤销</button>
            </li>
          ))}
        </ol>
      )}
      <div className="row">
        <button
          className="btn btn-danger"
          disabled={ops.length === 0}
          data-testid="btn-reset"
          onClick={() => setOps([])}
        >恢复原始数据</button>
        <span className="muted">当前数据：{working.rows.length.toLocaleString()} 行 × {working.columns.length} 列</span>
      </div>
    </section>
  )
}
