import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../src-tauri/icons')
fs.mkdirSync(outDir, { recursive: true })

const SIZE = 1024
const RADIUS = 224

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const bg = [37, 99, 235]
const bgDark = [29, 78, 216]
const white = [255, 255, 255]

const bars = [
  { x: 232, w: 120, top: 560 },
  { x: 392, w: 120, top: 430 },
  { x: 552, w: 120, top: 300 },
  { x: 712, w: 120, top: 200 },
]
const baseline = 800

function inRoundRect(x, y) {
  const x0 = 0
  const y0 = 0
  const x1 = SIZE - 1
  const y1 = SIZE - 1
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + RADIUS), x1 - RADIUS)
  const cy = Math.min(Math.max(y, y0 + RADIUS), y1 - RADIUS)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= RADIUS * RADIUS
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
let p = 0
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0
  for (let x = 0; x < SIZE; x++) {
    let px = [0, 0, 0, 0]
    if (inRoundRect(x, y)) {
      const t = y / SIZE
      px = [
        Math.round(bg[0] + (bgDark[0] - bg[0]) * t),
        Math.round(bg[1] + (bgDark[1] - bg[1]) * t),
        Math.round(bg[2] + (bgDark[2] - bg[2]) * t),
        255,
      ]
      for (const b of bars) {
        if (x >= b.x && x < b.x + b.w && y >= b.top && y <= baseline) {
          px = [...white, 255]
        }
      }
      if (y > baseline - 8 && y <= baseline && x >= 200 && x <= 864) {
        px = [...white, 255]
      }
      if (x >= 200 && x < 208 && y >= 160 && y <= baseline) {
        px = [...white, 255]
      }
    }
    raw[p++] = px[0]
    raw[p++] = px[1]
    raw[p++] = px[2]
    raw[p++] = px[3]
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

fs.writeFileSync(path.join(outDir, 'icon-source.png'), png)
console.log('icon-source.png written:', png.length, 'bytes')
