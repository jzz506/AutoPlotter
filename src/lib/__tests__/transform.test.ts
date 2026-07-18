import { describe, expect, it } from 'vitest'
import { applyOperation, applyOperations } from '../transform'
import type { Dataset } from '../../types'

const ds: Dataset = {
  name: 't',
  columns: ['num', 'cat', 'dt'],
  rows: [
    [3, 'b', '2024-01-03'],
    [1, 'a', '2024-01-01'],
    [null, 'a', 'bad-date'],
    [2, 'b', '2024-01-02'],
    [1, 'a', '2024-01-01'],
  ],
}

describe('applyOperation', () => {
  it('删除含缺失值的行', () => {
    const r = applyOperation(ds, { kind: 'dropMissingRows' })
    expect(r.rows).toHaveLength(4)
  })
  it('均值填补缺失', () => {
    const r = applyOperation(ds, { kind: 'fillMissing', column: 'num', method: 'mean' })
    expect(r.rows[2][0]).toBeCloseTo((3 + 1 + 2 + 1) / 4)
  })
  it('中位数填补缺失', () => {
    const r = applyOperation(ds, { kind: 'fillMissing', column: 'num', method: 'median' })
    expect(r.rows[2][0]).toBe(1.5)
  })
  it('众数填补缺失', () => {
    const d2: Dataset = { ...ds, rows: [[null], ['a'], ['b'], ['a']] }
    const r = applyOperation({ ...d2, columns: ['c'] }, { kind: 'fillMissing', column: 'c', method: 'mode' })
    expect(r.rows[0][0]).toBe('a')
  })
  it('删除重复行', () => {
    const r = applyOperation(ds, { kind: 'dropDuplicates' })
    expect(r.rows).toHaveLength(4)
  })
  it('文本转数值', () => {
    const d2: Dataset = { name: 't', columns: ['v'], rows: [['1,234'], ['5.6'], ['abc'], [null]] }
    const r = applyOperation(d2, { kind: 'textToNumber', column: 'v' })
    expect(r.rows[0][0]).toBe(1234)
    expect(r.rows[1][0]).toBe(5.6)
    expect(r.rows[2][0]).toBe('abc')
    expect(r.rows[3][0]).toBeNull()
  })
  it('转换为日期', () => {
    const r = applyOperation(ds, { kind: 'toDate', column: 'dt' })
    expect(r.rows[0][2]).toBe('2024-01-03')
    expect(r.rows[2][2]).toBe('bad-date')
  })
  it('保留列', () => {
    const r = applyOperation(ds, { kind: 'keepColumns', columns: ['cat', 'num'] })
    expect(r.columns).toEqual(['cat', 'num'])
    expect(r.rows[0]).toEqual(['b', 3])
  })
  it('排序', () => {
    const asc = applyOperation(ds, { kind: 'sort', column: 'num', order: 'asc' })
    expect(asc.rows[0][0]).toBe(1)
    const desc = applyOperation(ds, { kind: 'sort', column: 'num', order: 'desc' })
    expect(desc.rows[0][0]).toBe(3)
  })
  it('按类别筛选', () => {
    const r = applyOperation(ds, { kind: 'filterCategory', column: 'cat', values: ['a'] })
    expect(r.rows.every((row) => row[1] === 'a')).toBe(true)
    expect(r.rows).toHaveLength(3)
  })
  it('按数值范围筛选', () => {
    const r = applyOperation(ds, { kind: 'filterRange', column: 'num', min: 2, max: 3 })
    expect(r.rows).toHaveLength(2)
  })
  it('组合操作链', () => {
    const r = applyOperations(ds, [
      { kind: 'dropMissingRows' },
      { kind: 'filterCategory', column: 'cat', values: ['b'] },
      { kind: 'sort', column: 'num', order: 'asc' },
    ])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0][0]).toBe(2)
  })
  it('不修改原数据集', () => {
    applyOperation(ds, { kind: 'dropMissingRows' })
    expect(ds.rows).toHaveLength(5)
  })
})
