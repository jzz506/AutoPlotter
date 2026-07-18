import { decodeText, looksLikeBinary, parseCsvText, readWorkbook, sheetToDataset } from '../lib/parse'

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage: (msg: unknown, transfer?: Transferable[]) => void
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data
  const id: number = msg.id
  try {
    if (msg.type === 'parse-text') {
      const buffer: ArrayBuffer = msg.buffer
      if (looksLikeBinary(buffer)) {
        ctx.postMessage({ id, type: 'error', error: '文件内容疑似二进制数据或已损坏，无法作为文本解析' })
        return
      }
      const { text, encoding } = decodeText(buffer)
      const result = parseCsvText(text, msg.name, undefined, (ratio) => {
        ctx.postMessage({ id, type: 'progress', ratio })
      })
      ctx.postMessage({ id, type: 'done', result, encoding })
      return
    }
    if (msg.type === 'list-sheets') {
      const { workbook, error } = readWorkbook(msg.buffer)
      ctx.postMessage({ id, type: 'sheets', sheets: workbook?.SheetNames ?? [], error })
      return
    }
    if (msg.type === 'parse-sheet') {
      const { workbook, error } = readWorkbook(msg.buffer)
      if (error || !workbook) {
        ctx.postMessage({ id, type: 'error', error: error ?? 'Excel 解析失败' })
        return
      }
      ctx.postMessage({ id, type: 'progress', ratio: 0.6 })
      const result = sheetToDataset(workbook, msg.sheetName, msg.name)
      ctx.postMessage({ id, type: 'done', result, encoding: null, sheets: workbook.SheetNames, sheetName: msg.sheetName })
      return
    }
    ctx.postMessage({ id, type: 'error', error: `未知消息类型：${String(msg.type)}` })
  } catch (err) {
    ctx.postMessage({ id, type: 'error', error: `解析失败：${err instanceof Error ? err.message : String(err)}` })
  }
}
