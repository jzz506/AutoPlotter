import type * as XLSX from 'xlsx'

let workbook: XLSX.WorkBook | null = null
let fileName = ''

export function setWorkbook(wb: XLSX.WorkBook | null, name: string) {
  workbook = wb
  fileName = name
}

export function getWorkbook(): { workbook: XLSX.WorkBook | null; fileName: string } {
  return { workbook, fileName }
}
