import type { ParseResult } from '../types'

interface PendingEntry {
  resolve: (value: Record<string, unknown>) => void
  reject: (reason: Error) => void
  onProgress?: (ratio: number) => void
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, PendingEntry>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/parse.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data
    const entry = pending.get(msg.id)
    if (!entry) return
    if (msg.type === 'progress') {
      entry.onProgress?.(msg.ratio)
      return
    }
    pending.delete(msg.id)
    if (msg.type === 'error') {
      entry.reject(new Error(msg.error))
    } else {
      entry.resolve(msg)
    }
  }
  worker.onerror = (e) => {
    const err = new Error(`解析线程错误：${e.message ?? '未知错误'}`)
    for (const entry of pending.values()) entry.reject(err)
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export function cancelParse() {
  if (worker) {
    worker.terminate()
    worker = null
  }
  const err = new Error('已取消解析')
  for (const entry of pending.values()) entry.reject(err)
  pending.clear()
}

function call(
  msg: Record<string, unknown>,
  transfer: Transferable[],
  onProgress?: (ratio: number) => void,
): Promise<Record<string, unknown>> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    ensureWorker().postMessage({ ...msg, id }, transfer)
  })
}

export interface ParseTextOutcome {
  result: ParseResult
  encoding: string
}

export function parseTextInWorker(
  name: string,
  buffer: ArrayBuffer,
  onProgress?: (ratio: number) => void,
): Promise<ParseTextOutcome> {
  return call({ type: 'parse-text', name, buffer }, [buffer], onProgress).then((msg) => ({
    result: msg.result as ParseResult,
    encoding: msg.encoding as string,
  }))
}

export function listSheetsInWorker(buffer: ArrayBuffer): Promise<string[]> {
  const copy = buffer.slice(0)
  return call({ type: 'list-sheets', buffer: copy }, [copy]).then((msg) => {
    if (msg.error) throw new Error(msg.error as string)
    return msg.sheets as string[]
  })
}

export interface ParseSheetOutcome {
  result: ParseResult
  sheets: string[]
  sheetName: string
}

export function parseSheetInWorker(
  name: string,
  buffer: ArrayBuffer,
  sheetName: string,
  onProgress?: (ratio: number) => void,
): Promise<ParseSheetOutcome> {
  const copy = buffer.slice(0)
  return call({ type: 'parse-sheet', name, buffer: copy, sheetName }, [copy], onProgress).then((msg) => ({
    result: msg.result as ParseResult,
    sheets: msg.sheets as string[],
    sheetName: msg.sheetName as string,
  }))
}
