# Pretext Reader — 下一阶段开发计划

> 更新日期：2026-07-15  
> 项目路径：`C:\code\pretext`  
> 基准状态：当前工作区源码快照（包含未提交和未跟踪文件，不等同于 Git HEAD）  
> 结论先行：当前项目已经在核心排版链路中使用 `@chenglou/pretext`；下一步重点不是“接入 Pretext”，而是把已经实现的阅读器能力收敛到稳定、可验收、接近 Textdance 视觉体验的产品状态。

---

## 1. 当前结论

### 1.1 是否使用了 `chenglou/pretext` 的技术？

是，当前代码已经明确使用了 `@chenglou/pretext`。

证据：

- `frontend/package.json` 依赖：`"@chenglou/pretext": "^0.0.7"`。
- `frontend/src/lib/pretext-engine.ts` 动态调用：
  - `prepareWithSegments`
  - `layoutWithLines`
  - `layoutNextLineRange`
  - `materializeLineRange`
- `frontend/src/workers/pretext.worker.ts` 在 Web Worker 内直接导入 `@chenglou/pretext`，用于离主线程排版。
- `zotero-plugin/package.json` 也依赖 `@chenglou/pretext`。
- `zotero-plugin/src/canvas-reader.ts` 独立使用 `prepareWithSegments` 与 `layoutWithLines`。

所以当前实现不是只参考了 Pretext 思路，而是已经把 Pretext 作为文本测量、断行、多栏分页的核心引擎使用。

### 1.2 与旧版计划相比，当前实现已经推进的部分

旧版计划里不少“待实现/缺失”的事项，在当前代码里已经完成或部分完成：

| 旧计划项 | 当前状态 |
|---|---|
| 统一内容输入 `SmartInput` | 已实现：`frontend/src/components/content/SmartInput.tsx` |
| `useBackgroundVideo` 缺失 | 已实现：`frontend/src/hooks/useBackgroundVideo.ts` |
| CSS 按段落数分页缺陷 | 已基本移除；CSS fallback 也优先使用 Pretext 页/栏/行数据 |
| `layoutPagesWithMask()` 未集成 | 已集成到 `usePretext()`，有背景视频时走 mask-aware layout |
| 视频分析只有低分辨率亮度检测 | 已升级：160px 宽采样 + Sobel + 膨胀 + 连通域 + per-row spans |
| 背景视频重新采样/移除按钮缺失 | 已实现：`BackgroundControls.tsx` |
| Canvas 背景视频未传入 | 已传入共享 `videoRef`，Canvas RAF 内会绘制视频帧 |
| 滚轮翻页缺失 | 已实现滚轮累积阈值翻页 |
| 翻页动画缺失 | 已有 `flip-fwd` / `flip-back` CSS 动画 |
| 前端测试缺失 | 已有 Vitest 测试与若干 contract scripts |

### 1.3 当前核心判断

项目现在处于“功能骨架已经成型，但产品体验与工程稳定性还需要收敛”的阶段。

下一步开发不建议继续按旧计划大拆大建，而建议采用下面的流程：

1. 先修 P0 正确性问题，确保 Canvas 默认路径稳定。
2. 再对齐 Textdance 的关键视觉体验，尤其是气泡/文字 reveal 效果。
3. 然后做性能、E2E、Zotero 共用内核和发布前收口。

---

## 2. 当前实现快照

### 2.1 后端

当前后端是 FastAPI 应用，入口为：

- `backend/app/main.py`
- `backend/app/api/routes.py`

已实现 API：

- `GET /api/v1/health`
- `POST /api/v1/file/upload`
- `POST /api/v1/text/extract`
- `GET /api/v1/arxiv/{id}`
- `POST /api/v1/url/fetch`
- `GET /api/v1/samples`
- `GET /api/v1/samples/{id}`
- `DELETE /api/v1/cache/{key}`
- `DELETE /api/v1/cache`

已实现能力：

- 文件上传与校验：扩展名、大小、MIME/魔术字节、编码、危险内容、空内容。
- 文本提取：PDF、TXT、Markdown、HTML、DOCX、EPUB、LaTeX。
- URL 正文抓取：`aiohttp` + `readability` + `BeautifulSoup`。
- ArXiv 抓取：元数据、PDF 下载/提取、摘要 fallback。
- 缓存服务：本地缓存目录。
- 中间件：JSON 请求日志、简单 IP rate limit、CORS。
- 可选 OCR：`ENABLE_OCR=true` 时扫描 PDF 走 Tesseract fallback。

当前风险：

- URL 抓取目前只校验 `http/https`，还缺少 SSRF 防护，例如私有 IP、localhost、重定向到内网地址等。
- rate limit 规则目前是代码内固定值，生产部署最好改为环境变量可配置。
- 用户之前遇到的 `ModuleNotFoundError: No module named 'fastapi'` 更像是启动命令实际调用了全局 `C:\Python314\Scripts\uvicorn.exe`，而不是项目 `.venv` 或已安装依赖的 Python 环境。

推荐后端启动命令：

```powershell
cd C:\code\pretext\backend
& C:\code\pretext\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

或在你自己的环境中先确认：

```powershell
python -m pip show fastapi uvicorn
python -m uvicorn app.main:app --reload --port 8000
```

不要直接依赖裸 `uvicorn`，除非已经确认它来自当前环境。

### 2.2 前端

当前前端是 React + Vite + TypeScript + Zustand。

核心文件：

- `frontend/src/App.tsx`
- `frontend/src/store/readerStore.ts`
- `frontend/src/components/reader/PageCanvas.tsx`
- `frontend/src/components/reader/CanvasPage.tsx`
- `frontend/src/lib/pretext-engine.ts`
- `frontend/src/workers/pretext.worker.ts`
- `frontend/src/renderer/CanvasRenderer.ts`

已实现能力：

- 智能输入：`SmartInput` 自动识别 ArXiv ID / ArXiv URL / URL / 普通文本。
- 文件上传：拖拽/点击上传，调用后端文件接口。
- 示例文章加载。
- 多栏、栏距、字号、行高、字体、气泡半径可调。
- 6 套主题：dark、light、sepia、forest、ocean、sunset。
- 中英双语 i18n。
- 全屏模式与浏览器 Fullscreen API 同步。
- 键盘快捷键：1-4、`[`、`]`、T、F、?、Esc、方向键。
- Canvas 能力检测：默认优先 Canvas，不支持时降级 CSS。
- Pretext Worker：普通排版在 worker 中执行。
- mask-aware layout：背景视频存在时，`usePretext()` 使用 `layoutPagesWithMask()`。
- CSS fallback：不再按段落数粗略分页，而是优先渲染 Pretext 计算出的行。
- 背景视频：共享 `<video>` 元素，Canvas/CSS 两种模式复用。
- 视频轮廓分析：Sobel + connected components + per-row spans。
- 翻页：按钮、方向键、滚轮累积阈值。
- 翻页动效：`flip-fwd` / `flip-back`。
- 阅读历史基础存储：`history.ts` 已保存打开记录与 last position。
- 搜索算法基础：`search.ts` 已有页面级搜索函数。
- PWA 文件基础：`manifest.json`、`sw.js` 已存在。

当前风险：

- Canvas 默认模式下，E2E 里的 `.text-layer p` 断言可能过时，因为 Canvas 模式不渲染 DOM 文本行。
- `ErrorBoundary` 文件存在，但 `main.tsx` 尚未包裹使用。
- `sw.js` 与 `manifest.json` 存在，但 `main.tsx` 尚未注册 service worker。
- `search.ts`、bookmark/restore 相关能力已有基础函数，但还没有完整 UI 接入。
- Canvas 模式下视频 mask 拖拽手柄只在 CSS fallback 分支显示；默认 Canvas 路径缺少可视化 mask 调整入口。
- `CanvasRenderer.resize()` 当前重设了 canvas 尺寸，但绘制和清屏仍使用创建时的 `config.width/config.height`，窗口变化后可能出现清屏/背景绘制尺寸不一致。
- 当前 Canvas 气泡层主要是装饰性 glow，真正交互在 `TextLayer` 里做“按行推开”；这和 Textdance 的“光标附近文字高亮/显示”不是完全同一效果。

### 2.3 Zotero 插件

当前插件目录：

- `zotero-plugin/src/index.ts`
- `zotero-plugin/src/pretext-bridge.ts`
- `zotero-plugin/src/canvas-reader.ts`
- `zotero-plugin/src/zotero-api.ts`
- `zotero-plugin/src/ui.ts`

已实现能力：

- 插件源码和构建脚本存在。
- `canvas-reader.ts` 独立用 `@chenglou/pretext` 做 Canvas 阅读器。
- `pretext-bridge.ts` 能把 Zotero payload 渲染到 reader 页面。
- 包含 XPI 构建和 verify 脚本。
- 有插件市场 YAML：`zotero-plugin/zotero-pretext-reader.yml`。

当前风险：

- Zotero 插件拥有一套独立 `canvas-reader.ts`，和 Web 前端的 `pretext-engine.ts` / `renderer` 重复。
- 插件阅读器目前不是和 Web 端同一套分页模型，后续容易出现效果不一致。
- 插件构建产物当前在工作区中处于删除状态：`zotero-plugin/addon/content/reader.js`、`zotero-plugin/build/pretext-reader.xpi`、`zotero-plugin/build/update.json`。
- 发布前仍需替换正式插件 ID、homepage、update URL。

---

## 3. 本次验证记录

以下命令已在当前工作区执行：

```powershell
cd C:\code\pretext\frontend
npm test
npm run build
```

结果：

- Vitest：6 个测试文件通过，38 个测试通过。
- 前端生产构建通过。

```powershell
cd C:\code\pretext\backend
& C:\code\pretext\backend\.venv\Scripts\python.exe -m pytest -q
```

结果：

- 后端测试：55 passed，1 个 Starlette/httpx deprecation warning。

```powershell
cd C:\code\pretext\zotero-plugin
npm run lint
```

结果：

- Zotero TypeScript 检查通过。

```powershell
cd C:\code\pretext
node scripts\verify-frontend-source.mjs
node scripts\verify-upload-contract.mjs
node scripts\verify-input-contract.mjs
node scripts\verify-api-error-contract.mjs
node scripts\verify-api-docs-contract.mjs
node scripts\verify-samples-contract.mjs
```

结果：

- 前端源码质量检查通过。
- 上传校验 contract 通过。
- 输入校验 contract 通过。
- API error contract 通过。
- API 文档 contract 通过。
- 示例文章 contract 通过。

未完成/受环境限制：

- `node scripts\verify-docker.mjs` 失败，原因是当前机器命令行找不到 `docker`：`spawnSync docker ENOENT`。
- 未运行 `npm run verify`，因为该命令会重新生成 Zotero 插件构建产物，而当前这些产物在工作区里是删除状态；为了避免干扰现有改动，暂未重建。
- 未运行 Playwright E2E，因为需要先启动 backend 与 frontend dev server；另外 E2E 断言需要先适配 Canvas 默认渲染路径。

---

## 4. 下一步开发总流程

每个阶段都按同一套节奏推进：

1. 先确认当前工作区状态，避免覆盖已有未提交改动。
2. 实现一个小闭环，不做大范围无边界重写。
3. 跑对应验证命令。
4. 记录效果截图或测试结果。
5. 再进入下一项。

推荐每次开发前执行：

```powershell
cd C:\code\pretext
git status --short
```

推荐常规验证命令：

```powershell
cd C:\code\pretext
node scripts\verify-frontend-source.mjs
node scripts\verify-upload-contract.mjs
node scripts\verify-input-contract.mjs
node scripts\verify-api-error-contract.mjs
node scripts\verify-api-docs-contract.mjs
node scripts\verify-samples-contract.mjs

cd C:\code\pretext\frontend
npm test
npm run build

cd C:\code\pretext\backend
& C:\code\pretext\backend\.venv\Scripts\python.exe -m pytest -q

cd C:\code\pretext\zotero-plugin
npm run lint
```

完整发布前再执行：

```powershell
cd C:\code\pretext
npm run verify
npm run test:e2e
npm run verify:docker
```

---

## 5. Phase 0：环境与基线收口（0.5 天）

目标：解决“能不能稳定启动/验证”的问题。

任务：

- [ ] 在 README 或单独开发说明中明确后端必须用当前 Python 环境启动：
  - 推荐：`python -m uvicorn app.main:app --reload --port 8000`
  - 避免：直接调用全局 `uvicorn.exe`
- [ ] 加一个 Windows 启动检查小节：
  - `python -m pip show fastapi uvicorn`
  - `where python`
  - `where uvicorn`
- [ ] 明确前端启动命令：
  - `cd frontend`
  - `npm run dev -- --host 127.0.0.1 --port 5173`
- [ ] 明确 E2E 前置条件：
  - backend 运行在 `127.0.0.1:8000`
  - frontend 运行在 `127.0.0.1:5173`
- [ ] 如果需要 Docker 验证，先安装 Docker Desktop 或确保 `docker` 在 PATH。

验收：

- [ ] 后端 `GET http://127.0.0.1:8000/api/v1/health` 返回 `status: ok`。
- [ ] 前端能打开 `http://127.0.0.1:5173`。
- [ ] 不再出现 `ModuleNotFoundError: No module named 'fastapi'`。

---

## 6. Phase 1：P0 正确性修复（1-2 天）

目标：保证默认 Canvas 路径稳定，避免“看起来有功能但边界一碰就坏”。

### 6.1 修复 Canvas resize 尺寸状态

当前问题：

- `CanvasRenderer.resize(width, height)` 会重设 canvas 尺寸。
- 但 `clearLayer()`、`drawBackground()` 仍使用初始化时的 `config.width/config.height`。

任务：

- [ ] 在 `frontend/src/renderer/CanvasRenderer.ts` 内维护可变 `currentWidth/currentHeight/currentDpr`。
- [ ] `clearLayer()`、`drawBackground()`、`resize()` 后重绘都使用最新尺寸。
- [ ] 增加或更新单元测试覆盖 resize 后的清屏/绘制尺寸。

验收：

- [ ] 窗口 resize 后 Canvas 背景铺满，不残影。
- [ ] Canvas 文本、光标、背景视频层坐标一致。

### 6.2 修正 Canvas 默认路径下的可交互控件

当前问题：

- CSS fallback 分支有视频 mask 拖拽手柄。
- Canvas 默认分支只渲染 `CanvasPage` 和翻页箭头，缺少 mask 手柄。

任务：

- [ ] 将 mask 拖拽手柄提升到 Canvas/CSS 共享层。
- [ ] Canvas 模式也能拖拽 `maskX/maskY`。
- [ ] 拖拽时触发 mask-aware relayout，但需要节流，避免每个 pointermove 都重排。

验收：

- [ ] Canvas 模式上传背景视频后可以手动移动遮罩中心。
- [ ] 自动遮罩和手动遮罩不会互相打架。

### 6.3 更新 E2E 测试策略

当前问题：

- Playwright 测试仍假设 DOM 中有 `.text-layer p`。
- 默认 Canvas 支持时，文本是在 canvas 上绘制，DOM 文本断言会失效。

任务：

- [ ] 增加测试模式开关，例如 `VITE_FORCE_ENGINE=css` 或 URL query `?engine=css`。
- [ ] E2E 分两组：
  - CSS fallback DOM 文本断言。
  - Canvas 默认路径断言 canvas 层存在、页数变化、无控制台错误。
- [ ] 更新 `frontend/e2e/reader.spec.ts`。

验收：

- [ ] `npm run test:e2e` 在启动前后端后可通过。
- [ ] Canvas 与 CSS 两条路径都有最低限度 E2E 覆盖。

### 6.4 接入 ErrorBoundary 与 PWA 注册

当前问题：

- `ErrorBoundary.tsx` 已存在但未在 `main.tsx` 使用。
- `sw.js` 和 `manifest.json` 已存在，但未注册 Service Worker。

任务：

- [ ] 在 `frontend/src/main.tsx` 包裹 `<ErrorBoundary>`。
- [ ] 只在生产构建下注册 `sw.js`，避免开发时缓存干扰。
- [ ] 增加基础验证：构建产物包含 manifest，生产预览下 SW 注册成功。

验收：

- [ ] 组件错误不会白屏。
- [ ] 生产构建可作为 PWA 安装/缓存基础资源。

---

## 7. Phase 2：Textdance 核心视觉对齐（2-4 天）

目标：把“像 Textdance”从功能列表推进到实际视觉体验。

### 7.1 明确并实现最终气泡效果

当前实现：

- Canvas：`drawTextLayer()` 根据 cursor 位置做“按行推开”，`drawBubbleLayer()` 做装饰 glow。
- CSS：`.bubble-layer` 用遮罩盖住非气泡区域，形成类似 spotlight 的效果。

与 Textdance 的差距：

- Textdance 更像“光标附近文字高亮/显示，外部文字弱化”的 reveal 效果。
- 当前 Canvas 更像“文字被光标排开 + 光晕”，不是同一种交互。

任务：

- [ ] 决策：最终是否保留“文字推开”作为增强效果，还是严格改成 reveal。
- [ ] Canvas reveal 推荐实现：
  - 第一遍：用 muted 颜色绘制整页文字。
  - 第二遍：在 radial clip/mask 内用正常颜色重绘文字。
  - 边缘使用 radial gradient 软过渡。
- [ ] CSS reveal 推荐实现：
  - 两层文本或 CSS mask：底层 muted，顶层正常色只在气泡区域可见。
- [ ] 保留 `bubbleRadius=0` 时无特效、系统光标正常。

验收：

- [ ] 暗/亮/纸三种主题下气泡效果都清晰。
- [ ] Canvas 与 CSS 的气泡视觉语义一致。
- [ ] 文字不会在光标移动时出现跳动、残影或不可读。

### 7.2 背景视频绕排效果验收

当前实现：

- 自动采样约 2fps。
- `analyzeVideoFrame()` 返回中心、尺寸和 contour spans。
- `layoutPagesWithMask()` 已消费 contour 或 ellipse。

待收敛：

- [ ] 建立 2-3 个固定测试视频样本：人物、深色背景、浅色背景。
- [ ] 调整 sensitivity / edgePrecision / outlineWidth 的映射，使滑块变化更可预期。
- [ ] `outlineWidth > 0` 时确认是否符合“文字绕外缘/轮廓带”的预期。
- [ ] Canvas 模式下提供遮罩可视化调试开关，便于校准。
- [ ] 低性能设备下降低采样频率或仅在重新采样时重排。

验收：

- [ ] 上传视频后，文字确实绕过主体，而不是只围绕固定圆形。
- [ ] 重新采样按钮能稳定更新轮廓。
- [ ] 移除视频后释放 Blob URL，并恢复普通排版。

### 7.3 侧边栏和阅读区体验微调

当前实现已经比旧计划简洁：

- `SmartInput`
- `FileUpload`
- `SampleLoader`
- 分组控件
- 全屏隐藏侧边栏

下一步任务：

- [ ] 移动端补触摸翻页：左右滑动翻页。
- [ ] 页面箭头 hover/触摸区域做实际设备验证。
- [ ] 空状态加入 3 步快速引导。
- [ ] 字体选择加入中文回退链说明，避免外部字体失败时观感坍塌。

验收：

- [ ] 360px、768px、1024px、1440px 四个宽度下布局可用。
- [ ] 全屏阅读时没有多余 UI 干扰。

---

## 8. Phase 3：性能与排版内核优化（3-5 天）

目标：让 Pretext 排版、视频分析和 Canvas 重绘在长文本/视频场景下稳定。

### 8.1 mask-aware layout 迁移或隔离到 Worker

当前状态：

- 普通 `layoutPagesInWorker()` 已在 worker 中执行。
- mask-aware `layoutPagesWithMask()` 目前在主线程执行。

任务：

- [ ] 设计 worker 消息协议，支持 contour spans 传入 worker。
- [ ] 将 `layoutPagesWithMask()` 或其核心逻辑复用到 worker。
- [ ] 添加 fallback：worker 失败时主线程执行，但降低采样/重排频率。
- [ ] 增加 layout cache，key 至少包含：
  - text hash
  - columnCount / columnWidth / columnHeight / fontSize / lineHeight / fontFamily
  - contour signature

验收：

- [ ] 长文本 + 视频背景时拖动滑块不明显卡顿。
- [ ] 主线程 long task 明显减少。

### 8.2 视频采样优化

当前问题：

- `sampleVideoFrame()` 每次创建 canvas。

任务：

- [ ] 复用离屏 canvas/context。
- [ ] 可用时使用 `OffscreenCanvas`。
- [ ] 根据耗时动态调整采样频率。
- [ ] contour 变化小于阈值时不触发重排。

验收：

- [ ] 视频播放时 Canvas 渲染稳定。
- [ ] 自动遮罩不会造成持续明显 CPU 峰值。

### 8.3 Canvas dirty flag 收敛

当前实现已有 dirty 思路，但还可以更细：

- 背景视频层：按视频帧/节流刷新。
- 文本层：只在排版、主题、页码、气泡 reveal 策略变化时刷新。
- 气泡/光标层：仅 cursor 移动或半径变化时刷新。

任务：

- [ ] 明确每层刷新条件。
- [ ] 避免 `setCursorState()` 触发过高频文本重绘。
- [ ] 如果保留“文字推开”效果，增加低频/低质量模式。

验收：

- [ ] 鼠标静止时 Canvas 基本不做无意义重绘。
- [ ] 鼠标移动时保持流畅。

---

## 9. Phase 4：阅读产品功能补全（3-5 天）

目标：把已有基础库接成用户可见功能。

### 9.1 搜索

当前状态：

- `frontend/src/lib/search.ts` 已有 `searchPages()` 和 `nextMatch()`。
- 尚未接入 UI。

任务：

- [ ] 增加搜索框/快捷键，例如 Ctrl+F。
- [ ] 在 Pretext 行级布局上定位匹配项。
- [ ] 支持上一个/下一个匹配。
- [ ] 匹配结果跨页跳转。

验收：

- [ ] 搜索中文、英文、大小写混合都可用。
- [ ] Canvas/CSS 都能显示搜索结果，至少能跳页。

### 9.2 历史、恢复位置、书签

当前状态：

- `history.ts` 已有 history、bookmark、last position 存储函数。
- `readerStore.ts` 已在打开内容和翻页时写入部分记录。
- 尚缺 UI 和恢复逻辑闭环。

任务：

- [ ] 侧边栏增加最近阅读列表。
- [ ] 打开相同文章时恢复 last position。
- [ ] 增加书签按钮和书签列表。
- [ ] 明确文章 ID 策略，避免仅用 title 导致冲突。

验收：

- [ ] 重新打开同一篇文章可回到上次页码。
- [ ] 历史列表不会无限增长，删除/清空可用。

### 9.3 可访问性

当前已有：

- ProgressBar ARIA。
- CanvasPage hidden live text。
- 键盘快捷键避开输入框。

任务：

- [ ] 对主要控件跑 axe-core 或 Playwright a11y 检查。
- [ ] Canvas 模式下提供完整屏幕阅读器文本副本，而不是只取前三行 sample。
- [ ] 翻页按钮、mask 手柄、视频控制补齐 aria-label。

验收：

- [ ] 只用键盘可以加载文本、调参、翻页、打开帮助。
- [ ] Canvas 默认路径对屏幕阅读器至少有可读文本 fallback。

---

## 10. Phase 5：后端安全、部署和文档收口（2-4 天）

目标：让后端更接近可公网部署状态。

### 10.1 URL fetch 安全

任务：

- [ ] 增加 SSRF 防护：
  - 禁止 localhost / 127.0.0.0/8 / 10.0.0.0/8 / 172.16.0.0/12 / 192.168.0.0/16 / link-local / IPv6 local。
  - 跟随重定向时重新校验目标地址。
- [ ] 限制响应体最大读取大小，避免超大页面占内存。
- [ ] 校验 content-type，非 HTML/text 时给出清晰错误。

验收：

- [ ] URL fetch 测试覆盖私有 IP、重定向、超时、非 HTML。

### 10.2 配置与部署

任务：

- [ ] 将 rate limit 规则做成环境变量可配置。
- [ ] 补全 `.env.example`。
- [ ] Docker 验证在有 Docker 的机器上通过。
- [ ] Baota/Nginx 部署文档与实际 `VITE_API_URL=/api/v1` 路径一致。

验收：

- [ ] `npm run verify:docker` 通过。
- [ ] Docker Compose 后 backend/frontend healthcheck 都 healthy。

### 10.3 文档更新

任务：

- [ ] README 当前能力更新为真实状态，避免仍写“5 个独立输入”或旧计划说法。
- [ ] `DEVELOPMENT_DOC.md` 标注哪些是设计目标、哪些已实现。
- [ ] `docs/API.md` 继续保持 contract script 通过。

验收：

- [ ] 文档与代码路由、启动命令、验证命令一致。

---

## 11. Phase 6：Zotero 插件收敛（3-6 天）

目标：减少 Web 与 Zotero 的重复内核，让插件具备可发布基础。

### 11.1 共享 Pretext 排版内核

当前问题：

- Web：`frontend/src/lib/pretext-engine.ts`
- Zotero：`zotero-plugin/src/canvas-reader.ts`
- 两边都调用 `@chenglou/pretext`，但分页、渲染和主题逻辑重复。

任务：

- [ ] 将通用 layout 类型和函数抽到 `shared/` 或 workspace package。
- [ ] Zotero 插件复用 Web 的分页模型。
- [ ] 保留 Zotero 端轻量 Canvas 渲染，但输入数据结构一致。

验收：

- [ ] 同一段文本、同一排版参数下，Web 和 Zotero 页数/断行基本一致。

### 11.2 插件阅读体验

任务：

- [ ] 插件支持多页导航，而不是只填充当前可见列。
- [ ] 插件主题与 Web 端至少对齐 dark/light/sepia。
- [ ] 插件字号、栏数、气泡半径设置能即时重排/重绘。
- [ ] 插件内释放 RAF、ResizeObserver 和事件监听，避免重复打开泄漏。

验收：

- [ ] Zotero 中打开条目，阅读器可翻页、调主题、调栏数。
- [ ] 多次打开/关闭不重复注册快捷键或泄漏 canvas。

### 11.3 发布准备

任务：

- [ ] 替换正式 add-on ID。
- [ ] 替换 homepage 和 repository。
- [ ] 配置正式 `update_url` / `ZOTERO_UPDATE_LINK`。
- [ ] 重新生成并验证：
  - `zotero-plugin/addon/content/reader.js`
  - `zotero-plugin/build/pretext-reader.xpi`
  - `zotero-plugin/build/update.json`

验收：

- [ ] `cd zotero-plugin && npm run build && npm run verify` 通过。

---

## 12. Phase 7：发布前总验收（1-2 天）

目标：形成可演示、可部署、可回归的版本。

必跑命令：

```powershell
cd C:\code\pretext
npm run verify
```

在 backend/frontend 已启动后：

```powershell
cd C:\code\pretext
npm run test:e2e
```

如果 Docker 可用：

```powershell
cd C:\code\pretext
npm run verify:docker
npm run verify:docker:build
```

人工视觉验收：

- [ ] 示例文章加载后，Canvas 默认路径可阅读。
- [ ] 1/2/3/4 栏切换稳定。
- [ ] 字号、行高、栏距调整没有明显延迟。
- [ ] 气泡效果符合最终决策。
- [ ] 背景视频上传、自动遮罩、重新采样、移除都可用。
- [ ] 暗/亮/纸/森林/海洋/日落主题都可读。
- [ ] 全屏模式无多余 UI。
- [ ] 移动端单栏可用。
- [ ] 后端错误能在前端显示本地化友好提示。

发布文档：

- [ ] `README.md` 更新当前能力和启动步骤。
- [ ] `CHANGELOG.md` 新增当前版本变更。
- [ ] `docs/API.md` 与 contract script 一致。
- [ ] Zotero 发布说明补齐。

---

## 13. 推荐立即执行顺序

如果从现在继续开发，我建议按下面顺序做：

1. 修 `CanvasRenderer.resize()` 尺寸状态。
2. 让 Canvas 模式也显示/支持视频 mask 拖拽手柄。
3. 决策并实现最终气泡 reveal 效果。
4. 更新 Playwright E2E，区分 Canvas 默认路径和 CSS fallback 路径。
5. 接入 `ErrorBoundary` 与生产环境 Service Worker 注册。
6. 将 mask-aware layout 迁移到 worker 或至少加缓存/阈值节流。
7. 接入搜索 UI 与阅读历史恢复。
8. 做 URL fetch SSRF 防护。
9. 抽取共享 Pretext layout 内核，减少 Zotero/Web 重复。
10. 最后跑 `npm run verify`、E2E、Docker 验证并更新 README/CHANGELOG。

---

## 14. 当前状态一句话

当前项目已经使用 `@chenglou/pretext` 建起了比较完整的动态阅读器原型：后端内容提取、前端 Pretext 多栏分页、Canvas/CSS 双路径、背景视频轮廓分析、Zotero 插件雏形都已存在。下一步的关键不是继续堆功能，而是把 Canvas 默认体验、Textdance 式气泡效果、视频绕排稳定性、E2E 回归和发布工程收紧。
