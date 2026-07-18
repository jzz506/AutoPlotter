import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { generatePythonScript } from '../lib/python'
import { downloadText } from '../lib/export'

export default function CodePanel() {
  const { state, dispatch } = useApp()
  const [copied, setCopied] = useState(false)
  const script = useMemo(() => {
    if (!state.fileName) return ''
    return generatePythonScript({
      fileName: state.fileName,
      sheetName: state.sheetName ?? undefined,
      operations: state.operations,
      chart: state.chart,
    })
  }, [state.fileName, state.sheetName, state.operations, state.chart])

  if (!state.original) {
    return (
      <section className="panel">
        <h2>可复现代码</h2>
        <div className="empty-state">导入数据后，这里会生成可独立运行的 Python 脚本。</div>
      </section>
    )
  }

  return (
    <section className="panel" data-testid="code-panel">
      <h2>可复现代码</h2>
      <p className="muted">
        根据当前数据处理步骤和绘图配置生成。运行前请安装依赖：
        <code>pip install pandas plotly openpyxl xlrd kaleido</code>
      </p>
      <div className="row">
        <button
          className="btn"
          data-testid="btn-copy-script"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(script)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              dispatch({ type: 'TOAST', toast: { id: Date.now(), kind: 'error', message: '复制失败，请手动选择文本复制' } })
            }
          }}
        >{copied ? '已复制' : '复制脚本'}</button>
        <button className="btn" data-testid="btn-download-script" onClick={() => downloadText(script, 'autoplotter_reproduce.py')}>
          下载 .py 脚本
        </button>
      </div>
      <pre className="code-block" data-testid="python-script"><code>{script}</code></pre>
    </section>
  )
}
