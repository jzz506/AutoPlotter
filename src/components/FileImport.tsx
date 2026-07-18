import { useCallback, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { isExcelFile, isSupportedFile, MAX_FILE_SIZE, WARN_FILE_SIZE } from '../lib/parse'
import { cancelParse, listSheetsInWorker, parseSheetInWorker, parseTextInWorker } from '../lib/parseClient'
import { getSourceFile, setSourceFile } from '../lib/bufferStore'

let toastId = 0
function nextToastId() {
  return ++toastId
}

export default function FileImport() {
  const { state, dispatch } = useApp()
  const [dragOver, setDragOver] = useState(false)
  const [pendingSheets, setPendingSheets] = useState<{ name: string; sheets: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toast = useCallback(
    (kind: 'success' | 'error' | 'info', message: string) => {
      dispatch({ type: 'TOAST', toast: { id: nextToastId(), kind, message } })
    },
    [dispatch],
  )

  const fail = useCallback(
    (msg: string) => {
      dispatch({ type: 'PARSE_ERROR', message: msg })
      toast('error', msg)
    },
    [dispatch, toast],
  )

  const parseSheet = useCallback(
    async (buffer: ArrayBuffer, fileName: string, sheetName: string) => {
      dispatch({ type: 'PARSE_START' })
      try {
        const { result, sheets } = await parseSheetInWorker(fileName, buffer, sheetName, (ratio) =>
          dispatch({ type: 'PARSE_PROGRESS', ratio }),
        )
        if (result.error || !result.dataset) {
          fail(result.error ?? '解析失败')
          return
        }
        setSourceFile(buffer, fileName, sheets)
        dispatch({
          type: 'PARSE_SUCCESS',
          dataset: result.dataset,
          fileName,
          sheetName,
          warnings: result.warnings,
        })
        toast('success', `已加载工作表「${sheetName}」：${result.rowCount.toLocaleString()} 行 × ${result.columnCount} 列`)
      } catch (e) {
        if (e instanceof Error && e.message === '已取消解析') return
        fail(e instanceof Error ? e.message : String(e))
      }
    },
    [dispatch, fail, toast],
  )

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedFile(file.name)) {
        fail(`不支持的文件格式：${file.name}。请使用 CSV、XLSX、XLS 或 TXT 文件`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        fail(`文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），超过 ${MAX_FILE_SIZE / 1024 / 1024} MB 上限`)
        return
      }
      if (file.size === 0) {
        fail('文件为空，没有可解析的内容')
        return
      }
      const preWarnings: string[] = []
      if (file.size > WARN_FILE_SIZE) {
        preWarnings.push(`文件较大（${(file.size / 1024 / 1024).toFixed(1)} MB），解析可能需要一些时间`)
      }
      dispatch({ type: 'PARSE_START' })
      let buffer: ArrayBuffer
      try {
        buffer = await file.arrayBuffer()
      } catch {
        fail('文件读取失败，请重试')
        return
      }
      if (isExcelFile(file.name)) {
        try {
          const sheets = await listSheetsInWorker(buffer)
          if (sheets.length === 0) {
            fail('Excel 文件中没有工作表')
            return
          }
          if (sheets.length > 1) {
            setSourceFile(buffer, file.name, sheets)
            setPendingSheets({ name: file.name, sheets })
            dispatch({ type: 'PARSE_CANCEL' })
            return
          }
          await parseSheet(buffer, file.name, sheets[0])
        } catch (e) {
          if (e instanceof Error && e.message === '已取消解析') return
          fail(e instanceof Error ? e.message : String(e))
        }
        return
      }
      try {
        setSourceFile(null, '')
        const { result, encoding } = await parseTextInWorker(file.name, buffer, (ratio) =>
          dispatch({ type: 'PARSE_PROGRESS', ratio }),
        )
        const allWarnings = [...preWarnings, `检测到编码：${encoding}`, ...result.warnings]
        if (result.error || !result.dataset) {
          fail(result.error ?? '解析失败')
          return
        }
        dispatch({
          type: 'PARSE_SUCCESS',
          dataset: result.dataset,
          fileName: file.name,
          warnings: allWarnings,
        })
        toast('success', `已加载 ${file.name}：${result.rowCount.toLocaleString()} 行 × ${result.columnCount} 列`)
      } catch (e) {
        if (e instanceof Error && e.message === '已取消解析') return
        fail(e instanceof Error ? e.message : String(e))
      }
    },
    [dispatch, fail, parseSheet, toast],
  )

  return (
    <section className="panel" data-testid="file-import">
      <h2>文件导入</h2>
      <p className="muted">支持 CSV、XLSX、XLS、TXT 格式，拖拽或点击选择文件。大文件在后台线程解析，不阻塞界面。</p>
      <div
        className={`dropzone${dragOver ? ' dragover' : ''}`}
        data-testid="dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.click()
        }}
      >
        <div className="dropzone-inner">
          <strong>拖入文件到这里</strong>
          <span>或点击选择文件</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv,.xlsx,.xls"
          style={{ display: 'none' }}
          data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {state.status === 'parsing' && (
        <div className="progress-wrap" data-testid="parse-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.max(8, state.progress * 100)}%` }} />
          </div>
          <div className="row">
            <span className="muted">正在后台线程解析文件…</span>
            <button
              className="btn btn-ghost small-btn"
              data-testid="btn-cancel-parse"
              onClick={() => {
                cancelParse()
                dispatch({ type: 'PARSE_CANCEL' })
                toast('info', '已取消解析')
              }}
            >取消</button>
          </div>
        </div>
      )}

      {state.status === 'error' && state.error && (
        <div className="alert alert-error" data-testid="parse-error">{state.error}</div>
      )}

      {state.status === 'ready' && state.original && (
        <div className="alert alert-success" data-testid="parse-success">
          已加载 <strong>{state.fileName}</strong>
          {state.sheetName ? `（工作表：${state.sheetName}）` : ''}：{state.original.rows.length.toLocaleString()} 行 ×{' '}
          {state.original.columns.length} 列
        </div>
      )}

      {state.warnings.map((w, i) => (
        <div key={i} className="alert alert-warning">{w}</div>
      ))}

      {pendingSheets && (
        <div className="modal-mask" onClick={() => setPendingSheets(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="sheet-picker">
            <h3>选择工作表</h3>
            <p className="muted">{pendingSheets.name} 包含 {pendingSheets.sheets.length} 个工作表：</p>
            <div className="sheet-list">
              {pendingSheets.sheets.map((s) => (
                <button
                  key={s}
                  className="btn"
                  onClick={() => {
                    const p = pendingSheets
                    setPendingSheets(null)
                    const { buffer } = getSourceFile()
                    if (buffer) void parseSheet(buffer, p.name, s)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={() => setPendingSheets(null)}>取消</button>
          </div>
        </div>
      )}
    </section>
  )
}
