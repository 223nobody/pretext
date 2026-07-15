# 🪧 Pretext Reader — 全栈开发文档

> **基于 Pretext 引擎的新一代多栏动态文本阅读器**
>
> 网站应用（Python + React）+ Zotero 浏览器插件

---

## 目录

1. [项目概述](#1-项目概述)
2. [需求全景](#2-需求全景)
3. [技术架构](#3-技术架构)
4. [后端设计（Python）](#4-后端设计python)
5. [前端设计（React）](#5-前端设计react)
6. [设计系统](#6-设计系统)
7. [核心功能详解](#7-核心功能详解)
8. [文件上传与校验](#8-文件上传与校验)
9. [Zotero 插件设计](#9-zotero-插件设计)
10. [项目目录结构](#10-项目目录结构)
11. [开发路线图](#11-开发路线图)
12. [部署方案](#12-部署方案)
13. [附录](#13-附录)

---

## 1. 项目概述

### 1.1 项目名称

**Pretext Reader** — 基于 [Pretext](https://github.com/chenglou/pretext) 文本排版引擎的动态多栏阅读器。

### 1.2 项目目标

构建一个**超越 Textdance** 的阅读体验平台，不仅复制其核心功能（多栏阅读、文字绕排、光标气泡、背景视频），而且：

- 🎨 **视觉设计大幅提升**：采用现代设计系统，精心打磨每种主题
- 📂 **支持本地文件上传**：PDF / TXT / Markdown / DOCX / EPUB / HTML / LaTeX
- 🧠 **智能格式校验**：自动识别文件类型，验证内容完整性
- 🧩 **即用即装插件**：一键安装 Zotero 插件，在文献管理器中直接使用

### 1.3 参考项目

| 项目 | 角色 |
|------|------|
| [Pretext](https://github.com/chenglou/pretext) | 核心文本排版引擎（纯 JS，~15KB，零依赖） |
| [Textdance](https://textdance.pixjam.cn/) | 功能参考实现 |
| [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template) | Zotero 插件开发模板 |
| [syt2/zotero-addons-scraper](https://github.com/syt2/zotero-addons-scraper) | Zotero 插件市场（提交目标） |

---

## 2. 需求全景

### 2.1 内容输入源（五大渠道）

```
┌──────────────────────────────────────────────────────┐
│                   内容输入源                           │
├───────────┬──────────┬──────────┬──────────┬─────────┤
│  ArXiv   │  URL    │  示例   │ 本地文件  │ Zotero  │
│  论文ID  │  抓取   │  文章   │  上传    │  条目   │
└───────────┴──────────┴──────────┴──────────┴─────────┘
```

#### A. ArXiv 论文
- 用户输入 ArXiv ID（如 `2301.12345`）
- 后端代理请求 ArXiv API，获取论文元数据与摘要/全文
- 支持解析 ArXiv 的 LaTeX 源码或 PDF 提取文本

#### B. URL 文本
- 用户粘贴任意 URL
- 后端抓取页面内容，使用 readability 算法提取正文
- 返回清洗后的纯文本 + 元数据（标题、作者、来源）

#### C. 示例文章
- 内置 3-5 篇高质量示例（文学、科技、学术等类型）
- 展示完整功能，降低首次使用门槛

#### D. 本地文件上传 ⭐ **核心新增**
- 用户拖拽或点击上传本地文件
- 支持格式：**PDF、TXT、Markdown、DOCX、EPUB、HTML、LaTeX (.tex)**
- 后端校验：
  - 扩展名白名单
  - MIME 类型检测（魔术字节）
  - 文件大小限制（默认 ≤ 50MB）
  - 内容非空校验
  - 编码检测与转换（自动识别 GBK/UTF-8 等）
  - 恶意内容扫描（XSS/脚本标签过滤）
- 上传后自动提取纯文本，缓存至服务端（可选过期清理）
- 前端显示上传进度、文件信息、文本预览

#### E. Zotero 条目（插件专属）
- 从 Zotero 当前选中的文献条目直接获取全文
- 支持附件 PDF 自动提取文本

### 2.2 阅读器功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **多栏布局** | 1-4 栏可调，栏间距可调 | P0 |
| **字号调节** | 12-28px 范围，实时生效 | P0 |
| **行高调节** | 1.2-2.2 范围 | P0 |
| **光标气泡** | 圆形区域文字高亮/显示，半径可调（0-150px） | P0 |
| **背景视频文字绕排** | 上传视频，文字绕人物/物体轮廓流动 | P1 |
| **自定义光标** | 上传 webm/png/gif/apng 替换默认光标 | P2 |
| **多主题** | 暗色/亮色/护眼纸色/更多（≥6 套） | P0 |
| **全屏阅读模式** | 隐藏所有 UI 控件，沉浸式阅读 | P1 |
| **阅读进度** | 全局进度条 + 每栏页码指示 | P1 |
| **键盘快捷键** | 栏数切换、主题切换、全屏等 | P1 |
| **响应式布局** | 桌面端多栏 / 平板双栏 / 手机单栏 | P0 |

### 2.3 Zotero 插件专属功能

| 功能 | 说明 |
|------|------|
| **一键启动** | Zotero 工具栏按钮 / 右键菜单 → 用 Pretext Reader 打开 |
| **独立窗口** | 在 Zotero 内嵌面板或独立弹出窗口显示 |
| **条目同步** | 自动获取当前选中条目全文（PDF/笔记） |
| **注释兼容** | 保留 Zotero 条目标题、作者信息 |
| **离线可用** | 纯本地计算，不上传数据（可选云模式） |

---

## 3. 技术架构

### 3.1 总体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React SPA (TypeScript + Vite)             │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │  │
│  │  │ 文件上传 │ │ 内容面板  │ │ 阅读器 │ │ 主题/设置  │  │  │
│  │  │ 组件    │ │ (侧边栏) │ │ Canvas │ │ 面板       │  │  │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────┘  │  │
│  │              │                                          │  │
│  │       ┌──────┴──────┐                                   │  │
│  │       │  Pretext.js │ ← 文本排版引擎 (客户端)           │  │
│  │       └─────────────┘                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │ HTTP/REST                      │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                   Python 后端 (FastAPI)                      │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 文件上传 │ │ URL抓取    │ │ ArXiv    │ │ 文本提取     │  │
│  │ 控制器   │ │ 服务      │ │ 代理     │ │ 管道         │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 格式校验 │ │ 内容安全  │ │ 编码检测 │ │ 缓存管理     │  │
│  │ 服务     │ │ 过滤      │ │ 服务     │ │ 服务         │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈详表

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端框架** | React | ≥18.3 | UI 组件与状态管理 |
| **类型系统** | TypeScript | ≥5.5 | 全栈类型安全 |
| **构建工具** | Vite | ≥6.0 | 开发服务器 + 生产构建 |
| **样式方案** | Tailwind CSS | ≥4.0 | 原子化 CSS + 主题变量 |
| **核心排版** | `@chenglou/pretext` | latest | 文本测量与动态排版 |
| **Canvas 渲染** | Canvas API + OffscreenCanvas | — | 文字渲染与特效 |
| **后端框架** | FastAPI | ≥0.115 | REST API + 文件上传 |
| **异步服务** | Uvicorn + aiohttp | — | ASGI 服务器 + HTTP 客户端 |
| **PDF 解析** | `pdfplumber` + `PyMuPDF` | — | PDF 文本提取 |
| **DOCX 解析** | `python-docx` | — | Word 文档解析 |
| **EPUB 解析** | `ebooklib` | — | 电子书解析 |
| **Markdown 解析** | `markdown-it-py` | — | Markdown → 纯文本 |
| **HTML 解析** | `beautifulsoup4` + `readability-lxml` | — | HTML 清洗 + 正文提取 |
| **LaTeX 解析** | `pylatexenc` | — | LaTeX → 纯文本 |
| **编码检测** | `chardet` / `cchardet` | — | 自动编码识别 |
| **内容安全** | `bleach` + 自定义过滤 | — | XSS 防护 |
| **缓存** | Redis（可选）+ 文件缓存 | — | 解析结果缓存 |
| **Zotero 插件** | TypeScript + zotero-plugin-scaffold | — | 插件编译 |
| **插件 API** | zotero-plugin-toolkit | — | Zotero 内部 API 封装 |

---

## 4. 后端设计（Python）

### 4.1 API 端点设计

```
Base URL: /api/v1

POST   /api/v1/text/extract          # 通用文本提取
POST   /api/v1/file/upload           # 文件上传 + 文本提取
GET    /api/v1/arxiv/:id             # ArXiv 论文获取
POST   /api/v1/url/fetch             # URL 内容抓取
GET    /api/v1/samples               # 获取示例文章列表
GET    /api/v1/samples/:id           # 获取指定示例文章
DELETE /api/v1/cache/:key            # 清除缓存条目
GET    /api/v1/health                # 健康检查
```

### 4.2 核心 API 详情

#### 4.2.1 文件上传 `POST /api/v1/file/upload`

```
请求: multipart/form-data
  - file: binary (必填)
  - options: JSON string (可选)
    {
      "max_chars": 500000,     // 最大提取字符数
      "preserve_paragraphs": true,
      "extract_metadata": true
    }

响应: 200 OK
{
  "success": true,
  "data": {
    "file_id": "uuid",
    "file_name": "论文.pdf",
    "file_size": 2456789,
    "mime_type": "application/pdf",
    "detected_encoding": "utf-8",
    "text": "提取的纯文本内容...",
    "char_count": 45230,
    "metadata": {
      "title": "论文标题",
      "author": ["作者1", "作者2"],
      "pages": 12,
      "language": "zh-CN"
    },
    "preview": "前500字预览...",
    "cached_until": "2026-06-08T12:00:00Z"
  },
  "warnings": []  // 非致命警告（如部分页面解析失败）
}

错误: 400 Bad Request
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "不支持的文件格式 .exe，支持的格式: pdf, txt, md, docx, epub, html, tex"
  }
}

错误: 413 Payload Too Large
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "文件大小 78MB 超过限制 50MB"
  }
}

错误: 422 Unprocessable Entity
{
  "success": false,
  "error": {
    "code": "EMPTY_CONTENT",
    "message": "文件内容为空或无法提取有效文本"
  }
}
```

#### 4.2.2 URL 抓取 `POST /api/v1/url/fetch`

```
请求: application/json
{
  "url": "https://example.com/article",
  "options": {
    "max_chars": 300000,
    "timeout_ms": 15000
  }
}

响应: 200 OK
{
  "success": true,
  "data": {
    "url": "https://example.com/article",
    "title": "文章标题",
    "author": "作者",
    "site_name": "Example.com",
    "text": "清洗后的正文...",
    "char_count": 12345,
    "excerpt": "前500字..."
  }
}
```

#### 4.2.3 ArXiv 代理 `GET /api/v1/arxiv/:id`

```
请求: GET /api/v1/arxiv/2301.12345

响应: 200 OK
{
  "success": true,
  "data": {
    "arxiv_id": "2301.12345",
    "title": "...",
    "authors": ["..."],
    "abstract": "...",
    "full_text": "...",      // 如有全文
    "published": "2023-01-15",
    "categories": ["cs.AI"]
  }
}
```

### 4.3 文件上传与校验流程

```
用户上传文件
       │
       ▼
┌──────────────────┐
│  ① 扩展名白名单  │ → 不在白名单 → 400 UNSUPPORTED_FORMAT
└──────┬───────────┘
       │ 通过
       ▼
┌──────────────────┐
│  ② 文件大小检查  │ → 超过限制 → 413 FILE_TOO_LARGE
└──────┬───────────┘
       │ 通过
       ▼
┌──────────────────┐
│  ③ MIME 魔术字节 │ → 不匹配扩展名 → 记录警告（仍尝试解析）
│     检测         │
└──────┬───────────┘
       │ 通过 / 警告
       ▼
┌──────────────────┐
│  ④ 编码自动检测  │ → 不支持编码 → 422 ENCODING_ERROR
│     (chardet)    │
└──────┬───────────┘
       │ 通过
       ▼
┌──────────────────┐
│  ⑤ 文本提取      │
│  按格式调用不同   │
│  解析器           │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  ⑥ 内容安全检查  │ → 检测到恶意内容 → 422 CONTENT_REJECTED
│  (XSS/脚本过滤)  │
└──────┬───────────┘
       │ 通过
       ▼
┌──────────────────┐
│  ⑦ 空内容检查    │ → 无有效文本 → 422 EMPTY_CONTENT
└──────┬───────────┘
       │ 通过
       ▼
┌──────────────────┐
│  ⑧ 返回结果 +    │
│     缓存          │
└──────────────────┘
```

### 4.4 文件格式解析策略

| 格式 | 扩展名 | MIME 类型 | 解析库 | 注意事项 |
|------|--------|-----------|--------|----------|
| **PDF** | `.pdf` | `application/pdf` | `pdfplumber` + `PyMuPDF` | 扫描版 PDF 需 OCR（可选 Tesseract） |
| **纯文本** | `.txt` | `text/plain` | 原生 `open()` | 自动检测编码（UTF-8/GBK/Shift-JIS 等） |
| **Markdown** | `.md` | `text/markdown` | `markdown-it-py` | 去除标记语法，保留纯文本 |
| **Word** | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `python-docx` | 支持段落+表格提取 |
| **EPUB** | `.epub` | `application/epub+zip` | `ebooklib` | 提取各章节文本 |
| **HTML** | `.html`, `.htm` | `text/html` | `beautifulsoup4` | 去除标签、脚本、样式 |
| **LaTeX** | `.tex` | `application/x-tex` | `pylatexenc` + 正则 | 去除命令保留正文 |

### 4.5 校验规则汇总

```python
# config/validation.py

ALLOWED_EXTENSIONS = {
    '.pdf', '.txt', '.md', '.docx',
    '.epub', '.html', '.htm', '.tex'
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_TEXT_CHARS = 1_000_000        # 单次最大提取 100 万字符
MAX_PREVIEW_CHARS = 500           # 预览长度

FORBIDDEN_PATTERNS = [
    r'<script[^>]*>.*?</script>',   # script 标签
    r'javascript\s*:',              # javascript: 协议
    r'on\w+\s*=\s*["\'].*?["\']',  # 内联事件处理器
    r'<iframe[^>]*>',              # iframe
]

# 编码检测置信度阈值
MIN_ENCODING_CONFIDENCE = 0.7
```

### 4.6 缓存策略

```
缓存 Key: SHA256(file_content) → 提取结果
缓存 TTL: 24 小时（可配置）
存储方式:
  - 开发: 本地文件缓存 (cache/ 目录)
  - 生产: Redis + 文件备份

缓存命中 → 直接返回，跳过解析
缓存未命中 → 解析 → 存入缓存 → 返回
```

---

## 5. 前端设计（React）

### 5.1 组件树

```
<App>
├── <ThemeProvider>              // 主题上下文
├── <Layout>
│   ├── <Sidebar>                // 左侧控制面板
│   │   ├── <SidebarHeader>      // Logo + 关闭按钮
│   │   ├── <ContentSourcePanel> // 内容来源选择
│   │   │   ├── <ArXivInput />   // ArXiv ID 输入
│   │   │   ├── <UrlInput />     // URL 输入
│   │   │   ├── <SampleLoader /> // 示例文章加载
│   │   │   └── <FileUpload />   // 文件上传 ⭐ 新增
│   │   ├── <LayoutControls>     // 栏数/字号/行高
│   │   ├── <CursorControls>     // 光标气泡
│   │   ├── <BackgroundControls> // 背景视频
│   │   ├── <CursorStyleControls>// 自定义光标
│   │   ├── <ThemeSwitcher>      // 主题切换
│   │   └── <SidebarFooter>      // 页脚
│   ├── <SidebarToggle>          // 侧边栏开关按钮
│   └── <ReaderArea>             // 主阅读区域
│       ├── <LoadingIndicator /> // 加载状态
│       ├── <EmptyState />       // 空状态引导
│       ├── <ProgressBar />      // 阅读进度
│       ├── <PageCanvas />       // Canvas 渲染层
│       │   ├── <BackgroundVideo /> // 背景视频层
│       │   ├── <TextLayer />    // 文本排列层
│       │   ├── <BubbleEffect /> // 光标气泡层
│       │   └── <CursorOverlay />// 自定义光标层
│       └── <KeyboardHandler />  // 键盘快捷键
└── <ToastContainer />           // 通知提示
```

### 5.2 核心状态管理

```typescript
// store/readerStore.ts (Zustand)

interface ReaderState {
  // 内容
  contentSource: 'arxiv' | 'url' | 'sample' | 'file' | null;
  text: string | null;
  metadata: ArticleMetadata | null;
  isLoading: boolean;
  loadingProgress: number;        // 0-100

  // 排版
  columnCount: number;            // 1-4
  fontSize: number;               // 12-28 px
  lineHeight: number;             // 1.2-2.2

  // 光标特效
  bubbleRadius: number;           // 0-150 px
  customCursor: string | null;    // data URL

  // 背景视频
  backgroundVideo: {
    file: File | null;
    sensitivity: number;          // 10-80
    edgePrecision: number;        // 1-10
    outlineWidth: number;         // 0-20
    inverted: boolean;
  };

  // 主题
  theme: 'dark' | 'light' | 'sepia' | 'forest' | 'ocean' | 'sunset';

  // UI 状态
  isSidebarOpen: boolean;
  isFullscreen: boolean;

  // 动作
  setContent: (text: string, metadata: ArticleMetadata) => void;
  uploadFile: (file: File) => Promise<void>;
  loadArXiv: (id: string) => Promise<void>;
  fetchUrl: (url: string) => Promise<void>;
  loadSample: (id: string) => Promise<void>;
  // ...
}
```

### 5.3 文件上传组件设计

```typescript
// components/FileUpload.tsx

interface FileUploadProps {
  onTextExtracted: (text: string, meta: ArticleMetadata) => void;
}

// 支持拖拽 + 点击上传
// 上传前展示文件信息：
//   - 文件名、大小、类型图标
//   - 上传进度条
// 上传后：
//   - 成功：绿色勾 + "已就绪" + 文本预览
//   - 失败：红色 × + 错误原因 + 重试按钮
//   - 警告：黄色 ⚠ + 警告信息（如编码不确定）
```

### 5.4 Canvas 渲染管线

```
1. Pretext.prepare(text, font)     ← 一次性预处理（文本分词+测量）
         ↓
2. Pretext.layoutNextLineRange()   ← 逐行计算（每行宽度可变）
         ↓
3. Canvas 2D 绘制循环：
   - 背景视频帧 → drawImage
   - 文字绕排区域计算（根据背景轮廓）
   - 每行文字 → fillText（用 Pretext 计算的位置）
   - 光标气泡 → 径向渐变蒙版
   - 自定义光标 → drawImage
         ↓
4. requestAnimationFrame 循环
```

### 5.5 响应式断点

| 断点 | 宽度 | 栏数 | 侧边栏 |
|------|------|------|--------|
| Mobile | < 768px | 1 栏 | 全屏覆盖式 |
| Tablet | 768-1024px | 1-2 栏 | 可收起 |
| Desktop | 1024-1440px | 2-3 栏 | 固定侧边 |
| Wide | > 1440px | 2-4 栏 | 固定侧边 |

---

## 6. 设计系统

### 6.1 设计风格：**Editorial Luxe（编辑奢华风）**

> 融合传统印刷美学与现代数字交互——像翻阅一本精心排版的杂志，同时拥有数字世界的动态能力。

**核心设计原则：**
- **排版优先**：字体是一切的基础，选择最适合中文阅读的字体组合
- **留白呼吸**：充足的间距与留白，让文字「呼吸」
- **微妙动效**：仅使用 opacity、transform 动画，避免 layout shift
- **材质感**：纸张纹理、微阴影、半透明层叠

### 6.2 六套主题

#### 🌙 Dark（暗色）— 默认
```
背景: #0F172A (slate-900)
文本: #E2E8F0 (slate-200)
强调: #818CF8 (indigo-400)
卡片: #1E293B (slate-800) / 80% opacity
边框: #334155 (slate-700)
```

#### ☀️ Light（亮色）
```
背景: #F8FAFC (slate-50)
文本: #0F172A (slate-900)
强调: #4F46E5 (indigo-600)
卡片: #FFFFFF / 90% opacity
边框: #E2E8F0 (slate-200)
```

#### 📜 Sepia（护眼纸色）
```
背景: #F5F1EA
文本: #3D3226
强调: #955F3B
卡片: #FFFDF8 / 85% opacity
边框: #D8CEC3
```

#### 🌲 Forest（森林绿）
```
背景: #0F1A14
文本: #D4E8D8
强调: #4ADE80
卡片: #1A2E22 / 85% opacity
边框: #2A4A35
```

#### 🌊 Ocean（海洋蓝）
```
背景: #0A1628
文本: #D0E0F0
强调: #38BDF8
卡片: #152238 / 85% opacity
边框: #1E3A5F
```

#### 🌇 Sunset（日落橙紫）
```
背景: #1A1028
文本: #F0E0D0
强调: #F59E0B
卡片: #281E38 / 85% opacity
边框: #3D2E4A
```

### 6.3 字体配对

| 用途 | 字体 | 备选 | CSS |
|------|------|------|-----|
| **正文（中英文）** | Noto Serif SC + Noto Serif | Source Han Serif | `font-family: 'Noto Serif SC', 'Noto Serif', serif` |
| **UI 控件** | Inter | SF Pro, Segoe UI | `font-family: 'Inter', system-ui, sans-serif` |
| **代码/等宽** | JetBrains Mono | Fira Code | `font-family: 'JetBrains Mono', monospace` |
| **标题（特殊场景）** | Playfair Display | Cormorant Garamond | 用于装饰性标题 |

### 6.4 图标系统

使用 **Lucide Icons**（统一 24×24 viewBox，stroke-based）：
```tsx
import { BookOpen, Columns, Type, Sun, Moon, Upload, FileText } from 'lucide-react';
```

### 6.5 动效规范

| 元素 | 时长 | 缓动 | 属性 |
|------|------|------|------|
| 侧边栏开关 | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` | transform, opacity |
| 主题切换 | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | background-color, color |
| 按钮 hover | 150ms | ease-out | background-color, box-shadow |
| 气泡光标 | 实时 | — | requestAnimationFrame 驱动 |
| Toast 通知 | 300ms in / 200ms out | ease-out / ease-in | transform, opacity |
| 加载骨架屏 | 1.5s 循环 | ease-in-out | background-position (shimmer) |

---

## 7. 核心功能详解

### 7.1 多栏动态排版

利用 Pretext 的 `layoutNextLineRange()` API 实现**可变宽度的逐行排版**：

```typescript
// 伪代码：多栏排版核心逻辑
function layoutColumns(text: string, columnCount: number, columnWidth: number) {
  const prepared = prepareWithSegments(text, FONT);
  const columnHeight = viewportHeight;
  const columns: LineRange[][] = Array.from({ length: columnCount }, () => []);

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  let currentCol = 0;

  while (true) {
    const range = layoutNextLineRange(prepared, cursor, columnWidth);
    if (range === null) break;

    columns[currentCol].push(range);

    // 检查当前栏是否已满
    const colHeight = columns[currentCol].length * lineHeightPx;
    if (colHeight >= columnHeight) {
      currentCol++;
      if (currentCol >= columnCount) break;
    }

    cursor = range.end;
  }

  return columns;
}
```

### 7.2 光标气泡效果

在 Canvas 上使用**径向渐变蒙版**实现文字在光标周围的「浮现」效果：

```typescript
// 伪代码：光标气泡
function drawBubbleEffect(ctx: CanvasRenderingContext2D, cursorX: number, cursorY: number, radius: number) {
  // 1. 先绘制所有文字（正常状态）
  drawAllText(ctx, 'muted');

  // 2. 创建裁剪区域 —— 以光标为中心的圆形
  ctx.save();
  ctx.beginPath();
  ctx.arc(cursorX, cursorY, radius, 0, Math.PI * 2);
  ctx.clip();

  // 3. 在裁剪区域内重新绘制文字（高亮状态）
  //    可以用渐变边缘让效果更柔和
  const gradient = ctx.createRadialGradient(cursorX, cursorY, radius * 0.6, cursorX, cursorY, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.3)');
  ctx.fillStyle = gradient;
  drawAllText(ctx, 'highlighted');

  ctx.restore();
}
```

### 7.3 背景视频文字绕排

核心技术路线：

```
1. 用户上传视频
         ↓
2. 后端（可选）使用 OpenCV 逐帧分析：
   - 背景差分 → 提取运动物体轮廓
   - 边缘检测 (Canny) → 轮廓精度控制
   - 形态学操作 (dilate/erode) → 边缘精度
         ↓
3. 将每帧的轮廓数据序列化为 JSON 传给前端
         ↓
4. 前端在每帧渲染时：
   - 将轮廓数据映射到 Canvas 坐标
   - 文字行遇到轮廓区域时自动缩短宽度
   - 利用 Pretext layoutNextLineRange 的逐行变宽能力
```

**简化方案（纯前端）**：
- 使用 Canvas 绘制视频帧
- 逐行扫描像素亮度
- 遇到暗色区域（人物）→ 缩短该行文字宽度
- 灵敏度控制调节亮度阈值

### 7.4 本地文件上传完整流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 拖拽文件  │ or │ 点击上传  │ →  │ 前端预检  │ →  │ 上传进度  │
│ 到上传区  │    │ 选择文件  │    │ 扩展名/大小│   │ 实时显示  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 阅读器    │ ←  │ 存入状态  │ ←  │ 接收结果  │ ←  │ 后端处理  │
│ 渲染文本  │    │ Store    │    │ 成功/失败  │    │ 8步校验   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**前端上传防抖与限制：**
- 单文件上传（一次一篇）
- 重复上传替换当前内容（确认提示）
- 上传中禁用其他内容源切换

**错误提示映射：**

| 错误码 | 用户提示 |
|--------|----------|
| `UNSUPPORTED_FORMAT` | 「不支持 .xxx 格式，请上传 PDF/TXT/MD/DOCX/EPUB/HTML/TEX 文件」 |
| `FILE_TOO_LARGE` | 「文件过大（xxMB），请压缩至 50MB 以内或拆分上传」 |
| `EMPTY_CONTENT` | 「文件中未检测到有效文本内容，请检查文件是否损坏」 |
| `ENCODING_ERROR` | 「无法识别文件编码，请转换为 UTF-8 后重试」 |
| `CONTENT_REJECTED` | 「文件内容包含不安全的代码，已被拒绝」 |
| `PARSE_ERROR` | 「文件解析失败，请确认文件是否完整且未被加密」 |

---

## 8. 文件上传与校验

### 8.1 前端文件预检

```typescript
// utils/fileValidation.ts

export interface FileCheckResult {
  valid: boolean;
  error?: string;
  fileInfo?: {
    name: string;
    size: number;
    extension: string;
    typeIcon: string;          // lucide icon name
    estimatedChars?: number;
  };
}

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.epub', '.html', '.htm', '.tex'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// 按扩展名估算字符数（经验值）
const CHAR_ESTIMATE: Record<string, number> = {
  '.txt': 1,           // 1 byte ≈ 1 char (纯英文)
  '.md': 0.8,
  '.html': 0.05,       // HTML 标签占比高
  '.tex': 0.5,
  '.pdf': 0.3,         // PDF 含大量二进制结构
  '.docx': 0.2,
  '.epub': 0.4,
};

export function validateFile(file: File): FileCheckResult {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `不支持 .${ext} 格式。支持的格式: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `文件过大 (${formatBytes(file.size)})，请压缩至 ${formatBytes(MAX_SIZE)} 以内`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: '文件为空，请选择有效文件' };
  }

  const ratio = CHAR_ESTIMATE[ext] ?? 0.5;
  const estimatedChars = Math.floor(file.size * ratio);

  return {
    valid: true,
    fileInfo: {
      name: file.name,
      size: file.size,
      extension: ext,
      typeIcon: getTypeIcon(ext),
      estimatedChars,
    },
  };
}
```

### 8.2 后端校验实现

```python
# services/validation_service.py

import magic  # python-magic, libmagic 绑定
import chardet
from pathlib import Path
from typing import Optional, Tuple
import re

ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.md', '.docx', '.epub', '.html', '.htm', '.tex'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_TEXT_CHARS = 1_000_000

FORBIDDEN_PATTERNS = [
    re.compile(rb'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
    re.compile(rb'javascript\s*:', re.IGNORECASE),
    re.compile(rb'on\w+\s*=\s*["\'].*?["\']', re.IGNORECASE),
    re.compile(rb'<iframe[^>]*>', re.IGNORECASE),
    re.compile(rb'<embed[^>]*>', re.IGNORECASE),
    re.compile(rb'<object[^>]*>', re.IGNORECASE),
]

MIME_EXTENSION_MAP = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/epub+zip': '.epub',
    'text/html': '.html',
    'application/x-tex': '.tex',
}


class FileValidationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


def validate_file(file_path: Path, original_filename: str) -> dict:
    """
    完整的文件校验管线。
    返回: { 'mime_type', 'encoding', 'size' }
    抛出: FileValidationError
    """
    # ① 扩展名检查
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            'UNSUPPORTED_FORMAT',
            f'不支持的文件格式 "{ext}"，支持的格式: {", ".join(ALLOWED_EXTENSIONS)}'
        )

    # ② 文件大小检查
    size = file_path.stat().st_size
    if size > MAX_FILE_SIZE:
        raise FileValidationError(
            'FILE_TOO_LARGE',
            f'文件大小 {_format_bytes(size)} 超过限制 {_format_bytes(MAX_FILE_SIZE)}'
        )
    if size == 0:
        raise FileValidationError('EMPTY_CONTENT', '文件内容为空')

    # ③ MIME 魔术字节检测
    detected_mime = magic.from_file(str(file_path), mime=True)
    expected_ext = MIME_EXTENSION_MAP.get(detected_mime)
    warnings = []
    if expected_ext and expected_ext != ext:
        warnings.append(f'文件扩展名 ({ext}) 与实际内容类型 ({detected_mime}) 不匹配，仍尝试解析')

    # ④ 读取原始字节并检测编码
    raw_bytes = file_path.read_bytes()
    encoding_result = chardet.detect(raw_bytes[:100000])  # 检测前 100KB
    encoding = encoding_result.get('encoding', 'utf-8') or 'utf-8'
    confidence = encoding_result.get('confidence', 0)

    if confidence < 0.5:
        warnings.append(f'编码检测置信度较低 ({confidence:.0%})，使用 {encoding} 解码可能出现乱码')

    # ⑤ 文本内容安全检查（仅对文本类文件）
    if ext in {'.txt', '.md', '.html', '.htm', '.tex'}:
        for pattern in FORBIDDEN_PATTERNS:
            if pattern.search(raw_bytes):
                raise FileValidationError(
                    'CONTENT_REJECTED',
                    f'文件内容包含不安全代码，已被拒绝'
                )

    return {
        'mime_type': detected_mime,
        'encoding': encoding,
        'size': size,
        'warnings': warnings,
        'extension': ext,
    }


def _format_bytes(n: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if n < 1024:
            return f'{n:.1f} {unit}'
        n /= 1024
    return f'{n:.1f} TB'
```

### 8.3 文本提取调度器

```python
# services/extraction_service.py

from pathlib import Path
from typing import Optional

class ExtractionService:
    """根据文件格式调度不同的文本提取器"""

    async def extract(self, file_path: Path, extension: str, encoding: str,
                      max_chars: int = 500_000) -> dict:
        extractor = self._get_extractor(extension)
        text = await extractor(file_path, encoding)

        # 截断
        if len(text) > max_chars:
            text = text[:max_chars]
            truncated = True
        else:
            truncated = False

        # 空内容检查
        cleaned = text.strip()
        if not cleaned:
            raise FileValidationError('EMPTY_CONTENT', '文件中未检测到有效文本内容')

        return {
            'text': cleaned,
            'char_count': len(cleaned),
            'truncated': truncated,
            'preview': cleaned[:500],
        }

    def _get_extractor(self, extension: str):
        extractors = {
            '.pdf': extract_pdf,
            '.txt': extract_txt,
            '.md': extract_markdown,
            '.docx': extract_docx,
            '.epub': extract_epub,
            '.html': extract_html,
            '.htm': extract_html,
            '.tex': extract_latex,
        }
        return extractors[extension]
```

---

## 9. Zotero 插件设计

### 9.1 插件架构

```
zotero-pretext-reader/
├── addon/                         # 静态资源 (直接复制进 XPI)
│   ├── bootstrap.js               # 插件入口 + 生命周期
│   ├── manifest.json              # 插件元数据
│   ├── content/
│   │   ├── reader.html            # 阅读器独立页面
│   │   ├── reader.js              # 阅读器编译产物
│   │   └── icons/
│   │       ├── icon16.png
│   │       ├── icon32.png
│   │       └── icon64.png
│   ├── locale/
│   │   ├── en-US/
│   │   │   └── prefs.ftl
│   │   └── zh-CN/
│   │       └── prefs.ftl
│   └── prefs.js                   # 默认偏好设置
├── src/                           # TypeScript 源码
│   ├── index.ts                   # 主入口
│   ├── reader.ts                  # 阅读器核心逻辑
│   ├── pretext-bridge.ts          # Pretext 调用封装
│   ├── zotero-api.ts             # Zotero 内部 API 封装
│   └── ui.ts                      # UI 组件（菜单、对话框）
├── build/                         # 构建输出
├── package.json
├── tsconfig.json
├── zotero-plugin.config.ts        # 插件构建配置
└── README.md
```

### 9.2 核心文件

#### manifest.json

```json
{
  "manifest_version": 2,
  "name": "Pretext Reader",
  "version": "0.1.0",
  "description": "基于 Pretext 引擎的多栏动态阅读器 — 让文献阅读像翻杂志一样优雅",
  "author": "Your Name",
  "homepage_url": "https://github.com/yourname/zotero-pretext-reader",
  "applications": {
    "zotero": {
      "id": "pretext-reader@yourdomain.com",
      "update_url": "https://github.com/yourname/zotero-pretext-reader/releases/latest/download/update.json",
      "strict_min_version": "7.0",
      "strict_max_version": "7.*"
    }
  },
  "permissions": [
    "activeTab"
  ]
}
```

#### bootstrap.js（核心生命周期）

```javascript
// addon/bootstrap.js

var PretextReader;

async function install() {
  Zotero.log('Pretext Reader: 插件已安装');
}

async function startup({ id, version, resourceURI, rootURI }) {
  Zotero.log(`Pretext Reader ${version}: 启动中...`);

  // 动态加载编译后的 reader.js
  Services.scriptloader.loadSubScript(rootURI + 'content/reader.js');

  // 初始化阅读器实例
  PretextReader = new Zotero.PretextReader({
    resourceURI,
    rootURI,
  });

  // 注册右键菜单
  PretextReader.registerMenuItem();

  // 注册工具栏按钮
  PretextReader.registerToolbarButton();

  // 注册快捷键
  PretextReader.registerShortcuts();

  Zotero.log('Pretext Reader: 启动完成');
}

async function shutdown() {
  Zotero.log('Pretext Reader: 关闭中...');

  if (PretextReader) {
    PretextReader.destroy();
    PretextReader = null;
  }

  // 清理 UI 元素
  Zotero.PretextReader.unregisterAll();
}

async function uninstall() {
  Zotero.log('Pretext Reader: 已卸载');
}
```

### 9.3 插件数据流

```
┌─────────────────────────────────┐
│         Zotero 桌面应用          │
│                                 │
│  用户选中文献条目                 │
│       │                         │
│       ▼                         │
│  ┌──────────────┐               │
│  │ 获取条目全文  │               │
│  │ - PDF 附件   │               │
│  │ - 笔记内容   │               │
│  │ - 摘要字段   │               │
│  └──────┬───────┘               │
│         │ 文本                   │
│         ▼                       │
│  ┌──────────────┐               │
│  │ Pretext.js   │ ← 客户端排版   │
│  │ prepare()    │               │
│  │ layout()     │               │
│  └──────┬───────┘               │
│         │ 排版数据               │
│         ▼                       │
│  ┌──────────────┐               │
│  │ Canvas 渲染  │               │
│  │ (内嵌面板或  │               │
│  │  独立窗口)   │               │
│  └──────────────┘               │
└─────────────────────────────────┘
```

**关键设计决策：插件完全在本地运行排版计算，不上传用户文献数据。**

（可选：提供「云增强」开关，允许调后端 API 进行视频背景分析等增值功能）

### 9.4 提交至插件市场

目标仓库：[syt2/zotero-addons-scraper](https://github.com/syt2/zotero-addons-scraper)

**提交步骤：**

1. Fork `syt2/zotero-addons-scraper`
2. 在 `addons/` 目录创建 `zotero-pretext-reader.yml`：

```yaml
# addons/zotero-pretext-reader.yml
repo: yourname/zotero-pretext-reader
releases:
  - targetZoteroVersion: "7"
    tagName: latest
```

3. 确保插件仓库满足：
   - Release 页面有 `.xpi` 文件
   - 根目录有 `update.json`（自动更新配置）
   - `manifest.json` 中 `applications.zotero.id` 唯一
4. 发起 Pull Request

---

## 10. 项目目录结构

```
pretext-reader/
├── backend/                          # Python 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI 应用入口
│   │   ├── config.py                 # 全局配置
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes.py             # 路由注册
│   │   │   ├── file_upload.py        # 文件上传端点
│   │   │   ├── arxiv.py              # ArXiv 代理端点
│   │   │   ├── url_fetch.py          # URL 抓取端点
│   │   │   └── samples.py            # 示例文章端点
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── validation_service.py # 文件校验
│   │   │   ├── extraction_service.py # 文本提取调度
│   │   │   ├── extractors/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pdf_extractor.py
│   │   │   │   ├── txt_extractor.py
│   │   │   │   ├── docx_extractor.py
│   │   │   │   ├── epub_extractor.py
│   │   │   │   ├── html_extractor.py
│   │   │   │   ├── markdown_extractor.py
│   │   │   │   └── latex_extractor.py
│   │   │   ├── url_service.py        # URL 抓取 + readability
│   │   │   ├── arxiv_service.py      # ArXiv API 交互
│   │   │   ├── security_service.py   # 内容安全过滤
│   │   │   └── cache_service.py      # 缓存管理
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── requests.py           # 请求模型 (Pydantic)
│   │   │   └── responses.py          # 响应模型 (Pydantic)
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── encoding.py           # 编码检测工具
│   │       └── logger.py             # 日志配置
│   ├── tests/
│   │   ├── test_validation.py
│   │   ├── test_extraction.py
│   │   └── fixtures/                 # 测试用文件
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/                         # React 前端
│   ├── src/
│   │   ├── main.tsx                  # 入口
│   │   ├── App.tsx                   # 根组件
│   │   ├── store/
│   │   │   └── readerStore.ts        # Zustand 全局状态
│   │   ├── hooks/
│   │   │   ├── usePretext.ts         # Pretext 引擎 Hook
│   │   │   ├── useFileUpload.ts      # 文件上传 Hook
│   │   │   ├── useBackgroundVideo.ts # 背景视频 Hook
│   │   │   └── useKeyboard.ts        # 键盘快捷键 Hook
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── ReaderArea.tsx
│   │   │   ├── upload/
│   │   │   │   ├── FileUpload.tsx     # 文件上传主组件
│   │   │   │   ├── UploadDropZone.tsx # 拖拽区域
│   │   │   │   ├── FileInfoCard.tsx   # 文件信息卡片
│   │   │   │   └── UploadProgress.tsx # 进度指示器
│   │   │   ├── reader/
│   │   │   │   ├── PageCanvas.tsx     # Canvas 渲染引擎
│   │   │   │   ├── TextLayer.tsx      # 文字层
│   │   │   │   ├── BubbleLayer.tsx    # 光标气泡层
│   │   │   │   ├── BackgroundLayer.tsx# 背景视频层
│   │   │   │   └── CursorLayer.tsx    # 自定义光标层
│   │   │   ├── controls/
│   │   │   │   ├── ColumnSlider.tsx
│   │   │   │   ├── FontSizeSlider.tsx
│   │   │   │   ├── ThemeSwitcher.tsx
│   │   │   │   └── FullscreenButton.tsx
│   │   │   ├── content/
│   │   │   │   ├── ArXivInput.tsx
│   │   │   │   ├── UrlInput.tsx
│   │   │   │   └── SampleLoader.tsx
│   │   │   └── ui/
│   │   │       ├── Toast.tsx
│   │   │       ├── Skeleton.tsx
│   │   │       └── IconButton.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                # API 客户端
│   │   │   ├── fileValidation.ts     # 前端文件预检
│   │   │   ├── pretext-engine.ts     # Pretext 封装
│   │   │   └── theme.ts              # 主题变量
│   │   ├── styles/
│   │   │   ├── index.css             # Tailwind 入口
│   │   │   ├── themes.css            # 六套主题 CSS 变量
│   │   │   └── fonts.css             # 字体定义
│   │   └── types/
│   │       └── index.ts              # TypeScript 类型定义
│   ├── public/
│   │   ├── samples/                  # 内置示例文章
│   │   └── favicon.svg
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── zotero-plugin/                    # Zotero 插件
│   ├── addon/
│   │   ├── bootstrap.js
│   │   ├── manifest.json
│   │   ├── content/
│   │   └── locale/
│   ├── src/
│   │   ├── index.ts
│   │   ├── reader.ts
│   │   ├── pretext-bridge.ts
│   │   ├── zotero-api.ts
│   │   └── ui.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── zotero-plugin.config.ts
│
├── shared/                           # 前后端共享
│   └── types/                        # 共享类型定义
│       ├── content.ts
│       └── validation.ts
│
├── docs/
│   ├── DEVELOPMENT_DOC.md            # 本文档
│   ├── API.md                        # API 文档
│   └── PLUGIN_SUBMISSION.md         # 插件提交指南
│
├── docker-compose.yml                # Docker 编排
├── .env.example
├── .gitignore
└── README.md
```

---

## 11. 开发路线图

### Phase 1: 核心基础（第 1-3 周）

```
Week 1-2: 后端基础
├── FastAPI 项目搭建
├── 文件上传 API + 校验管线
├── PDF/TXT/MD 提取器
├── ArXiv API 代理
└── URL 抓取服务

Week 2-3: 前端基础
├── Vite + React + Tailwind 项目搭建
├── 基础布局（Sidebar + Reader）
├── 六套主题 + 主题切换
├── 基础多栏排版（Pretext 集成）
└── 文件上传组件 + 拖拽支持
```

### Phase 2: 核心体验（第 4-6 周）

```
Week 4-5: 阅读器增强
├── 光标气泡效果
├── 字号/行高/栏数 实时调节
├── 响应式适配（Mobile/Tablet/Desktop）
├── 阅读进度指示
└── 全屏阅读模式

Week 5-6: 后端补全
├── DOCX/EPUB/HTML/LaTeX 提取器
├── 内容安全检查
├── 缓存系统
├── 单元测试 + 集成测试
└── 错误处理完善
```

### Phase 3: 高级特性（第 7-9 周）

```
Week 7-8: 背景视频
├── 后端视频分析（OpenCV 可选）
├── 前端视频渲染层
├── 文字绕视频轮廓
├── 灵敏度/精度控制
└── 反向模式

Week 8-9: 打磨
├── 自定义光标
├── 键盘快捷键全览
├── 性能优化（虚拟滚动、懒加载）
├── 无障碍（a11y）适配
└── i18n 国际化（中/英）
```

### Phase 4: Zotero 插件（第 10-12 周）

```
Week 10-11: 插件开发
├── zotero-plugin-template 初始化
├── Pretext.js 嵌入
├── Zotero 条目读取（PDF/笔记）
├── 内嵌阅读器面板
└── 独立窗口模式

Week 11-12: 插件发布
├── 构建 .xpi 包
├── GitHub Release + update.json
├── 向 zotero-addons-scraper 提 PR
└── 文档 + 截屏 + 演示视频
```

---

## 12. 部署方案

### 12.1 网站部署

**推荐：Docker Compose 一键部署**

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MAX_FILE_SIZE=52428800
      - CACHE_TTL=86400
      - ALLOWED_ORIGINS=https://yourdomain.com
    volumes:
      - ./cache:/app/cache
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=https://api.yourdomain.com
    depends_on:
      - backend
    restart: unless-stopped
```

**备选：**
- 后端 → Railway / Render / 阿里云 ECS
- 前端 → Vercel / Netlify / Cloudflare Pages
- 静态资源 → CDN + OSS

### 12.2 环境变量

```bash
# .env.example

# 后端
MAX_FILE_SIZE=52428800          # 50MB
CACHE_TTL=86400                 # 24h
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
MAX_TEXT_CHARS=1000000
ENABLE_OCR=false                # PDF OCR（需额外配置 Tesseract）

# 前端
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Pretext Reader
VITE_DEFAULT_THEME=light
```

---

## 13. 附录

### 13.1 与 Textdance 的差异化改进

| 维度 | Textdance | Pretext Reader（本项目） |
|------|-----------|--------------------------|
| **内容源** | ArXiv + URL + 示例 | ← + **本地文件上传**（7种格式）+ Zotero 条目 |
| **主题数量** | 3 套（暗/亮/纸） | **6 套**（暗/亮/纸/森林/海洋/日落） |
| **文件上传** | ❌ 不支持 | ✅ 拖拽上传 + 格式校验 + 进度显示 |
| **格式校验** | — | 扩展名+MIME+编码+内容安全 四重校验 |
| **设计系统** | 基础 CSS | Tailwind + 设计 Token + 完整动效规范 |
| **响应式** | 桌面优先 | Mobile-first 三断点 + 自适应栏数 |
| **无障碍** | 部分支持 | WCAG 2.1 AA 目标（4.5:1 对比度等） |
| **国际化** | 仅中文 | 中/英双语 + FTL 翻译文件 |
| **Zotero 插件** | ❌ 无 | ✅ 独立插件，本地排版，离线可用 |
| **错误处理** | 静默失败 | 分类错误码 + 友好提示 + 重试机制 |
| **性能** | Pretext 驱动 | ← + React 虚拟化 + 流式渲染 |

### 13.2 关键依赖版本

```
# Python (backend/requirements.txt)
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9
aiohttp>=3.9.0
pdfplumber>=0.11.0
PyMuPDF>=1.24.0
python-docx>=1.1.0
ebooklib>=0.18.0
markdown-it-py>=3.0.0
beautifulsoup4>=4.12.0
readability-lxml>=0.8.0
pylatexenc>=2.10
chardet>=5.2.0
python-magic>=0.4.27
bleach>=6.1.0

# Node (frontend/package.json)
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "@chenglou/pretext": "latest",
  "zustand": "^5.0.0",
  "lucide-react": "^0.400.0",
  "tailwindcss": "^4.0.0"
}
```

### 13.3 参考资料

| 资源 | URL |
|------|-----|
| Pretext 仓库 | https://github.com/chenglou/pretext |
| Pretext 官方 Demo | https://chenglou.me/pretext/ |
| Pretext 社区 Demo | https://somnai-dreams.github.io/pretext-demos/ |
| Zotero 插件模板 | https://github.com/windingwind/zotero-plugin-template |
| Zotero 插件工具库 | https://github.com/windingwind/zotero-plugin-toolkit |
| Zotero 插件市场 | https://github.com/syt2/zotero-addons-scraper |
| Zotero 开发文档 | https://www.zotero.org/support/dev/plugins |
| FastAPI 文档 | https://fastapi.tiangolo.com/ |
| Tailwind CSS | https://tailwindcss.com/ |
| Lucide Icons | https://lucide.dev/ |

---

## 文档版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1.0 | 2026-06-07 | 初稿，完整架构+功能设计 |

---

> 📌 **下一步**：请审阅本文档，确认架构设计、功能范围和技术选型。如需调整任何部分，请指出，我将更新文档后启动 Phase 1 开发。
