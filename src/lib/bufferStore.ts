let buffer: ArrayBuffer | null = null
let fileName = ''
let sheetNames: string[] = []

export function setSourceFile(buf: ArrayBuffer | null, name: string, sheets: string[] = []) {
  buffer = buf
  fileName = name
  sheetNames = sheets
}

export function getSourceFile(): { buffer: ArrayBuffer | null; fileName: string; sheetNames: string[] } {
  return { buffer, fileName, sheetNames }
}
