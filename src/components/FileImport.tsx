import { useCallback, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import {
  decodeText,
  isExcelFile,
  isSupportedFile,
  looksLikeBinary,
  MAX_FILE_SIZE,
  parseCsvText,
  readWorkbook,
  sheetToDataset,
  WARN_FILE_SIZE,
} from '../lib/parse'
import { setWorkbook } from '../lib/workbookStore'
import type { WorkBook } from 'xlsx'

let toastId = 0
function nextToastId() {
  return ++toastId
}

export default function FileImport() {
  const { state, dispatch } = useApp()
  const [dragOver, setDragOver] = useState(false)
  const [pendingSheets, setPendingSheets] = useState<{ wb: WorkBook; name: string; sheets: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toast = useCallback(
    (kind: 'success' | 'error' | 'info', message: string) => {
      dispatch({ type: 'TOAST', toast: { id: nextToastId(), kind, message } })
    },
    [dispatch],
  )

  const parseSheet = useCallback(
    (wb: WorkBook, fileName: string, sheetName: string) => {
      dispatch({ type: 'PARSE_START' })
      setTimeout(() => {
        const result = sheetToDataset(wb, sheetName, fileName)
        if (result.error || !result.dataset) {
          dispatch({ type: 'PARSE_ERROR', message: result.error ?? '解析失败' })
          toast('error', result.error ?? '解析失败')
          return
        }
        setWorkbook(wb, fileName)
        dispatch({
          type: 'PARSE_SUCCESS',
          dataset: result.dataset,
          fileName,
          sheetName,
          warnings: result.warnings,
        })
        toast('success', `已加载工作表「${sheetName}」：${result.rowCount.toLocaleString()} 行 × ${result.columnCount} 列`)
      }, 30)
    },
    [dispatch, toast],
  )

  const handleFile = useCallback(
    (file: File) => {
      if (!isSupportedFile(file.name)) {
        const msg = `不支持的文件格式：${file.name}。请使用 CSV、XLSX、XLS 或 TXT 文件`
        dispatch({ type: 'PARSE_ERROR', message: msg })
        toast('error', msg)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        const msg = `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），超过 ${MAX_FILE_SIZE / 1024 / 1024} MB 上限`
        dispatch({ type: 'PARSE_ERROR', message: msg })
        toast('error', msg)
        return
      }
      if (file.size === 0) {
        const msg = '文件为空，没有可解析的内容'
        dispatch({ type: 'PARSE_ERROR', message: msg })
        toast('error', msg)
        return
      }
      const warnings: string[] = []
      if (file.size > WARN_FILE_SIZE) {
        warnings.push(`文件较大（${(file.size / 1024 / 1024).toFixed(1)} MB），解析可能需要一些时间`)
      }
      dispatch({ type: 'PARSE_START' })
      const reader = new FileReader()
      reader.onerror = () => {
        dispatch({ type: 'PARSE_ERROR', message: '文件读取失败，请重试' })
        toast('error', '文件读取失败，请重试')
      }
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer
          if (isExcelFile(file.name)) {
            const { workbook, error } = readWorkbook(buffer)
            if (error || !workbook) {
              dispatch({ type: 'PARSE_ERROR', message: error ?? 'Excel 解析失败' })
              toast('error', error ?? 'Excel 解析失败')
              return
            }
            if (workbook.SheetNames.length > 1) {
              setPendingSheets({ wb: workbook, name: file.name, sheets: workbook.SheetNames })
              dispatch({ type: 'RESET' })
              return
            }
            parseSheet(workbook, file.name, workbook.SheetNames[0])
            return
          }
          const { text, encoding } = decodeText(buffer)
          if (looksLikeBinary(buffer)) {
            const msg = '文件内容疑似二进制数据或已损坏，无法作为文本解析'
            dispatch({ type: 'PARSE_ERROR', message: msg })
            toast('error', msg)
            return
          }
          const result = parseCsvText(text, file.name, undefined, (ratio) =>
            dispatch({ type: 'PARSE_PROGRESS', ratio }),
          )
          const allWarnings = [...warnings, `检测到编码：${encoding}`, ...result.warnings]
          if (result.error || !result.dataset) {
            dispatch({ type: 'PARSE_ERROR', message: result.error ?? '解析失败' })
            toast('error', result.error ?? '解析失败')
            return
          }
          setWorkbook(null, '')
          dispatch({
            type: 'PARSE_SUCCESS',
            dataset: result.dataset,
            fileName: file.name,
            warnings: allWarnings,
          })
          toast('success', `已加载 ${file.name}：${result.rowCount.toLocaleString()} 行 × ${result.columnCount} 列`)
        } catch (e) {
          const msg = `解析失败：${e instanceof Error ? e.message : String(e)}`
          dispatch({ type: 'PARSE_ERROR', message: msg })
          toast('error', msg)
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [dispatch, parseSheet, toast],
  )

  return (
    <section className="panel" data-testid="file-import">
      <h2>文件导入</h2>
      <p className="muted">支持 CSV、XLSX、XLS、TXT 格式，拖拽或点击选择文件。</p>
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
          <span className="muted">正在解析文件…</span>
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
                    parseSheet(p.wb, p.name, s)
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
