import { describe, expect, it } from 'vitest'
import { checkQuality, countDuplicateRows } from '../quality'
import { profileDataset } from '../infer'
import type { Dataset } from '../../types'

function quality(ds: Dataset) {
  return checkQuality(ds, profileDataset(ds))
}

describe('checkQuality', () => {
  it('统计重复行', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['a', 'b'],
      rows: [
        [1, 'x'],
        [1, 'x'],
        [2, 'y'],
      ],
    }
    expect(countDuplicateRows(ds)).toBe(1)
    const r = quality(ds)
    expect(r.duplicateRows).toBe(1)
    expect(r.issues.some((i) => i.message.includes('重复'))).toBe(true)
  })

  it('报告缺失值及比例', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['a'],
      rows: [[1], [null], [null], [4]],
    }
    const r = quality(ds)
    const issue = r.issues.find((i) => i.message.includes('缺失值'))
    expect(issue?.message).toContain('2 个缺失值')
    expect(issue?.message).toContain('50.0%')
  })

  it('检测空列名和重复列名', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['', 'a', 'a'],
      rows: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    }
    const r = quality(ds)
    expect(r.issues.some((i) => i.message.includes('列名为空'))).toBe(true)
    expect(r.issues.some((i) => i.message.includes('重复出现'))).toBe(true)
  })

  it('检测常数列', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['const'],
      rows: [['x'], ['x'], ['x'], ['x']],
    }
    const r = quality(ds)
    expect(r.issues.some((i) => i.message.includes('常数列'))).toBe(true)
  })

  it('检测疑似 ID 列', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['user_id'],
      rows: Array.from({ length: 30 }, (_, i) => [`id-${i}`]),
    }
    const r = quality(ds)
    expect(r.issues.some((i) => i.message.includes('ID'))).toBe(true)
  })

  it('检测 IQR 异常值', () => {
    const normal = Array.from({ length: 40 }, (_, i) => [10 + (i % 10)])
    const ds: Dataset = { name: 't', columns: ['v'], rows: [...normal, [1000]] }
    const r = quality(ds)
    expect(r.issues.some((i) => i.message.includes('异常值'))).toBe(true)
  })

  it('检测文本形式存储的数字', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['金额'],
      rows: [['约100元'], ['200'], ['300'], ['400'], ['500'], ['600']],
    }
    const r = quality(ds)
    expect(r.issues.some((i) => i.message.includes('可转换为数值'))).toBe(true)
  })

  it('干净数据只有少量提示', () => {
    const ds: Dataset = {
      name: 't',
      columns: ['a', 'b'],
      rows: [
        [1, 'x'],
        [2, 'y'],
        [3, 'z'],
      ],
    }
    const r = quality(ds)
    expect(r.duplicateRows).toBe(0)
    expect(r.issues.filter((i) => i.level === 'warning')).toHaveLength(0)
  })
})
