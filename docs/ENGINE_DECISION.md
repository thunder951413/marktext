# 所见即所得引擎路线决策

- 日期：2026-10-14
- 适用分支：`codex/desktop-performance-foundation`（`0.20.0-rc.7` 之后）
- 结论：**选 C：按 A 的方向分阶段推进。** CodeMirror 引擎（`packages/wysiwyg`）是唯一的目标引擎，本轮把它设为默认。Muya 编辑器路径冻结，只作回退，满足退出条件后删除。`@muyajs/core` 继续作为工具库保留。

## 1. 为什么不是 A、也不是 B

| 方案 | 问题 |
| --- | --- |
| A：补齐后立刻移除 Muya | 这个环境跑不了桌面 Electron E2E。现有 63 个 Playwright 用例文件中，62 个默认在 Muya 上运行，其中 40 个直接断言 Muya 的 DOM（`mu-*`）。另外还有图片编辑浮层、`@` 快速插入、块菜单等功能没有迁移。现在删掉 Muya，就没有回退手段，回归也没有安全网。 |
| B：冻结新引擎，回到 Muya | 跟用户的两个核心诉求正好相反，见下文第 2、3 节。Muya 的 Vim 是自研状态机（`util/vim/controller.ts` + `muyaAdapter.ts`，约 780 行），没有 Ex 命令、寄存器、marks、文本对象和 `.` 重复。新引擎的这些能力直接来自 `@replit/codemirror-vim`。Muya 打开 700 KB 文档要 8.7 秒，CodeMirror 只要约 50 毫秒。B 等于放弃已经做成的那一半。 |
| **C：默认切到 CodeMirror，Muya 冻结为回退，按条件移除** | 日常使用马上能得到 Vim 和大文档的收益。两套引擎并存的期限受到限制：Muya 不再接收新功能，回退开关保留两个 rc 周期。 |

## 2. 用户画像决定权重

用户是重度 Vim 用户，经常编辑大文档。按这个画像，各维度的权重依次为：Vim 完整度 > 大文档性能 > 浮动 UI 完整度 > 与上游同步的便利。

- **Vim**：现在源码模式和 CodeMirror 所见即所得模式用的是同一套 `codemirror-vim`。默认引擎切换后，两种模式的 Vim 行为一致。本轮又补上了 `:w`、`:q`、`:q!`、`:wq`、`:x`。`:s`、`:%s`、marks（`m`、`` ` ``、`'`）和寄存器（`"a`）在 codemirror-vim 中原本就有，并已用单元测试锁定。
- **大文档**：CodeMirror 只渲染视口内的内容，见第 3 节的实测数据。本轮还修复了新引擎每次按键都全文重建装饰的问题。

## 3. 对比

### 3.1 性能（本轮实测）

测试方法：用 esbuild 打包两套引擎，在 Chromium 中运行（Playwright 1.56 + chromium-1194，2 核云端容器）。测试文档由重复的“标题 + 段落（粗体、斜体、代码、链接）+ 列表 + 引用 + 代码块 + 表格”组成。光标放在文档中部，按 30 次键，每次间隔 150 毫秒。延迟指从 `keydown` 到下一帧完成的时间。

| 文档大小 | Muya 打开 | Muya 打字 p50 / p95 | CodeMirror 打开 | CM 打字 p50 / p95（优化前） | CM 打字 p50 / p95（本轮优化后） |
| --- | --- | --- | --- | --- | --- |
| 17 KB | 286 ms | 15 / 21 ms | 64 ms | 10 / 18 ms | 9 / 22 ms |
| 173 KB | 1 621 ms | 83 / 134 ms | 51 ms | 30 / 42 ms | **14 / 28 ms** |
| 704 KB | 8 746 ms | 401 / 715 ms | 51 ms | 82 / 108 ms | **27 / 56 ms** |

Muya 打开 704 KB 文档时生成了 150 002 个 DOM 节点。CodeMirror 只渲染视口内的内容。优化前，CodeMirror 引擎每次按键都要做两件事：遍历整棵语法树重建装饰；用“行数 × 代码块数”的二次扫描配对 `$$` 块。现在，超过 50 000 字符的文档只装饰视口前后各 4 000 字符的窗口，`$$` 配对也改成了线性扫描。

### 3.2 功能完整度

| 能力 | Muya | CodeMirror 引擎（本轮后） |
| --- | --- | --- |
| 行内格式渲染、标题、列表、引用、任务、数学公式、图表、HTML 预览、front matter | ✅ | ✅ |
| 浮动格式工具栏 | ✅ | ✅ 本轮新增（Vim 模式下只响应鼠标选区） |
| 表格渲染 | ✅ 网格 | ✅ 本轮新增网格渲染。光标进入表格行时显示源码，所以 `j`/`k` 可以直接移进表格。 |
| 表格行列增删、对齐 | ✅ 浮层菜单 | ✅ 菜单命令和 Tab/Enter 导航 |
| 表格拖动 | 行列**拖拽重排**（`tableDragBar`） | 用键盘代替：`Alt-Shift-←/→` 移动列，`Alt-↑/↓` 移动行 |
| 表格“列宽” | ❌（GFM 没有列宽语法，Muya 也不支持） | `Alt-Shift-F` 格式化表格，补齐空格让竖线对齐；中日韩全角字符按 2 格宽计算 |
| 矩形选择 | ❌ | ✅ `Alt` + 拖动 |
| 代码块语言选择器 | ✅ 浮层 | ✅ 本轮新增，用补全实现 |
| Emoji 选择器 | ✅ 浮层，插入 `:alias:` | ✅ 本轮新增，用补全实现，插入 emoji 字符本身 |
| `@` 快速插入菜单 | ✅ | ❌ 未迁移 |
| 段落前置按钮和块菜单 | ✅ | ❌ 未迁移（应用菜单可以完成同样操作） |
| 图片工具栏、裁剪、缩放、路径选择 | ✅ | ❌ 未迁移（点击图片可以预览） |
| 链接悬浮工具、脚注工具 | ✅ | ❌ 未迁移（Ctrl/Cmd 点击可以打开链接） |
| Vim | 自研子集 | `codemirror-vim` 全量 + 本轮 Ex 命令 |

### 3.3 测试

| | Muya 路径 | CodeMirror 路径 |
| --- | --- | --- |
| 引擎单元测试 | `packages/muya` 有自己的套件，包括 CommonMark/GFM 规范测试 | `packages/wysiwyg`：16 个文件，122 个用例，本轮新增 26 个 |
| 桌面 E2E | 62 个用例文件（40 个直接断言 `mu-*` DOM） | 1 个文件、2 个用例（`codemirror-preview.spec.ts`），**远远不够** |

### 3.4 维护成本

两套引擎并存时，需要维护：`editor.vue`（2 344 行）和 `codemirrorEditor.vue`（1 836 行）两个桌面适配层；两套 Vim（自研控制器 + codemirror-vim）；两套主题和 DOM 选择器；两套 E2E。C 方案的做法是：Muya 路径从现在起只修阻断性 bug，不加功能；新功能只做在 CodeMirror 上。删除条件见第 5 节。

## 4. 本轮已落地

1. `.zcode/` 加入 `.gitignore`。
2. 性能：只装饰视口窗口，`$$` 配对改为线性扫描，`parseTableAt` 只访问光标附近的节点。
3. 浮动格式工具栏（`features/formatToolbar.ts`）。
4. 表格网格渲染（`decorations/tableWidget.ts`）、列移动、表格格式化、`Alt` + 拖动矩形选择。
5. 代码块语言补全和 emoji 补全（`features/completions.ts`）。
6. Vim Ex 命令 `:w`、`:q`、`:q!`、`:wq`、`:x`（`features/vimEx.ts` + `desktop/util/vim/exCommands.ts`）。
7. 默认引擎切换为 CodeMirror，提供回退开关：
   - 偏好设置 → 编辑器 → 杂项 →“所见即所得引擎”，选择 Muya，重启后生效；
   - 环境变量 `MARKTEXT_EDITOR_ENGINE=muya`（或 `codemirror`）优先于偏好；
   - 旧 E2E 套件默认固定在 Muya 上运行（`test/e2e/helpers.ts`），所以切换默认引擎不会让现有用例失去意义。

## 5. Muya 删除的退出条件

以下条件全部满足后，删除 `editor.vue`、`util/vim/controller.ts`、`util/vim/muyaAdapter.ts` 和偏好中的 `muya` 选项：

1. 在 macOS 上用 CodeMirror 引擎跑通桌面 E2E。至少要把这几类用例移植过来：编辑输入、查找替换、TOC、标签切换光标、表格、图片、导出、XSS、Vim。
2. 图片工具（插入、路径选择、缩放）和链接悬浮工具在 CodeMirror 上可用。`@` 快速插入和块菜单可以用命令面板代替。
3. 默认使用 CodeMirror 发布两个 rc，期间没有因为引擎回退到 Muya 的问题报告。
4. 删除后，`@muyajs/core` 只作为库使用：导出 `MarkdownToHtml`、`htmlToMarkdown`、diagram loaders、slug、emoji 表。

如果两个 rc 内出现无法短期修复的数据正确性问题（例如保存的内容和文档不一致），就把默认值改回 `muya`（只改 `common/editorEngine.ts` 中的一行），并回到本文重新评估。

## 6. 风险

- **桌面 E2E 未在本轮运行**：云端环境没有 Electron 二进制，Mac 虚拟机也没有网络。发布 rc 前，必须在 Mac 上运行 `pnpm test:e2e`，并运行 `codemirror-preview.spec.ts`。
- 渲染层没有完整构建：云端缺少 rollup/rolldown 的原生二进制。引擎层用 esbuild 打包，在 Chromium 中做了截图验证；桌面层只完成了 `vue-tsc` 类型检查和单元测试。
- 已经习惯 Muya 浮层的操作（图片、`@` 菜单）在默认引擎下暂时不可用。需要时可以通过偏好切回 Muya。
