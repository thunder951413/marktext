<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText Desktop</h1>

<p align="center">
  面向 macOS、Windows 和 Linux 的 Markdown 桌面编辑器维护分支。
</p>

> 本仓库基于 [MarkText 上游项目](https://github.com/marktext/marktext) 继续维护。原项目介绍、完整功能说明、历史安装方式、贡献指南和赞助信息请查看[上游原始 README](https://github.com/marktext/marktext#readme)。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 当前版本 | `0.20.0-rc.2` |
| 开发分支 | `codex/desktop-performance-foundation` |
| 桌面平台 | macOS、Windows、Linux（不包含 Android/iOS） |
| macOS 本地构建 | Apple Silicon (`arm64`) 已构建、校验并安装运行 |
| GitHub Release | `rc.2` 待 GitHub Actions 启用并完成多平台构建后发布 |
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

`0.20.0-rc.2` 当前已完成以下验证：

- 桌面端类型检查通过。
- ESLint 通过，无新增错误。
- 桌面端单元测试连续两轮通过：52 个测试文件、740 项测试。
- 新建文档端到端功能断言通过。
- 显示缩放与 Markdown 内容不变端到端断言通过。
- 生产构建通过。
- macOS `arm64` 的 DMG、ZIP 和应用包已生成；应用版本、CPU 架构、签名完整性及启动运行均已校验。

> Electron 端到端测试进程在当前本机构建环境退出时存在 Playwright worker teardown 超时；未修改的基线启动测试也可复现。测试主体和本次新增功能断言均已通过，因此该现象不属于新功能回归，后续仍会在 GitHub Actions 环境复核完整套件。

## 发布计划

1. 推送 `0.20.0-rc.2` 代码并运行 macOS、Windows、Linux 构建矩阵。
2. 核对各平台包名、架构、版本号和 SHA-256。
3. 创建 `v0.20.0-rc.2` GitHub Release 并上传完整产物。
4. 使用正式 Release 产物再次更新和验证本地应用。

## 许可证

本项目继续使用 [MIT License](LICENSE)。
