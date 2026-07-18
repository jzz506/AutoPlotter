import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../sample-data/stress')
fs.mkdirSync(outDir, { recursive: true })

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCsv(file, n, seed) {
  const rnd = mulberry32(seed)
  const groups = ['甲组', '乙组', '丙组', '丁组', '戊组']
  const regions = ['华东', '华北', '华南', '西南', '西北', '东北']
  const chunks = ['日期,组别,地区,指标A,指标B,指标C\n']
  const start = Date.UTC(2020, 0, 1)
  for (let i = 0; i < n; i++) {
    const d = new Date(start + (i % 1826) * 86400000).toISOString().slice(0, 10)
    const g = groups[i % 5]
    const r = regions[Math.floor(rnd() * 6)]
    const a = (100 + 50 * Math.sin(i / 500) + (rnd() - 0.5) * 30).toFixed(2)
    const b = (50 + i * 0.001 + (rnd() - 0.5) * 20).toFixed(2)
    const c = (rnd() * 1000).toFixed(2)
    chunks.push(`${d},${g},${r},${a},${b},${c}\n`)
    if (chunks.length > 20000) {
      fs.appendFileSync(file, chunks.join(''), 'utf8')
      chunks.length = 0
    }
  }
  fs.appendFileSync(file, chunks.join(''), 'utf8')
}

const f1 = path.join(outDir, '压力测试-10万行.csv')
const f2 = path.join(outDir, '压力测试-50万行.csv')
fs.writeFileSync(f1, '', 'utf8')
fs.writeFileSync(f2, '', 'utf8')
makeCsv(f1, 100000, 11)
makeCsv(f2, 500000, 22)
const s1 = (fs.statSync(f1).size / 1024 / 1024).toFixed(1)
const s2 = (fs.statSync(f2).size / 1024 / 1024).toFixed(1)
console.log(`10万行: ${s1} MB, 50万行: ${s2} MB`)
