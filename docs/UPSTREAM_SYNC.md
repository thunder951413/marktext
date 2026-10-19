# 与上游 marktext/marktext 同步

本仓库是 [marktext/marktext](https://github.com/marktext/marktext) 的维护分支。本文说明如何定期吸收上游修复、哪些文件最容易冲突，以及冲突时该保留哪一边。

## 1. 现状（2026-10-14）

- 分叉点：`43bd8b77`（上游 `develop`，2026-07-06，`fix(desktop): preserve RTL text direction in PDF and print export (#4874)`）。之后没有再合并过上游。
- 本分支相对分叉点改动了 212 个文件（不含锁文件和许可证，约 +12 000 / −1 500 行）。改动集中在以下几处：
  - `packages/wysiwyg/`：本分支独有，上游没有这个包。
  - `packages/desktop/src/renderer/src/components/editorWithTabs/`：引擎切换、`codemirrorEditor.vue`、Vim。
  - `packages/desktop/src/renderer/src/codeMirror/`：源码模式迁移到 CodeMirror 6。
  - `packages/desktop/src/{preload,main/utils,shared/security}/`：IPC 白名单加固。
  - `packages/muya/src/`：11 个文件的性能补丁，包括分批渲染、字数统计、linkedList 和 markdownToState。
  - 版本号和 rc 发布说明：`package.json`、`README.md`。
- 分叉前四个月（2026-03 到 2026-07），上游 `develop` 有 467 个提交，平均每周 25 个左右，更新很活跃。

## 2. 一次性准备

```bash
git remote add upstream https://github.com/marktext/marktext.git
git config rerere.enabled true          # 记住冲突的解法，下次同样的冲突自动套用
git config rerere.autoupdate true
git fetch upstream
```

分支约定：

- 本地 `develop`：**只跟随** `upstream/develop`，只做 fast-forward，不在上面提交。
- 工作分支（当前为 `codex/desktop-performance-foundation`）：用 **merge** 吸收上游，**不要 rebase**。rc 的 tag 已经发布，改写历史会让已发布的 tag 和产物对不上。

## 3. 定期同步流程

建议每两周同步一次，每次打 rc 之前也同步一次。积攒越久，冲突越难解决。

```bash
git fetch upstream
git switch develop && git merge --ff-only upstream/develop
git switch codex/desktop-performance-foundation
git switch -c sync/upstream-$(date +%Y%m%d)

# 先看本次引入了什么，重点看下面“热点”表里的文件
git log --oneline HEAD..develop
git diff --stat HEAD...develop

git merge --no-ff develop          # 按第 4 节处理冲突
pnpm install --frozen-lockfile || pnpm install   # 锁文件冲突见 4.2
pnpm run lint && pnpm run typecheck && pnpm run test
pnpm run test:e2e                  # 在 Mac 上运行；默认引擎和 Muya 回退两条路径都要过
```

合并之后要检查的事项：

1. **IPC 白名单**：如果上游新增了 `ipcRenderer.send/invoke/on` 通道，必须把它加进 `packages/desktop/src/shared/security/ipcChannels.ts`。否则预加载层会在运行时**静默拦截**这个通道，功能会悄悄失效。检查方法：`git diff HEAD~1 -- 'packages/desktop/src/**' | grep -E "mt::[a-z-]+"`，再跑 `test/unit/specs/ipc-security.spec.ts`。
2. **偏好设置**：如果上游新增了偏好，要同时修改 `static/preference.json`、`src/main/preferences/schema.json` 和 `store/preferences.ts`。本分支新增的 `editorEngine` 要保留。
3. **Muya 修复**：桌面默认引擎已经换成 CodeMirror（见 `docs/ENGINE_DECISION.md`），但 Muya 仍是回退引擎，导出、剪贴板、图表和 slug 也还在用 `@muyajs/core`。所以上游 `packages/muya` 的修复**照收**。如果上游修复的是 Muya 编辑行为方面的 bug，要判断 `packages/wysiwyg` 是否有同类问题，有的话一起修。
4. **第三方许可证**：依赖变化后，运行 `pnpm gen-third-party`，重新生成 `packages/desktop/build/THIRD-PARTY-LICENSES.txt`。不要手动合并这个文件。

## 4. 冲突热点

下表把两组数据放在一起：上游在分叉前四个月改动每个文件的提交次数（代表上游会继续改它的频率），以及本分支对这些文件的改动量。

| 文件 | 上游提交数（4 个月） | 本分支改动 | 冲突时的处理 |
| --- | --- | --- | --- |
| `packages/muya/src/muya.ts` | 38 | 小（+6/−1） | 以上游为准，再补回本分支的一行接口改动 |
| `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue` | 36 | 中（+214，Vim 块光标和适配器） | 以上游为准，再把 Vim 相关代码段重新放回去。这个文件属于冻结的 Muya 路径，不要在这里加新功能。 |
| `package.json`（根目录） | 27 | 版本号和脚本 | 保留本分支的 `version`和 `test`/`typecheck` 中的 wysiwyg 部分，其余跟随上游 |
| `pnpm-lock.yaml` | 25 | 大 | **不要手动合并**，见 4.2 |
| `packages/desktop/src/renderer/src/store/editor.ts` | 18 | 小 | 逐段合并 |
| `packages/muya/src/editor/index.ts`、`clipboard/index.ts`、`state/markdownToState.ts`、`inlineRenderer/index.ts` | 16 / 16 / 9 / 5 | 性能补丁 | 以上游为准，再重新应用补丁。补丁本身值得提交到上游，见第 5 节。 |
| `README.md` | 13 | 整体改写为中文的分支说明 | **保留本分支版本** |
| `eslint.config.js` | 10 | 小 | 逐段合并 |
| `CLAUDE.md` | 8 | wysiwyg 和引擎说明 | 逐段合并，保留引擎部分 |
| `packages/desktop/static/locales/*.json`（10 个） | 6–7 | 新增 Vim、缩放、引擎等键 | 取两边键的并集。合并后用 2 空格缩进的 `JSON.stringify` 重新输出，并确认各语言的键集合一致。 |
| `packages/desktop/src/types/muya-core.d.ts` | 7 | 小 | 逐段合并 |
| `packages/desktop/src/main/app/index.ts`、`main/menu/index.ts`、`renderer/src/commands/index.ts` | 5–6 | 新建文档和缩放菜单 | 逐段合并，注意菜单项的顺序和快捷键冲突 |
| `packages/desktop/src/preload/index.ts`、`main/utils/secureIpc.ts`、`shared/security/*` | 低 | 大（IPC 加固） | **保留本分支的结构**，把上游新增的通道补进白名单 |
| `packages/desktop/src/renderer/src/codeMirror/index.ts` | 低 | 大（CM5 改为 CM6） | 保留本分支版本。上游对源码模式的修复要手工移植到 CM6 写法。 |

上游**没有**的路径不会产生冲突，但要留意上游的重构可能改动它们依赖的接口：`packages/wysiwyg/**`、`codemirrorEditor.vue`、`util/vim/**`、`common/editorEngine.ts`。

### 4.1 用 rerere 降低重复劳动

同一批热点几乎每次都会冲突。开启 `rerere` 后，第二次遇到相同的冲突会自动套用上次的解法。合并完成后，用 `git rerere status` 和 `git diff` 确认自动套用的结果确实合适。

### 4.2 锁文件

```bash
git checkout --theirs pnpm-lock.yaml     # 先取上游版本
pnpm install                             # 按合并后的 package.json 重新求解
git add pnpm-lock.yaml
```

然后检查本分支独有的依赖（`@replit/codemirror-vim`、`@codemirror/*`、`@marktext/wysiwyg` 的 workspace 依赖）还在不在。

## 5. 减小分叉

长期来看，最省力的办法是让上游也有这些改动：

1. **Muya 性能补丁**（分批渲染、字数统计、linkedList）与本分支的其他功能无关，可以单独向上游提 PR。上游接受后，`packages/muya` 中的冲突来源就没有了。
2. **IPC 白名单加固**属于安全改进，适合单独提 PR。
3. **Vim**、**CodeMirror 所见即所得引擎**是产品方向上的差异，短期内留在本分支。`packages/wysiwyg` 作为独立的包，不会和上游冲突。
4. 发布流程相关的文件（`README.md`、rc 版本号、`docs/` 下的分支文档）始终以本分支为准。

## 6. 只取单个修复（cherry-pick）

如果来不及做完整同步，可以先把上游的安全修复或严重 bug 修复 cherry-pick 过来：

```bash
git fetch upstream
git cherry-pick -x <upstream-sha>    # -x 会在提交信息里记录来源，以后完整合并时 git 能识别重复
```
