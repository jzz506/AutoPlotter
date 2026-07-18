# AutoPlotter

本地可视化自动数据分析与绘图应用。所有数据仅在本机浏览器内存中处理，**无后端、不上传任何数据**。

当前版本：**1.0.1**（更新日志见 [CHANGELOG.md](CHANGELOG.md)）

## 环境要求

- 使用网页版：macOS + Node.js 20 或更高版本
- 构建桌面版：另需 Rust 工具链（`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`）
- 直接安装：打开 `dist-dmg/AutoPlotter_1.0.1_aarch64.dmg`（Apple Silicon Mac），无需任何开发环境

## 功能

- **文件导入**：拖拽或点击上传 CSV / XLSX / XLS / TXT；自动识别分隔符（逗号、分号、制表符）与常见编码（UTF-8 / UTF-16 / GB18030）；Excel 多工作表选择；解析进度显示；损坏文件与超限文件的明确提示。
- **数据概览**：自动推断列类型（数值 / 类别文本 / 日期时间 / 布尔值 / 无法识别），展示非空、缺失、唯一值及数值统计（最小/最大/均值/中位数/标准差）、文本高频值、日期起止。
- **质量报告**：缺失值、重复行、空列名、重复列名、常数列、疑似 ID 列、IQR 异常值、文本数字、日期解析失败、高基数类别列。只报告不修改。
- **数据处理**：删除缺失行、均值/中位数/众数填补、去重、文本转数值、转日期、保留列、排序、类别筛选、数值范围筛选、一键恢复原始数据。所有操作只作用于内存副本。
- **推荐图表**：基于确定性本地规则的图表推荐（折线、散点、柱状、箱线、直方图、频数柱状、相关性热图、多序列折线），每条推荐附理由并可一键采用。
- **手动绘图**：9 种图表（折线/散点/柱状/水平柱状/直方图/箱线/小提琴/饼图/相关性热图），可调整轴列、颜色分组、聚合、排序、标题、轴名、图例、网格、宽高、字号、主题；类型不兼容时给出中文解释。
- **导出**：PNG、SVG、独立可交互 HTML（内嵌 Plotly，离线可打开）、处理后 CSV / XLSX、图表配置 JSON。
- **可复现代码**：根据当前处理步骤和绘图配置生成可直接运行的 Python（pandas + plotly）脚本。

## 快速开始（macOS）

### 桌面应用（推荐）

双击打开 `dist-dmg/AutoPlotter_1.0.1_aarch64.dmg`（或自行构建，见下），将 AutoPlotter 拖入 Applications 即可。无需 Apple Developer 账号，未做付费签名；首次打开如提示"无法验证开发者"，在 系统设置 → 隐私与安全性 中允许，或右键 → 打开。

自行构建桌面应用：

```bash
npm install
npm run tauri:build   # 产出 src-tauri/target/release/bundle/macos/AutoPlotter.app
npm run tauri:dmg     # 同时生成 src-tauri/target/release/bundle/dmg/AutoPlotter_1.0.1_aarch64.dmg
```

桌面版基于 Tauri 2（系统 WebView），支持从 Finder 直接拖拽 CSV / XLSX / XLS / TXT 到窗口；导出文件时弹出原生保存对话框。数据仍然只在本机处理。

### 网页开发模式

双击 `start.command` 即可：脚本会检查 Node.js、按需安装依赖、启动应用并自动打开浏览器。无需 sudo。

## 手动启动

```bash
npm install
npm run dev        # http://localhost:5173
```

## 其他命令

```bash
npm run build      # 生产构建（tsc + vite build）
npm run preview    # 预览生产构建
npm run lint       # oxlint 静态检查
npm run typecheck  # TypeScript 严格检查
npm test           # Vitest 单元测试
npm run test:e2e   # Playwright 端到端测试（需先 npx playwright install chromium）
```

## 示例数据

`sample-data/` 目录包含：时间序列、类别统计、双数值、中文列名、缺失异常、多工作表 Excel、逗号/分号/制表符分隔文件及损坏文件样本。可用 `node scripts/make-sample-data.mjs` 重新生成。

## 技术栈

React 19 + TypeScript（strict）+ Vite 8 + Papa Parse + SheetJS (xlsx) + Plotly.js + Vitest + Playwright。纯前端架构，无服务端。

## 隐私

数据仅在当前浏览器中处理，不会上传至服务器。关闭页面后数据即消失。
