# Skill Installer

一条命令，或者一个网页，把一个 skill 或插件同时装进 Claude Code、Codex、Cursor、Gemini CLI。

- **skill 只存一份**：放在 `~/.skill-installer/skills/<名字>/`，再链接到各工具的 skills 目录。更新一处，所有工具同时生效。
- **插件交给工具自己装**：调用 `claude` 和 `codex` 自己的插件命令，不碰插件文件。
- **不动你的东西**：不是 Skill Installer 创建的文件夹不会被覆盖，也不会被删除。
- **零依赖**：只需要 Node 18+。从 GitHub 安装时还需要 git。

## 开始

```powershell
git clone https://github.com/catflyx520/skill-installer.git
cd skill-installer
```

还没有发布到 npm。发布后可以不下载代码，直接运行 `npx ai-skills-installer ui`。

## 用法一：网页（推荐）

### 打开

| 系统 | 做法 |
|---|---|
| Windows | 双击 `skill-installer-ui.cmd` |
| macOS / Linux | `node bin/skill-installer.mjs ui` |

浏览器会自动打开页面。如果没有打开，把启动窗口里打印的地址复制到浏览器。用的时候保持启动窗口开着，关掉它服务就停了。

### 安装

1. 在顶部输入框里输入名字（比如 `pdf`），点“查找”，页面会去 GitHub 搜索。也可以直接粘贴 GitHub 地址、`owner/repo` 或本地文件夹路径。
2. 在搜索结果里点“查看里面的内容”。页面把这个仓库里的**插件**和 **skill** 分两组列出来。
3. 勾选要装的。同一个仓库两种都有时选一种就行，两种都装会重复。
4. 勾选要装进哪几个已连接的 AI，点“安装”。
5. 到那个 AI 里新开一个会话，就能用了。

搜索结果按 GitHub 星标数排序，官方仓库 `anthropics/skills` 里有同名 skill 时排第一，其次是名字完全一致的仓库。结果来自所有人公开的仓库，安装前请确认作者可信。

### 查看和删除

页面下半部分每个 AI 一个标签页，里面用开关切换两个列表：

- **Skill**：可以更新（按原来源重新拉取）、删除、把别的 AI 里已有的 skill 加进来。不是 Skill Installer 安装的 skill 也会列出来，但只显示，不能改动。
- **插件**：你自己装的可以卸载。工具自带或官方目录里的标着“只读”，要到工具里管理。

删除和卸载都要点两次确认。

### 其他

- **中英文切换**：右上角的按钮。选择会记住。
- **安全**：页面只监听 `127.0.0.1`，每次启动生成新的访问令牌，其他网站操作不了它。
- **联网**：只有两种情况。搜索时把你输入的名字发给 GitHub，安装时从 GitHub 下载那个仓库。GitHub 搜索不用登录，每次搜索用 2 次额度，限制是每分钟 10 次。

## 用法二：命令行

先让 `skill-installer` 命令在任何地方都能用：

```powershell
npm link
```

不想全局安装的话，下面所有命令里的 `skill-installer` 都可以换成 `node bin/skill-installer.mjs`。

### 命令

```powershell
skill-installer agents                               # 看看检测到了哪些工具
skill-installer inspect anthropics/skills            # 只看来源里有什么，不安装
skill-installer add .\examples\pony-tails            # 从本地文件夹安装
skill-installer add anthropics/skills --skill pdf    # 从 GitHub 仓库里挑一个
skill-installer add anthropics/skills/skills/pdf     # 或者直接指到子目录
skill-installer add anthropics/skills --all          # 装仓库里的全部 skill
skill-installer add anthropics/skills -s pdf -a claude,codex   # 只装进指定的工具
skill-installer list                                 # 每个 skill 装在了哪里
skill-installer remove pdf                           # 从所有工具卸载
skill-installer remove pdf -a codex                  # 只从 Codex 卸载
skill-installer ui                                   # 打开网页
```

再次 `add` 同一个 skill 就是更新。

### 选项

| 选项 | 作用 |
|---|---|
| `-a claude,codex` | 指定工具，`-a all` 表示全部。默认装到所有检测到的工具 |
| `-s <名字>` | 仓库里有多个 skill 时挑一个，可以重复写 |
| `--all` | 安装来源里的全部 skill |
| `--copy` | 复制文件而不是链接 |
| `--force` | 覆盖不是 Skill Installer 创建的同名文件夹 |
| `--no-open` | 和 `ui` 一起用：只打印地址，不打开浏览器 |

### 来源可以怎么写

| 写法 | 例子 |
|---|---|
| 本地文件夹 | `.\examples\pony-tails` |
| GitHub 仓库 | `anthropics/skills` |
| 仓库里的子目录 | `anthropics/skills/skills/pdf` |
| GitHub 页面地址 | `https://github.com/anthropics/skills/tree/main/skills/pdf` |
| git 地址 | `https://github.com/anthropics/skills.git` |

命令行只管 skill。插件的安装和卸载在网页里做，或者直接用工具自己的命令（见下一节）。

## skill 和插件的区别

skill 是一个带 `SKILL.md` 的文件夹，Skill Installer 自己管：存一份，再链接到各个工具。插件是工具自己的安装包，除了 skill 还可能带命令和钩子，有版本号。Skill Installer **不存放也不改动插件文件**，安装、列出、卸载都是调用那个工具自己的命令：

| 工具 | 列出 | 安装 | 卸载 |
|---|---|---|---|
| Claude Code | `claude plugin list --json` | `claude plugin install <名字> --marketplace <owner/repo> --json` | `claude plugin uninstall <id> --json` |
| Codex | `codex plugin list --json` | `codex plugin marketplace add <owner/repo>`，再 `codex plugin add <名字>@<市场> --json` | `codex plugin remove <id> --json` |

所以插件功能需要 `claude` 或 `codex` 命令在 PATH 里。插件只能从 GitHub 仓库的根目录安装。Codex 自带的插件（`openai-` 开头的市场）只显示，不能从页面卸载。Gemini CLI 和 Cursor 的插件目前没有接。

## 安装位置

| 工具 | 检测依据 | skills 目录 |
|---|---|---|
| Claude Code | `~/.claude` | `~/.claude/skills/` |
| Codex | `~/.codex` | `~/.agents/skills/` |
| Cursor | `~/.cursor` | `~/.cursor/skills/` |
| Gemini CLI | `~/.gemini` | `~/.gemini/skills/` |

要支持新工具，在 `src/agents.mjs` 里加一项即可。

## 安全规则

- 不会覆盖你手动放进去的同名 skill 文件夹，除非加 `--force` 或在页面里点“覆盖已有内容”。
- 卸载只删除 Skill Installer 自己创建的链接和副本。
- Windows 上用 junction 链接，不需要管理员权限。链接失败时自动改为复制。
- skill 和插件都是交给 AI 执行的指令，可能带脚本。只安装你信得过的作者的内容。

## 让 agent 帮你装

`skills/skill-installer` 是一个 skill。装好后在 agent 里说“帮我装 X”，它会调用本工具的命令行（需要先 `npm link`）：

```powershell
skill-installer add .\skills\skill-installer
```

## 在线演示

`ui/` 文件夹直接放到静态托管（比如 GitHub Pages）时，会自动变成带介绍内容的演示页：GitHub 搜索和仓库内容是真的，安装和删除只发生在浏览器内存里，不会改动任何文件。公开网页没有权限写入电脑上的文件，所以真正能用的版本只能在本机打开。

## 开发

```powershell
npm test
```

测试用临时目录，不会动你的真实配置。

```
bin/skill-installer.mjs   命令行入口和参数解析
src/agents.mjs            工具注册表（路径、检测）
src/hub.mjs               中央仓库、来源获取、链接逻辑
src/commands.mjs          add / list / remove / agents / inspect
src/plugins.mjs           插件：调用 claude / codex 自己的插件命令
src/ui.mjs                网页的本地服务
ui/                       网页和演示页（同一份），i18n.js 是中英文文案
skills/                   skill-installer
test/                     端到端测试
```

## 已知限制

- 只支持用户级安装，没有项目级。
- 网页和插件功能只在 Windows 上实测过。
- 命令行的输出是英文。
- GitHub 页面地址里的分支名不能含 `/`。
- `--copy` 模式下，更新后副本不会自动刷新，要重新 `add`。
- 不支持 zip 来源。

## 许可

MIT
