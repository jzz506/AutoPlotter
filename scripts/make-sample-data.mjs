import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'sample-data')
fs.mkdirSync(outDir, { recursive: true })

const write = (name, content) => fs.writeFileSync(path.join(outDir, name), content, 'utf8')

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

{
  const rnd = mulberry32(42)
  const lines = ['日期,温度,湿度,销量,客流量']
  const start = new Date('2024-01-01T00:00:00Z').getTime()
  for (let i = 0; i < 120; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10)
    const temp = 15 + 12 * Math.sin((i / 365) * 2 * Math.PI * 4) + (rnd() - 0.5) * 4
    const hum = 60 + 20 * Math.sin((i / 365) * 2 * Math.PI * 2 + 1) + (rnd() - 0.5) * 8
    const sales = 200 + i * 1.5 + 80 * Math.sin(i / 7) + (rnd() - 0.5) * 40
    const traffic = 1000 + i * 5 + 300 * Math.sin(i / 7 + 0.5) + (rnd() - 0.5) * 150
    lines.push(`${d},${temp.toFixed(1)},${hum.toFixed(1)},${sales.toFixed(0)},${traffic.toFixed(0)}`)
  }
  write('时间序列数据.csv', lines.join('\n'))
}

{
  const rnd = mulberry32(7)
  const depts = ['研发部', '市场部', '销售部', '人事部']
  const regions = ['华东', '华北', '华南', '西南']
  const lines = ['部门,地区,员工数,季度销售额,满意度']
  for (const d of depts) {
    for (const r of regions) {
      for (let q = 1; q <= 4; q++) {
        lines.push(
          `${d},${r},${Math.floor(5 + rnd() * 40)},${(50 + rnd() * 200).toFixed(1)},${(3 + rnd() * 2).toFixed(1)}`,
        )
      }
    }
  }
  write('类别统计数据.csv', lines.join('\n'))
}

{
  const rnd = mulberry32(99)
  const lines = ['学习时间,考试成绩']
  for (let i = 0; i < 200; i++) {
    const hours = rnd() * 40
    const score = 40 + hours * 1.3 + (rnd() - 0.5) * 15
    lines.push(`${hours.toFixed(1)},${Math.min(100, Math.max(0, score)).toFixed(1)}`)
  }
  write('双数值变量数据.csv', lines.join('\n'))
}

{
  const lines = [
    '城市,省份,人口(万),GDP(亿元),是否省会',
    '杭州,浙江,1220,18753,是',
    '南京,江苏,942,16907,是',
    '苏州,江苏,1274,23958,否',
    '宁波,浙江,954,15704,否',
    '合肥,安徽,946,12013,是',
    '无锡,江苏,746,14851,否',
    '济南,山东,920,11432,是',
    '青岛,山东,1007,14921,否',
    '福州,福建,829,11324,是',
    '厦门,福建,528,7803,否',
  ]
  write('中文列名数据.csv', lines.join('\n'))
}

{
  const lines = [
    '订单号,客户,金额,折扣,下单日期,备注',
    '1,张三,230.5,0.1,2024-01-05,正常',
    '2,李四,1280,0.2,2024-01-06,大客户',
    '3,王五,,0.1,2024-01-06,',
    '4,赵六,560,abc,2024-01-07,折扣异常',
    '4,赵六,560,abc,2024-01-07,折扣异常',
    '5,孙七,99999,0.5,2024-01-08,金额异常',
    '6,周八,320,0.05,,日期缺失',
    '7,吴九,1,0,2024-01-09,小额',
    '8,郑十,450,0.15,2024/01/10,日期格式不同',
    '9,钱一,文本金额,0.1,2024-01-11,金额异常',
    '10,孙七,880,,2024-01-12,',
    '11,李四,1200,0.2,2024-01-13,大客户',
    '12,张三,-50,0.1,2024-01-14,负值异常',
    '13,周八,760,0.1,2024-01-15,正常',
  ]
  write('缺失异常数据.csv', lines.join('\n'))
}

{
  const wb = XLSX.utils.book_new()
  const sales = [
    ['月份', '产品A', '产品B', '产品C'],
    ...Array.from({ length: 12 }, (_, i) => [
      `2024-${String(i + 1).padStart(2, '0')}`,
      Math.round(100 + Math.random() * 100),
      Math.round(80 + Math.random() * 80),
      Math.round(50 + Math.random() * 60),
    ]),
  ]
  const regions = [
    ['地区', '门店数', '年销售额'],
    ['华东', 42, 5200],
    ['华北', 35, 4100],
    ['华南', 28, 3800],
    ['西部', 16, 1900],
  ]
  const staff = [
    ['姓名', '部门', '入职日期', '月薪'],
    ['张伟', '研发部', '2021-03-15', 28000],
    ['王芳', '市场部', '2020-07-01', 22000],
    ['李强', '销售部', '2022-01-10', 18000],
    ['赵敏', '研发部', '2019-11-20', 32000],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sales), '月度销量')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(regions), '地区汇总')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(staff), '员工信息')
  XLSX.writeFile(wb, path.join(outDir, '多工作表数据.xlsx'))
}

write('分号分隔数据.csv', '产品;单价;库存;产地\n苹果;5.5;320;山东\n香蕉;3.2;150;海南\n橙子;6.8;210;江西\n葡萄;12.0;80;新疆\n')
write('制表符分隔数据.txt', '姓名\t年龄\t城市\t分数\n小明\t23\t北京\t88\n小红\t31\t上海\t92\n小刚\t27\t广州\t75\n小丽\t29\t深圳\t95\n')
write('逗号分隔数据.csv', 'name,value,category\nalpha,10,A\nbeta,20,B\ngamma,30,A\n')

{
  const garbage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
  fs.writeFileSync(path.join(outDir, '损坏文件.csv'), garbage)
}
write('伪装Excel.xlsx', '这不是一个真正的 Excel 文件，只是改了扩展名的文本文件。\n')

console.log('sample data generated in', outDir)
