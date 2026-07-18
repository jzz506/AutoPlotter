import { createContext, useContext } from 'react'
import type { ChartConfig, Dataset, Operation } from '../types'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

export interface AppState {
  status: 'idle' | 'parsing' | 'ready' | 'error'
  progress: number
  error: string | null
  warnings: string[]
  fileName: string | null
  sheetName: string | null
  original: Dataset | null
  operations: Operation[]
  chart: ChartConfig | null
  toasts: Toast[]
}

export const initialState: AppState = {
  status: 'idle',
  progress: 0,
  error: null,
  warnings: [],
  fileName: null,
  sheetName: null,
  original: null,
  operations: [],
  chart: null,
  toasts: [],
}

export type Action =
  | { type: 'PARSE_START' }
  | { type: 'PARSE_PROGRESS'; ratio: number }
  | { type: 'PARSE_CANCEL' }
  | { type: 'PARSE_SUCCESS'; dataset: Dataset; fileName: string; sheetName?: string; warnings: string[] }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'SET_OPERATIONS'; operations: Operation[] }
  | { type: 'SET_CHART'; chart: ChartConfig | null }
  | { type: 'TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: number }
  | { type: 'RESET' }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'PARSE_START':
      return { ...state, status: 'parsing', progress: 0, error: null, warnings: [] }
    case 'PARSE_PROGRESS':
      return { ...state, progress: action.ratio }
    case 'PARSE_CANCEL':
      return { ...state, status: state.original ? 'ready' : 'idle', progress: 0, error: null }
    case 'PARSE_SUCCESS':
      return {
        ...state,
        status: 'ready',
        progress: 1,
        original: action.dataset,
        fileName: action.fileName,
        sheetName: action.sheetName ?? null,
        warnings: action.warnings,
        operations: [],
        chart: null,
        error: null,
      }
    case 'PARSE_ERROR':
      return { ...state, status: 'error', error: action.message, progress: 0 }
    case 'SET_OPERATIONS':
      return { ...state, operations: action.operations, chart: state.chart }
    case 'SET_CHART':
      return { ...state, chart: action.chart }
    case 'TOAST':
      return { ...state, toasts: [...state.toasts.slice(-4), action.toast] }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'RESET':
      return initialState
  }
}

export interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppContext.Provider')
  return ctx
}
