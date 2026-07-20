<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText Desktop</h1>

<p align="center">
  面向 macOS、Windows 和 Linux 的 Markdown 桌面编辑器维护分支。
</p>

> 本仓库基于 [MarkText 上游项目](https://github.com/marktext/marktext) 继续维护。原项目介绍、完整功能说明、历史安装方式、贡献指南和赞助信息请查看[上游原始 README](https://github.com/marktext/marktext#readme)。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 当前版本 | `0.20.0-rc.5` |
| 开发分支 | `codex/desktop-performance-foundation` |
| 桌面平台 | macOS、Windows、Linux（不包含 Android/iOS） |
| macOS 本地应用 | GitHub Release 的 Apple Silicon (`arm64`) 产物已校验、安装并运行 |
| GitHub Release | [`v0.20.0-rc.5`](https://github.com/thunder951413/marktext/releases/tag/v0.20.0-rc.5) 已发布，含 macOS、Windows、Linux 产物与 SHA-256 |
| 合并请求 | [thunder951413/marktext#1](https://github.com/thunder951413/marktext/pull/1) |

## 本分支修改

### 新建文档

- 文件菜单新增明确的“新建文档”入口。
- 标签栏保留可点击的 `+`，并补充键盘操作、标题和无障碍标签。
- 新文档以干净的 `Untitled` 标签打开；输入内容后才进入未保存状态，继续复用现有保存和关闭确认流程。
- 标准快捷键：macOS 使用 `Command+N`，Windows/Linux 使用 `Ctrl+N`。
- 新建窗口调整为 macOS `Command+Option+N`、Windows/Linux `Ctrl+Shift+N`，避免快捷键冲突。

### 整体显示缩放

- 标题栏新增 `− / 百分比 / +` 缩放控件；点击百分比可恢复 `100%`。
- 支持窗口菜单、命令面板和快捷键操作。
- 放大：macOS `Command+=`，Windows/Linux `Ctrl+=`。
- 缩小：macOS `Command+-`，Windows/Linux `Ctrl+-`。
- 恢复实际大小：macOS `Command+0`，Windows/Linux `Ctrl+0`。
- 缩放范围为 `50%`–`200%`，步长为 `12.5%`。
- 缩放只改变 Electron 窗口的显示比例，不改写 Markdown 内容、编辑器文本或保存文件。

### Vim 模式

- WYSIWYG 和源代码模式均默认以 `NORMAL` 打开，`i` 进入现有编辑体验，`Esc` 返回 Normal。
- WYSIWYG 的 Normal 模式使用随字符宽度变化的蓝色块状光标，Insert 模式恢复原生细竖线；空白新文档、滚动、缩放和窗口尺寸变化时均会重新定位。
- 状态栏持续显示 `NORMAL`、`INSERT`、`VISUAL`、`VISUAL LINE` 或 `SEARCH`，并显示尚未完成的计数/命令。
- 标准移动：`h/j/k/l`、`w/b/e`、`0/^/$`、`gg/G`，支持 `5j`、`3w` 等数字前缀。
- 插入位置：`i/I/a/A/o/O`。
- 撤销与重做：`u`、`Ctrl+R`。
- 查找：`/`、`?`、`n/N`；行内字符查找支持 `f/F/t/T` 和 `;/,` 重复。
- 编辑操作：`x`、`D`、`dd`、`cc`、`yy`、`p/P`，以及 `d/c/y + motion`（例如 `dw`、`c$`、`y2w`）。
- 选择操作：`v` 和 `V` 进入字符/整行 Visual 模式，可配合移动与 `d/c/y`。
- Normal/Visual 模式拦截普通输入、粘贴、剪切、拖放和中文输入法组合事件，防止意外改写内容；应用级快捷键仍可正常使用。
- `dd` 在列表中删除当前列表项，不会误删整个列表。
- 源代码模式使用维护中的 CodeMirror 6 Vim 扩展；WYSIWYG 通过 Muya 的 selection、history、clipboard 和 search 接口实现结构化语义。
- 暂不实现寄存器、marks、宏、vimrc 和完整 Ex 命令体系。

### 应用图标

- 采用原创的浅色文档页与深色 Markdown `M` 折线，辅以少量青蓝折面，替换原黑底青色几何图标。
- 图标外部使用透明背景，并为小尺寸保留清晰的单一轮廓。
- 同步生成 macOS 多分辨率 ICNS、Windows 多尺寸 ICO、Linux PNG、应用内图标及 README 标识。

### 编辑器与性能

- 源代码模式迁移到 CodeMirror 6，利用视口渲染改善大文档滚动和编辑性能。
- 字数统计移至 Web Worker，降低主界面在大文档统计时的阻塞。
- Muya 文档渲染采用分批调度，减少大批量节点同步插入造成的长任务。
- 优化块链表、父子节点和行内渲染路径，减少重复遍历与布局读取。
- 补充大文档、目录滚动、脏状态、渲染批处理及交互回归测试。

### 桌面平台与构建

- 当前目标仅为 macOS、Windows 和 Linux，不规划 Android/iOS 客户端。
- macOS 支持 `arm64` 和 `x64` 独立产物。
- Windows 支持 `arm64` 和 `x64` 安装包。
- Linux 保留桌面发行格式，由 GitHub Actions 统一生成发布产物。

## 验证结果

`0.20.0-rc.5` 当前已完成以下验证：

- 桌面端类型检查通过。
- ESLint 通过，无新增错误。
- 桌面端单元测试通过：53 个测试文件、747 项测试。
- Muya 编辑器单元测试通过：213 个测试文件、1441 项测试。
- 桌面端完整端到端测试通过：226 项通过、4 项按既有条件跳过。
- 新建文档端到端功能断言通过。
- 显示缩放与 Markdown 内容不变端到端断言通过。
- Vim 键序列状态机 7 项单元测试通过。
- Vim WYSIWYG/源码模式 8 项端到端场景通过，包括块光标尺寸与显隐、空白新文档定位、模式切换、输入防护、`hjkl` 导航、计数、撤销、搜索、operator、Visual、字符查找、剪贴板粘贴、换行插入和列表项删除。
- 新图标的 PNG alpha、16–1024 像素缩放、7 层 ICO 和 10 层 ICNS 资源已校验。
- 生产构建通过。
- macOS `arm64` 的 DMG、ZIP 和应用包已生成；应用版本、CPU 架构、签名完整性及启动运行均已校验。

## 发布结果

1. `0.20.0-rc.5` 代码和标签已推送，macOS、Windows、Linux 五组构建均成功。
2. GitHub Release 已发布 24 个资产，其中 23 个发行文件均列入 `SHA256SUMS.txt`。
3. macOS `arm64` ZIP 与发布校验和一致，本地应用已由该正式产物更新到 `0.20.0-rc.5`。
4. 本地应用已验证 arm64 架构、签名完整性、正常启动以及 Normal/Insert 光标切换。

## 许可证

本项目继续使用 [MIT License](LICENSE)。
