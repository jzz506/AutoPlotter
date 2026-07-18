import { useMemo, useReducer, useState } from 'react'
import { AppContext, initialState, reducer } from './state/AppContext'
import { applyOperations } from './lib/transform'
import { profileDataset } from './lib/infer'
import { checkQuality } from './lib/quality'
import { recommendCharts } from './lib/recommend'
import { getSourceFile } from './lib/bufferStore'
import { parseSheetInWorker } from './lib/parseClient'
import FileImport from './components/FileImport'
import DataOverview from './components/DataOverview'
import QualityReportPanel from './components/QualityReportPanel'
import DataPreview from './components/DataPreview'
import DataProcessing from './components/DataProcessing'
import RecommendPanel from './components/RecommendPanel'
import ChartBuilder from './components/ChartBuilder'
import CodePanel from './components/CodePanel'
import ExportPanel from './components/ExportPanel'
import Toasts from './components/Toasts'

const TABS = [
  { id: 'import', label: '文件导入' },
  { id: 'overview', label: '数据概览' },
  { id: 'quality', label: '质量报告' },
  { id: 'preview', label: '数据预览' },
  { id: 'process', label: '数据处理' },
  { id: 'recommend', label: '推荐图表' },
  { id: 'chart', label: '手动绘图' },
  { id: 'code', label: '可复现代码' },
  { id: 'export', label: '导出' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [tab, setTab] = useState<TabId>('import')

  const working = useMemo(
    () => (state.original ? applyOperations(state.original, state.operations) : null),
    [state.original, state.operations],
  )
  const profiles = useMemo(() => (working ? profileDataset(working) : []), [working])
  const report = useMemo(
    () => (state.original ? checkQuality(state.original, profileDataset(state.original)) : null),
    [state.original],
  )
  const recommendations = useMemo(
    () => (working ? recommendCharts(profiles, working.rows.length) : []),
    [working, profiles],
  )

  const { buffer: sourceBuffer, fileName: srcFileName, sheetNames } = getSourceFile()
  const hasData = state.status === 'ready' && working !== null

  const switchSheet = async (sheetName: string) => {
    if (!sourceBuffer) return
    dispatch({ type: 'PARSE_START' })
    try {
      const { result } = await parseSheetInWorker(srcFileName, sourceBuffer, sheetName, (ratio) =>
        dispatch({ type: 'PARSE_PROGRESS', ratio }),
      )
      if (result.error || !result.dataset) {
        dispatch({ type: 'PARSE_ERROR', message: result.error ?? '工作表解析失败' })
        return
      }
      dispatch({
        type: 'PARSE_SUCCESS',
        dataset: result.dataset,
        fileName: srcFileName,
        sheetName,
        warnings: result.warnings,
      })
    } catch (e) {
      if (e instanceof Error && e.message === '已取消解析') return
      dispatch({ type: 'PARSE_ERROR', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="app">
        <header className="app-header">
          <div>
            <h1>AutoPlotter</h1>
            <span className="muted">本地可视化自动数据分析与绘图</span>
          </div>
          <div className="privacy-badge" data-testid="privacy-badge">
            数据仅在当前浏览器中处理，不会上传至服务器。
          </div>
        </header>

        <nav className="tabs" data-testid="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              data-testid={`tab-${t.id}`}
              disabled={t.id !== 'import' && !hasData && t.id !== 'code'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {sheetNames.length > 1 && hasData && (
          <div className="sheet-bar" data-testid="sheet-bar">
            <span>工作表：</span>
            {sheetNames.map((s) => (
              <button
                key={s}
                className={`btn btn-ghost small-btn${state.sheetName === s ? ' active-sheet' : ''}`}
                data-testid={`sheet-${s}`}
                onClick={() => void switchSheet(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <main>
          {tab === 'import' && (
            <>
              <FileImport />
              {!hasData && state.status !== 'parsing' && (
                <div className="empty-state large" data-testid="welcome-empty">
                  <p>还没有数据。请拖入 CSV、XLSX、XLS 或 TXT 文件开始分析。</p>
                  <p className="muted">所有计算均在本机浏览器内存中完成。</p>
                </div>
              )}
            </>
          )}
          {tab === 'overview' && hasData && (
            <DataOverview dataset={working} profiles={profiles} fileName={state.fileName} sheetName={state.sheetName} />
          )}
          {tab === 'quality' && report && <QualityReportPanel report={report} />}
          {tab === 'preview' && hasData && <DataPreview dataset={working} totalRows={state.original!.rows.length} />}
          {tab === 'process' && hasData && <DataProcessing working={working} profiles={profiles} />}
          {tab === 'recommend' && hasData && (
            <RecommendPanel
              recommendations={recommendations}
              onUse={(rec) => {
                dispatch({ type: 'SET_CHART', chart: rec.config })
                dispatch({ type: 'TOAST', toast: { id: Date.now(), kind: 'success', message: `已采用推荐：${rec.title}` } })
                setTab('chart')
              }}
            />
          )}
          {tab === 'chart' && hasData && <ChartBuilder working={working} profiles={profiles} />}
          {tab === 'code' && <CodePanel />}
          {tab === 'export' && hasData && <ExportPanel working={working} profiles={profiles} />}
          {tab !== 'import' && !hasData && tab !== 'code' && (
            <div className="empty-state large">请先在“文件导入”中加载数据文件。</div>
          )}
        </main>

        <footer className="app-footer">
          <span className="muted">AutoPlotter v1.0.1 · 纯本地运行 · 无后端 · 不上传任何数据</span>
        </footer>
        <Toasts />
      </div>
    </AppContext.Provider>
  )
}
