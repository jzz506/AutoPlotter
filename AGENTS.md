# AGENTS.md

本项目是 AutoPlotter：纯本地、纯前端的数据分析与绘图应用。

## 架构

- 无后端、无数据库、无网络调用。所有状态在 `src/state/AppContext.tsx`（useReducer）中管理。
- 原始数据（`state.original`）永不修改；处理步骤记录为 `Operation[]`（`src/types.ts`），`applyOperations` 纯函数派生工作数据。恢复原始数据 = 清空操作数组。
- 图表配置为可序列化的 `ChartConfig`；`buildChart`（`src/lib/chart.ts`）是纯函数，返回 Plotly traces 或中文错误信息。

## 目录约定

- `src/lib/`：纯函数模块，不依赖 DOM（export.ts 中的下载函数除外），全部有 Vitest 单测（`src/lib/__tests__/`）。
- `src/components/`：React 组件，通过 `useApp()` 访问状态。
- `e2e/`：Playwright 测试，样例文件取自 `sample-data/`。
- `scripts/make-sample-data.mjs`：重新生成示例数据。

## 开发守则

- TypeScript strict 模式；提交前必须依次通过：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
- 不要引入需要云服务、API Key 或后端的新依赖。
- 图表类型兼容性校验统一放在 `buildChart` 中，用中文返回错误，不生成误导性图表。
- 新增处理操作时：在 `types.ts` 的 `Operation` 联合类型中登记，在 `transform.ts` 实现，并在 `python.ts` 的 `opToPython` 中生成对应的 pandas 代码，三者保持语义一致。
- 多序列折线图约定：`ChartConfig.y` 用 `|` 分隔多个列名。

## 验证过的命令

- `npm run lint` → oxlint，0 错误
- `npm run typecheck` → tsc -b --noEmit
- `npm test` → vitest run
- `npm run test:e2e` → playwright test（自动启动 dev server，需先 `npx playwright install chromium`）

## 桌面应用（Tauri 2）

- Rust 侧代码在 `src-tauri/`（仅壳：dialog + fs 插件，无业务逻辑）。
- 窗口配置 `dragDropEnabled: false`，使 Finder 拖文件走 HTML5 drop 进入现有 FileImport 逻辑。
- `src/lib/export.ts` 的 `downloadBlob` 检测 `__TAURI_INTERNALS__`：桌面环境改用原生保存对话框（plugin-dialog + plugin-fs），网页环境保持 a[download]。
- `npm run tauri:build` 产出 `.app`；`npm run tauri:dmg` 再调用 `scripts/make-dmg.sh` 用 hdiutil 生成 DMG（不用 tauri 内置 dmg bundler，因其 AppleScript Finder 美化步骤在无头终端会超时失败）。
- 需要 Rust 工具链（rustup 安装的 stable），cargo bin 需在 PATH 中。
