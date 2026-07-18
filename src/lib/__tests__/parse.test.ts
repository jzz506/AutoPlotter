import { describe, expect, it } from 'vitest'
import { decodeText, detectDelimiter, parseCsvText, readWorkbook, sheetToDataset } from '../parse'
import * as XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'

const sampleDir = path.join(__dirname, '../../../sample-data')

describe('detectDelimiter', () => {
  it('识别逗号', () => {
    expect(detectDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',')
  })
  it('识别分号', () => {
    expect(detectDelimiter('产品;单价;库存\n苹果;5.5;320\n香蕉;3.2;150')).toBe(';')
  })
  it('识别制表符', () => {
    expect(detectDelimiter('姓名\t年龄\t城市\n小明\t23\t北京')).toBe('\t')
  })
})

describe('decodeText', () => {
  it('识别 UTF-8', () => {
    const buf = new TextEncoder().encode('列名1,列名2\n值1,值2')
    const { text, encoding } = decodeText(buf.buffer as ArrayBuffer)
    expect(encoding).toBe('UTF-8')
    expect(text).toContain('列名1')
  })
  it('识别 UTF-8 BOM', () => {
    const body = new TextEncoder().encode('a,b\n1,2')
    const buf = new Uint8Array([0xef, 0xbb, 0xbf, ...body])
    const { text, encoding } = decodeText(buf.buffer as ArrayBuffer)
    expect(encoding).toContain('BOM')
    expect(text.startsWith('a,b')).toBe(true)
  })
  it('回退到 GB18030 解码', () => {
    const buf = new Uint8Array([0xc4, 0xe3, 0xba, 0xc3, 0x2c, 0x62, 0x0a, 0x31, 0x2c, 0x32])
    const { encoding } = decodeText(buf.buffer as ArrayBuffer)
    expect(encoding).toBe('GB18030')
  })
})

describe('parseCsvText', () => {
  it('解析基本 CSV 并推断数值', () => {
    const r = parseCsvText('name,score\n小明,88\n小红,92\n', 't.csv')
    expect(r.error).toBeUndefined()
    expect(r.dataset?.columns).toEqual(['name', 'score'])
    expect(r.dataset?.rows).toEqual([
      ['小明', 88],
      ['小红', 92],
    ])
    expect(r.rowCount).toBe(2)
    expect(r.columnCount).toBe(2)
  })
  it('解析中文列名', () => {
    const r = parseCsvText('城市,人口\n杭州,1220\n', 't.csv')
    expect(r.dataset?.columns[0]).toBe('城市')
  })
  it('自动识别分号分隔符', () => {
    const r = parseCsvText('产品;单价\n苹果;5.5\n', 't.csv')
    expect(r.dataset?.columns).toEqual(['产品', '单价'])
    expect(r.warnings.some((w) => w.includes('分隔符'))).toBe(true)
  })
  it('自动识别制表符', () => {
    const r = parseCsvText('a\tb\n1\t2\n', 't.txt')
    expect(r.dataset?.columns).toEqual(['a', 'b'])
  })
  it('空文件返回明确错误', () => {
    const r = parseCsvText('', 'empty.csv')
    expect(r.error).toBeTruthy()
  })
  it('解析真实样例文件', () => {
    const text = fs.readFileSync(path.join(sampleDir, '时间序列数据.csv'), 'utf8')
    const r = parseCsvText(text, '时间序列数据.csv')
    expect(r.error).toBeUndefined()
    expect(r.rowCount).toBe(120)
    expect(r.columnCount).toBe(5)
  })
  it('缺失单元格转为 null', () => {
    const r = parseCsvText('a,b\n1,\n,2\n', 't.csv')
    expect(r.dataset?.rows[0]).toEqual([1, null])
    expect(r.dataset?.rows[1]).toEqual([null, 2])
  })
})

describe('Excel 解析', () => {
  const buildWb = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['甲', '乙'], [1, 'x'], [2, 'y']]), 'Sheet1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['丙'], [10]]), 'Sheet2')
    return wb
  }

  it('readWorkbook 读取工作表名', () => {
    const buf = XLSX.write(buildWb(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const { workbook, error } = readWorkbook(buf)
    expect(error).toBeUndefined()
    expect(workbook?.SheetNames).toEqual(['Sheet1', 'Sheet2'])
  })

  it('sheetToDataset 解析工作表', () => {
    const wb = buildWb()
    const r = sheetToDataset(wb, 'Sheet1', 'f.xlsx')
    expect(r.dataset?.columns).toEqual(['甲', '乙'])
    expect(r.rowCount).toBe(2)
  })

  it('不存在的工作表返回错误', () => {
    const r = sheetToDataset(buildWb(), 'Nope', 'f.xlsx')
    expect(r.error).toContain('Nope')
  })

  it('损坏的 Excel 返回错误', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xd8, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    const { error } = readWorkbook(buf.buffer as ArrayBuffer)
    expect(error).toBeTruthy()
  })

  it('解析真实多工作表文件', () => {
    const buf = fs.readFileSync(path.join(sampleDir, '多工作表数据.xlsx'))
    const { workbook, error } = readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    expect(error).toBeUndefined()
    expect(workbook?.SheetNames).toEqual(['月度销量', '地区汇总', '员工信息'])
    const r = sheetToDataset(workbook!, '月度销量', '多工作表数据.xlsx')
    expect(r.rowCount).toBe(12)
    expect(r.columnCount).toBe(4)
  })
})
