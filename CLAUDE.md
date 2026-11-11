# skill-installer — 交接说明

一个零依赖的 Node CLI：一条命令把一个 agent skill 同时装进 Claude Code、Codex、Cursor、Gemini CLI。
用户在 Windows 上用 PowerShell，用中文交流。用法见 README.md。

产品名是 Skill Installer，命令是 `skill-installer`，npm 包名是 `ai-skills-installer`。以前叫 skillhub，代码里“hub”指的仍然是存放 skill 的中央仓库（`~/.skill-installer`）。

## 当前状态（2026-11-10）

命令：`add` / `list` / `remove` / `agents` / `inspect` / `ui`。用户主要在页面里操作，不常用 CLI。页面除了 skill 还能装、看、卸载插件（Claude Code 和 Codex），命令行没有对应的插件命令。

- 已验证：Windows（Node 24）上 `npm test` 全过；junction 的创建、识别、删除实测正常；页面的按名字搜索 GitHub、粘贴地址、选择 AI 安装、按 AI 查看、添加、删除、覆盖在浏览器里实测正常。
- **npm 包名是 `ai-skills-installer`**（`skill-installer` 已被一个同类工具占用）。产品名和命令名仍是 `skill-installer`。`package.json` 的 `bin` 要保持只有一项，`npx ai-skills-installer` 靠这个找到命令。还没有发布。

注意：真实运行会写入用户的 `~/.skill-installer` 和各工具的 skills 目录。手动测试时设 `SKILL_INSTALLER_USER_HOME` 指向临时目录；`npm test` 自己用临时目录。

还没有 `git init`。

## 设计决定（改之前先了解原因）

- **中央仓库 + 链接**：每个 skill 只在 `~/.skill-installer/skills/<name>/` 存一份，各工具目录里是指向它的链接。Windows 用 junction（不需要管理员权限），其他系统用符号链接，失败则回退为复制。
- **清单文件** `~/.skill-installer/manifest.json`：记录每个 skill 的来源，以及在每个工具里是 `link` 还是 `copy`。
- **不碰别人的东西**：目标位置已有不是 skill-installer 创建的文件夹或链接时跳过并报告，退出码 1，除非 `--force`。`remove` 只删指向 hub 的链接，或清单里记为 `copy` 的文件夹。这条规则有测试覆盖，不要削弱。
- **Codex 装到 `~/.agents/skills/`**，不是 `~/.codex/skills/`。OpenAI 官方文档只列前者；检测 Codex 是否安装仍然看 `~/.codex`（或 `CODEX_HOME`）。
- **默认目标 = 检测到的工具**（对应的配置目录存在）。`-a all` 强制全部。
- **来源有多个 skill 时不猜**：列出来，要求 `--skill` 或 `--all`。无交互式提示。
- **再次 `add` = 更新**，目前没有单独的 `update` 命令。更新时每个工具保持原来的方式：原来是副本的还是副本，不会悄悄变成链接。
- **同名但来源不同不算更新**：会跳过并报 `skipped`，加 `--force` 才替换。来源是否相同用 `sourceKey()` 判断，同一个 GitHub 仓库不管写成简写、网址还是带子目录，都算同一个来源。页面的“覆盖已有内容”按钮靠输出里的 `skipped` 这个词触发，改措辞前注意。
- **复制进 hub 是先复制后替换**（`copyIntoHub`）：来源可能是某个工具文件夹里指向 hub 的链接，先删再复制会把来源自己删掉。这是出过的真实问题，有测试。
- **写得像路径的来源只当本地文件夹**：以 `.`、`~`、盘符、`/` 开头或带反斜杠的，找不到就报“Folder not found”，不会去 GitHub 找。`owner/repo` 和打错字的相对路径分不开，所以克隆前会打印实际访问的地址。
- **链接是否正常要看 hub 副本在不在**（`status()`）：副本没了，链接标为 `BROKEN`。页面的“修复”按原始来源重装，不依赖 hub。
- **零依赖**：只用 Node 内置模块，参数解析手写。除非有充分理由，不要引入依赖。
- **CLI 输出用英文**（避免 PowerShell 中文乱码）。**README 是英文**，因为它会显示在 GitHub 和 npm 的页面上；这份 CLAUDE.md 用中文。
- **页面有中英文两套文案**，全部在 `ui/i18n.js` 里，页面右上角切换，选择存在 `localStorage`。`index.html` 里不写任何可见文字，只写 `data-i18n="键"`；`app.js` 里一律用 `t('键')`。加文案时两种语言都要加。服务端和 CLI 返回的英文错误原样显示，不翻译。
- **页面的所有写操作都 spawn 真实 CLI**（`src/ui.mjs`），不要在服务里重新实现安装逻辑，否则安全规则会被绕开；这样 git 也不会阻塞服务。写操作串行排队，因为都要改清单。
- **页面的安全边界**：只监听 `127.0.0.1`，页面和 API 都要启动时生成的令牌；传给 CLI 的参数不能以 `-` 开头。skill 的内容不可信，`ui/app.js` 只用文本节点渲染，不要改成 `innerHTML`。
- **GitHub 搜索在浏览器里做**（`ui/app.js` 的 `searchGitHub`），两种模式共用一份代码，所以 CSP 只放行 `https://api.github.com`。不登录的限制是搜索每分钟 10 次、其他接口每小时 60 次。每次搜索发两个请求：“名字 + skill”和“名字 in:name”，都按星标排序，后者只保留仓库名完全一致的。**不要改回默认的最佳匹配排序**：实测搜 `ponytail` 时它把一个 64 星的仿冒仓库排在 18 万星的原版前面，而原版的简介里没有 skill 这个词，只靠第一个请求根本搜不到。另外单独检查官方仓库 `anthropics/skills` 里有没有同名 skill。代码搜索接口必须登录，所以没用。
- **页面按 AI 分页，每页再分 Skill 和插件**：用户要的是“每个 AI 里有什么”，不是“每个 skill 装在哪”。不是 skill-installer 安装的 skill 由 `src/ui.mjs` 的 `unmanaged()` 列出，只显示，页面上没有任何能改动它们的操作。
- **插件完全交给工具自己的命令**（`src/plugins.mjs`）：skill-installer 不读写插件文件，只调用 `claude plugin ...` 和 `codex plugin ...`。直接动插件缓存会让工具认为插件损坏，或者在下次更新时装回来。命令和输出格式都在 Claude Code、Codex 上实测过（用 `CLAUDE_CONFIG_DIR` / `CODEX_HOME` 指向临时目录，Codex 的临时目录路径要短，否则 git clone 会因为路径太长失败）。
- **插件命令经过 shell 执行**，因为 Windows 上 `codex` 是 `.cmd`，不经过 shell 起不来。所以传进去的每个参数都必须是纯字符（`run()` 里有最后一道检查），插件来源只接受 GitHub 的 `owner/repo`。放宽这些校验之前先想清楚注入风险。
- **仓库提供哪些插件**由 `pluginsIn()` 读两个清单文件得出：`.claude-plugin/marketplace.json`（Claude Code）和 `.agents/plugins/marketplace.json`（Codex）。一个插件有哪个清单，就能装进哪个工具。
- **Claude Code 安装插件不带 `-y`**：需要执行“市场声明的命令”的插件会被它拒绝并报错，这是有意保留的保护。
- **`discoverSkills()` 按名字去重**，隐藏文件夹排在后面。有的仓库会在 `.openclaw/skills` 之类的目录里再放一份同样的 skill。
- **从最后一个工具删除 = 彻底移除**：这条逻辑在 `commands.remove` 里，命令行和页面走同一条路，hub 里不会留下没人用的副本。
- **搜索排序在 `ui/search.js`**，不调用任何浏览器接口，`test/search.test.mjs` 把它当文本读进来测。改排序规则要同时改测试。
- **名字规则只有一份**：`hub.mjs` 的 `SAFE_NAME`，skill、插件、市场的名字都用它。
- **一份页面两用**：`ui/index.html` 默认是演示模式；`skill-installer ui` 提供时替换 `data-mode` 和令牌，变成真实模式，介绍内容隐藏。
- **字体和图标都放在本地**（Geist、Phosphor），页面不依赖外部网络。

## 代码结构

```
bin/skill-installer.mjs    入口、参数解析、命令分发
src/agents.mjs      工具注册表：label、detect()、skillsDir()。加新工具只改这里
src/hub.mjs         清单读写、SKILL.md 解析、来源获取（本地/GitHub/git URL）、链接与删除
src/commands.mjs    add / list / remove / agents / inspect 的实现
src/plugins.mjs     插件：读清单、调用 claude / codex 的插件命令
src/ui.mjs          skill-installer ui 的本地服务和 API
ui/                 页面（index.html、style.css、app.js、fonts/）
skills/skill-installer/  让 agent 调用本 CLI 的 skill
skill-installer-ui.cmd     Windows 双击启动
test/skill-installer.test.mjs   端到端测试，spawn 真实 CLI
test/ui.test.mjs         页面 API 的端到端测试
examples/pony-tails/     测试用的占位 skill
examples/fake-tool.mjs   测试里顶替 claude / codex 命令的假工具（不能放在 test/ 下，否则会被当成测试执行）
```

测试用的环境变量：`SKILL_INSTALLER_USER_HOME`（假的用户主目录）、`SKILL_INSTALLER_HOME`（hub 位置，默认 `~/.skill-installer`）、`SKILL_INSTALLER_CLAUDE_BIN` / `SKILL_INSTALLER_CODEX_BIN`（顶替插件命令）。

**注意：`SKILL_INSTALLER_USER_HOME` 管不到插件。** 插件操作调用的是真实的 `claude` / `codex`，会改用户的真实配置。手动测试插件时必须同时设 `SKILL_INSTALLER_*_BIN`，或者设 `CLAUDE_CONFIG_DIR` 和 `CODEX_HOME` 指向临时目录。

## 已知限制

- frontmatter 是手写的简易解析，只取 `name` 和 `description`（支持 `>` / `|` 块标量），不是完整 YAML。
- GitHub tree URL 里的分支名不能含 `/`。
- `--copy` 模式下，更新 hub 后副本不会自动刷新，要重新 `add`。
- 只支持全局（用户级）安装，没有项目级。
- 不支持 zip 来源。

## 下一步（按建议顺序）

1. 发布到 npm：包已经准备好，但 npm 要求发布者账号开启两步验证，要用户自己开启并运行 `npm publish`。发布后删掉 README “Quick start” 下面那句 “Not on npm yet”。
2. 演示页放到 GitHub Pages。代码在 GitHub 的 `skill-installer` 仓库。这个仓库的提交邮箱用的是 GitHub 的 noreply 地址（只设在本仓库的 git 配置里），不要改回去。
2. `doctor`：检查断链、缺失的 SKILL.md、清单与磁盘不一致（页面里已能看到“已损坏”）。
3. `sync`：导出/导入清单，换电脑一键还原。
4. 项目级安装（`.claude/skills/`、`.agents/skills/` 等）。
5. 命令行的 `update [name]`（页面已有更新按钮）。

新功能请配端到端测试，沿用 `test/skill-installer.test.mjs` 的写法。
