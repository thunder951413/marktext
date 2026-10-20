<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText Desktop</h1>

<p align="center">
  带 Vim 的 Markdown 实时预览编辑器：写的是源码，看到的是排好版的文档。<br>
  macOS · Windows · Linux
</p>

## 这是什么

一个基于 Electron 的 Markdown 桌面编辑器。它最初从 [MarkText](https://github.com/marktext/marktext) 分叉而来，现在编辑核心已经重写，两者的差别主要在这几点：

- **Obsidian 式实时预览。** 编辑内核是基于 CodeMirror 6 的 `packages/wysiwyg`：Markdown 源码始终是唯一的数据来源，预览效果由语法树的装饰层实时渲染。光标不在的地方显示排版效果，光标进入某个元素时才显示原始标记。
- **完整的 Vim。** 实时预览模式和源码模式用同一套 [`@replit/codemirror-vim`](https://github.com/replit/codemirror-vim)：运算符加动作、文本对象、寄存器、marks、`.` 重复、搜索，以及 `:w`、`:q`、`:wq`、`:x`、`:s` 等 Ex 命令。
- **大文档不卡。** CodeMirror 只渲染视口内的内容，超过 50 000 字符的文档只装饰视口附近的一小段。在 704 KB 的文档上，打开时间从约 8.7 秒降到约 50 毫秒，打字延迟中位数从约 400 毫秒降到约 27 毫秒（测试方法和完整数据见 [docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md)）。
- **只面向桌面。** macOS、Windows 和 Linux，不做 Android/iOS。

## 功能

**写作**

- CommonMark 和 GitHub Flavored Markdown：表格、任务列表、删除线、脚注、`==高亮==`、front matter。
- 数学公式（KaTeX）、Mermaid 和 PlantUML 图表、行内 HTML 预览（经过清洗）。
- 本地图片：相对路径、绝对路径、Windows 盘符路径和 UNC 路径都能显示；文件名里的 `#`、`%` 等字符会被正确转义，加载失败时显示占位。
- 表格以网格渲染，光标进入时显示源码；`Alt-Shift-←/→` 移动列，`Alt-Shift-F` 对齐表格；`Alt` 加拖动可以做矩形选择。
- 浮动格式工具栏，代码块语言和 emoji 补全。
- 专注模式、打字机模式、源码模式；字数统计放在 Web Worker 里，不阻塞界面。

**界面**

- 多标签页，`Ctrl/Cmd+N` 新建文档，新文档在输入内容之前不会被视为未保存。
- 整体显示缩放（`50%`–`200%`），标题栏、菜单、命令面板和快捷键都能操作。
- 标题栏有“目录”按钮，一键开关按标题导航的侧栏（也可用 `Ctrl/Cmd+K`）。
- 主题快速切换：标题栏的调色盘按钮或 `Ctrl/Cmd+Alt+T` 打开面板，鼠标悬停或 ↑/↓ 即时预览，回车或点击应用，`Esc` 还原；支持输入筛选。
- 内置 30 多套主题，包括 Catppuccin、Dracula、Gruvbox、Kanagawa、Monokai Pro 等；列表圆点、标题、链接、引用等的颜色跟随主题。
- 界面语言：英语、简体中文、繁体中文、日语、韩语、德语、法语、西班牙语、葡萄牙语、土耳其语。

### Vim

- 默认启用，状态栏显示 `NORMAL`、`INSERT`、`VISUAL`、`VISUAL LINE` 或 `SEARCH`，以及尚未完成的计数或命令。
- 在实时预览中，`j`/`k` 可以直接移进表格和其他渲染块。
- **Windows 上的取舍：** 菜单快捷键在 Windows 上用 `Ctrl`（`Ctrl+R` 替换、`Ctrl+V` 粘贴、`Ctrl+W` 关闭标签页……），会和 Vim 的 `Ctrl` 组合键冲突。所以 Windows 只保留 Vim 的基本功能（动作、运算符、寄存器、搜索、Ex 命令），**屏蔽除 `Ctrl-[` 以外的所有 `Ctrl` 组合键**。重做请用 `Ctrl+Shift+Z` 或 `:redo`。macOS 的菜单快捷键用 `Cmd`，不受影响。

## 下载

在 [Releases](https://github.com/thunder951413/marktext/releases) 页面下载，每个版本都附带 SHA-256 校验文件。

| 平台 | 产物 |
| --- | --- |
| macOS | `marktext-mac-{arm64,x64}-<版本>.dmg` / `.zip` |
| Windows | `marktext-win-{x64,arm64}-<版本>-setup.exe`（安装包）/ `.zip` |
| Linux | `AppImage`、`deb`、`rpm`、`snap`、`tar.gz` |

当前版本为 `0.20.1`。Windows 版本已在 CI 中构建，但开发主要在 macOS 上进行，Windows 上遇到问题请提交 issue。

## 从源码运行

需要 Node.js ≥ 20.19 和 pnpm ≥ 10（版本固定为 `pnpm@10.33.4`）。

```bash
pnpm install
pnpm dev                 # 开发模式
pnpm build:unpack        # 构建但不打包，用于本地检查
pnpm build:mac:arm64     # 打包：还有 build:mac:x64、build:win:x64、build:win:arm64、build:linux
```

安装包输出到仓库根目录的 `dist/`。

## 代码结构

这是一个 pnpm 工作区，主要的包在 `packages/` 下：

| 包 | 作用 |
| --- | --- |
| [`desktop`](packages/desktop) | Electron 应用本体（Vue 3、Pinia、electron-vite、electron-builder） |
| [`wysiwyg`](packages/wysiwyg) | 基于 CodeMirror 6 的实时预览编辑内核，详见[它的 README](packages/wysiwyg/README.md) |
| [`muya`](packages/muya) | `@muyajs/core`，Muya 第二代（TypeScript）：回退用的 Muya 编辑器所依赖的核心，也是 Markdown 转换、导出、图表加载等工具库 |
| [`muyajs`](packages/muyajs) | `@marktext/muyajs`，Muya 第一代（JavaScript，遗留包，不再新增功能） |
| [`website`](packages/website) | 项目网站（Next.js） |

## 编辑器引擎

默认使用 CodeMirror 引擎。旧的 Muya 编辑器只作为回退，不再增加新功能，满足退出条件后会删除，决策过程见 [docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md)。

切换回 Muya：在“偏好设置 → 编辑器 → 杂项 → 所见即所得引擎”里选择 Muya，重启后生效；也可以用环境变量临时指定：

```bash
MARKTEXT_EDITOR_ENGINE=muya pnpm dev
```

### 已知限制

CodeMirror 引擎还没有迁移这些 Muya 的浮层功能：图片编辑工具栏（裁剪、缩放、路径选择）、链接悬浮工具、脚注工具、`@` 快速插入菜单和段落前置菜单。对应的操作可以通过应用菜单和命令面板完成，点击图片可以预览，`Ctrl/Cmd` 加点击可以打开链接。桌面端到端测试目前大部分仍然跑在 Muya 上，CodeMirror 引擎的覆盖还很少。

## 开发与测试

```bash
pnpm lint            # ESLint
pnpm typecheck       # desktop、muya、wysiwyg 的类型检查
pnpm test            # 单元测试：desktop、muya、wysiwyg
pnpm test:e2e        # 桌面端到端测试（Playwright，需要图形环境）
```

给仓库贡献时，另见：

- [docs/ENGINE_DECISION.md](docs/ENGINE_DECISION.md)：为什么用 CodeMirror，以及 Muya 的退出条件。
- [docs/UPSTREAM_SYNC.md](docs/UPSTREAM_SYNC.md)：如何吸收上游 MarkText 的修复，以及容易冲突的文件。
- [CLAUDE.md](CLAUDE.md)：目录结构、技术栈和工程约定的详细说明。

## 与上游的关系

本项目源自 [marktext/marktext](https://github.com/marktext/marktext)，感谢原作者和贡献者。最后一次合并上游是在 2026-07，之后的开发独立进行，上游的修复会按 [docs/UPSTREAM_SYNC.md](docs/UPSTREAM_SYNC.md) 的流程选择性同步。上游的功能介绍、历史安装方式和贡献指南请看[上游 README](https://github.com/marktext/marktext#readme)。

## 许可证

[MIT License](LICENSE)
