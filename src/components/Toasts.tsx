import { useEffect } from 'react'
import { useApp } from '../state/AppContext'

export default function Toasts() {
  const { state, dispatch } = useApp()
  useEffect(() => {
    if (state.toasts.length === 0) return
    const timers = state.toasts.map((t) =>
      setTimeout(() => dispatch({ type: 'DISMISS_TOAST', id: t.id }), 4000),
    )
    return () => timers.forEach(clearTimeout)
  }, [state.toasts, dispatch])

  return (
    <div className="toast-wrap" data-testid="toasts">
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dispatch({ type: 'DISMISS_TOAST', id: t.id })}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
