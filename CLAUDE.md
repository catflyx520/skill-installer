# skill-installer — 交接说明

一个零依赖的 Node CLI：一条命令把一个 agent skill 同时装进 Claude Code、Codex、Cursor、Gemini CLI。
用户在 Windows 上用 PowerShell，用中文交流。用法见 README.md。

产品名是 Skill Installer，命令是 `skill-installer`，npm 包名是 `ai-skills-installer`。以前叫 skillhub，代码里“hub”指的仍然是存放 skill 的中央仓库（`~/.skill-installer`）。

## 当前状态（2026-11-19）

命令：`add` / `list` / `remove` / `agents` / `inspect` / `ui`。用户主要在页面里操作，不常用 CLI。`ui` 默认打开托管网站并让它连上本机的服务，本地页面是后备。页面除了 skill 还能装、看、卸载插件（Claude Code 和 Codex），命令行没有对应的插件命令。

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
- **托管网站直连本地服务**：别人打开托管网站，运行 `npx ai-skills-installer ui`，命令打开 `<网站>#connect=<端口>.<令牌>`，页面读到后把请求发到 `http://127.0.0.1:<端口>`。令牌放在 `#` 后面，所以不会发给网站的服务器。页面把它存进 `sessionStorage`（刷新后还连着）并从地址栏去掉。连不上时（浏览器拦截，或终端已关）提示里有“打开本地页面”的按钮。要打开的网站是 `src/ui.mjs` 的 `SITE`，从 0.2.1 起默认 `https://catfly.dev/skill-installer/`（用户自己的域名，是用户的决定）。catfly.dev 是固定版本：改了页面之后，要去 Portfolio 仓库（`D:Docsprojects portfolioportfolio`）把 `.github/workflows/publish-site.yml` 里固定的提交号改成新的并推送，那里的页面才会变；那边的发布流程有 `npm audit` 检查，依赖有新漏洞时要先升级才能发布。GitHub Pages 那份仍然自动更新，也仍在允许的来源里。catfly.dev 上的其他应用和它同一个来源，同一个标签页里能读到 `sessionStorage` 里的连接信息；要隔离就给它单独的子域名。
- **只有托管网站和本地页面能调用 API**（`src/ui.mjs` 的 `SITES`）：带 `Origin` 且不在列表里的请求直接 403，哪怕令牌是对的。预检请求（`OPTIONS`）带不了令牌，所以在令牌检查之前回答，但只回答列表里的来源。这条有测试，不要放宽成 `*`。
- **托管页面和 CLI 的版本会不一致**：页面一推送就更新，用户的 `npx` 可能还是旧版。改 API 时要让新页面仍能用旧服务。发布顺序是先推页面，再更新 Portfolio 里固定的提交号让 catfly.dev 发布，最后发 npm，否则新 CLI 会打开一个还没有新功能的旧页面。
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
- **一份页面三种用法**：`ui/index.html` 默认是演示模式；地址里带 `#connect` 时由 `app.js` 切成真实模式；本地服务自己提供页面时替换 `data-mode` 和令牌，也是真实模式。真实模式下介绍内容隐藏。
- **页面文案不再叫“演示”**（用户的决定，因为连接后就是能直接用的版本）：没连接的状态叫“未连接”或“预览”，这时成功提示后面会加一句“这只是预览，没有改动你的电脑”（`previewOnly`），不要去掉，否则访客会以为真的装上了。内部名字没有改：`data-mode="demo"`、`demo-only`、`createDemoBackend` 都还在，CSS、本地服务和 Portfolio 的打包脚本依赖它们。“怎么用”那一节连接后也显示，所以它没有 `marketing` 这个 class。
- **`index.html` 里不要写指向外站的 `href`**：Portfolio 的线上验证脚本（`scripts/verify-skill-installer.mjs`）会读 HTML 里所有的 `src` 和 `href`，不在本站的就算失败。指向 GitHub 仓库的链接写成 `data-repo="<可选的 # 锚点>"`，地址由 `app.js` 里的 `REPO` 常量在启动时填上。
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

测试用的环境变量：`SKILL_INSTALLER_USER_HOME`（假的用户主目录）、`SKILL_INSTALLER_HOME`（hub 位置，默认 `~/.skill-installer`）、`SKILL_INSTALLER_CLAUDE_BIN` / `SKILL_INSTALLER_CODEX_BIN`（顶替插件命令）、`SKILL_INSTALLER_SITE`（`ui` 要打开的网站，它的来源也会被允许调用 API；手动测试时指向本地起的一份 `ui/`）。

**注意：`SKILL_INSTALLER_USER_HOME` 管不到插件。** 插件操作调用的是真实的 `claude` / `codex`，会改用户的真实配置。手动测试插件时必须同时设 `SKILL_INSTALLER_*_BIN`，或者设 `CLAUDE_CONFIG_DIR` 和 `CODEX_HOME` 指向临时目录。

## 已知限制

- frontmatter 是手写的简易解析，只取 `name` 和 `description`（支持 `>` / `|` 块标量），不是完整 YAML。
- GitHub tree URL 里的分支名不能含 `/`。
- `--copy` 模式下，更新 hub 后副本不会自动刷新，要重新 `add`。
- 只支持全局（用户级）安装，没有项目级。
- 不支持 zip 来源。

## 下一步（按建议顺序）

1. 已发布到 npm：`ai-skills-installer@0.2.1`（2026-11-24，默认打开 catfly.dev）。用发布的包实测过：命令打印的是 catfly.dev 的连接地址，Chrome 157 里打开后能连上本机。catfly.dev 上的页面固定在 Portfolio 的 `6dbe056`。`0.2.0` 是同一天早些时候发的，功能相同，默认打开 GitHub Pages。用发布的包实测过：`npx ai-skills-installer@latest ui` 启动后，线上网站在 Chrome 157 和 Edge 157 里能连上本机（无界面模式，用调试接口授予本地网络权限）。没测到的：Chrome 的权限弹窗本身、Safari、Firefox。Claude 桌面应用的内置浏览器会拦住这种连接，页面会显示“打开本地页面”的后备按钮。发布后 npm 要过几分钟才显示新版本（这次约 6 分钟）。再发新版本要先改 `package.json` 的 `version`，然后由用户自己运行 `npm publish`（账号开了两步验证，要输验证码）。新包第一次发布后 npm 会先放一个 `0.0.0-stage` 占位版本，几分钟后才换成真正的版本，这是正常流程。
2. 演示页在 https://catflyx520.github.io/skill-installer/ ，由 `.github/workflows/pages.yml` 在 `ui/` 有改动并推到 `main` 时自动重新部署。代码在 GitHub 的 `skill-installer` 仓库。这个仓库的提交邮箱用的是 GitHub 的 noreply 地址（只设在本仓库的 git 配置里），不要改回去。
2. `doctor`：检查断链、缺失的 SKILL.md、清单与磁盘不一致（页面里已能看到“已损坏”）。
3. `sync`：导出/导入清单，换电脑一键还原。
4. 项目级安装（`.claude/skills/`、`.agents/skills/` 等）。
5. 命令行的 `update [name]`（页面已有更新按钮）。

新功能请配端到端测试，沿用 `test/skill-installer.test.mjs` 的写法。
