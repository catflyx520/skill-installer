# Skill Installer

One command, or one web page, that installs a skill or a plugin into Claude Code, Codex, Cursor and Gemini CLI at once.

**[Try the live demo](https://catflyx520.github.io/skill-installer/)**. It searches GitHub for real and only pretends to install.

- **One copy of every skill.** It lives in `~/.skill-installer/skills/<name>/` and is linked into each tool's skills folder. Update it once and every tool sees the change.
- **Plugins are installed by the tool itself.** Skill Installer calls the plugin commands of `claude` and `codex` and never touches plugin files.
- **Your files stay yours.** A folder that Skill Installer did not create is never overwritten or deleted.
- **No dependencies.** Only Node 18 or later. Installing from GitHub also needs git.

## Quick start

```bash
npx ai-skills-installer ui
```

That opens the web page. To use the `skill-installer` command everywhere, install it globally:

```bash
npm install -g ai-skills-installer
```

The npm package is called `ai-skills-installer`. The command it installs is `skill-installer`.

To work from the source instead:

```bash
git clone https://github.com/catflyx520/skill-installer.git
cd skill-installer
npm link
```

## Usage 1: the web page (recommended)

### Open it

| How you got it | What to run |
|---|---|
| npm | `npx ai-skills-installer ui`, or `skill-installer ui` once installed globally |
| Source, on Windows | double-click `skill-installer-ui.cmd` |
| Source, on macOS or Linux | `node bin/skill-installer.mjs ui` |

Your browser opens the page. If it does not, copy the address printed in the launch window into your browser. Keep that window open while you use the page; closing it stops the service.

### Install

1. Type a name in the box at the top, for example `pdf`, and click **Find**. The page searches GitHub. You can also paste a GitHub address, `owner/repo`, or the path of a local folder.
2. Click **See what is inside** on a result. The page lists the **plugins** and the **skills** of that repository in two groups.
3. Tick what you want. When a repository offers the same thing both ways, pick one. Installing both gives you duplicates.
4. Tick the connected AI tools you want it in, then click the install button.
5. Start a new session in that tool to use it.

Search results are ordered by GitHub stars. The official `anthropics/skills` repository comes first when it has a skill with that name, followed by repositories named exactly like your search. Results come from everyone's public repositories, so check the author before you install.

### View and delete

The lower half of the page has one tab per AI tool. Inside each tab a switch shows one of two lists:

- **Skills**: update (fetch again from the original source), delete, or add a skill that another tool already has. Skills that Skill Installer did not install are listed too, but they are read only.
- **Plugins**: uninstall the ones you installed. Plugins that ship with the tool or its official catalog are marked read only and are managed inside that tool.

Deleting and uninstalling both ask for a second click.

### Good to know

- **Language**: the button at the top right switches between English and Chinese. Your choice is remembered.
- **Security**: the page listens on `127.0.0.1` only and uses a new access token every time it starts, so other websites cannot drive it.
- **Network**: it goes online in two cases. A search sends the name you typed to GitHub, and an install downloads that repository from GitHub. GitHub search needs no login. Each search uses 2 requests out of the 10 per minute GitHub allows.

## Usage 2: the command line

### Commands

```bash
skill-installer agents                               # which tools were detected
skill-installer inspect anthropics/skills            # see what a source offers, install nothing
skill-installer add ./examples/pony-tails            # install from a local folder
skill-installer add anthropics/skills --skill pdf    # pick one skill from a GitHub repository
skill-installer add anthropics/skills/skills/pdf     # or point straight at a subfolder
skill-installer add anthropics/skills --all          # install every skill in the source
skill-installer add anthropics/skills -s pdf -a claude,codex   # only into the tools you name
skill-installer list                                 # where each skill is installed
skill-installer remove pdf                           # remove from every tool
skill-installer remove pdf -a codex                  # remove from Codex only
skill-installer ui                                   # open the web page
```

Running `add` again for the same skill updates it, and each tool keeps the way it was installed (link or copy). If a skill with that name was already installed from a different source, it is skipped and reported. Add `--force` to replace it.

### Options

| Option | What it does |
|---|---|
| `-a claude,codex` | The tools to target. `-a all` means every tool. The default is every detected tool |
| `-s <name>` | Pick a skill when the source has several. Can be repeated |
| `--all` | Install every skill in the source |
| `--copy` | Copy the files instead of linking |
| `--force` | Replace a folder Skill Installer did not create, or a skill of the same name from another source |
| `--no-open` | With `ui`: print the address and do not open a browser |

### Ways to write a source

| Form | Example |
|---|---|
| Local folder | `./examples/pony-tails` |
| GitHub repository | `anthropics/skills` |
| Subfolder of a repository | `anthropics/skills/skills/pdf` |
| GitHub page address | `https://github.com/anthropics/skills/tree/main/skills/pdf` |
| git address | `https://github.com/anthropics/skills.git` |

A source that starts with `.`, `~`, `/` or a drive letter is always treated as a local folder and is never looked up on GitHub.

The command line handles skills only. Install and uninstall plugins in the web page, or with each tool's own commands (next section).

## Skills and plugins

A skill is a folder with a `SKILL.md`. Skill Installer manages it: one stored copy, linked into each tool. A plugin is a tool's own package. Besides skills it can bring commands and hooks, and it has a version. Skill Installer **never stores or changes plugin files**. Listing, installing and uninstalling all go through the tool's own commands:

| Tool | List | Install | Uninstall |
|---|---|---|---|
| Claude Code | `claude plugin list --json` | `claude plugin install <name> --marketplace <owner/repo> --json` | `claude plugin uninstall <id> --json` |
| Codex | `codex plugin list --json` | `codex plugin marketplace add <owner/repo>`, then `codex plugin add <name>@<marketplace> --json` | `codex plugin remove <id> --json` |

So plugin features need the `claude` or `codex` command on your PATH. Plugins can only be installed from the root of a GitHub repository. Plugins that come with Codex (marketplaces starting with `openai-`) are shown but cannot be uninstalled from the page. Plugins for Gemini CLI and Cursor are not supported yet.

## Where things are installed

| Tool | Detected by | Skills folder |
|---|---|---|
| Claude Code | `~/.claude` | `~/.claude/skills/` |
| Codex | `~/.codex` | `~/.agents/skills/` |
| Cursor | `~/.cursor` | `~/.cursor/skills/` |
| Gemini CLI | `~/.gemini` | `~/.gemini/skills/` |

To support another tool, add one entry to `src/agents.mjs`.

## Safety rules

- A skill folder you added yourself is never overwritten, unless you pass `--force` or click **Overwrite it** in the page.
- Removing only deletes the links and copies Skill Installer created.
- On Windows it uses junctions, which need no administrator rights. If a link cannot be made, the files are copied.
- Skills and plugins are instructions your AI will follow, and they can include scripts. Install only from authors you trust.

## Let your agent do it

`skills/skill-installer` is a skill. Once installed, tell your agent "install X for me" and it runs this command line tool (the `skill-installer` command must be available):

```bash
skill-installer add catflyx520/skill-installer --skill skill-installer
```

## Live demo

The demo is at https://catflyx520.github.io/skill-installer/ and is redeployed whenever `ui/` changes on `main`.

Hosted as static files, the `ui/` folder turns into a demo page with an introduction. The GitHub search and the repository contents are real. Installing and deleting happen only in the browser's memory and change no files. A public web page may not write files on your computer, so the version that really installs has to run locally.

## Development

```bash
npm test
```

The tests use temporary folders and never touch your real configuration.

```
bin/skill-installer.mjs   command line entry and argument parsing
src/agents.mjs            tool registry (paths, detection)
src/hub.mjs               central store, fetching sources, linking
src/commands.mjs          add / list / remove / agents / inspect
src/plugins.mjs           plugins: calls the plugin commands of claude and codex
src/ui.mjs                local service behind the web page
ui/                       the web page and the demo (one copy). i18n.js holds the texts, search.js ranks search results
skills/                   the skill-installer skill
test/                     end to end tests
```

## Known limits

- Installs are per user. There is no per project install.
- The web page and the plugin features were only tried on Windows.
- GitHub page addresses cannot have a `/` in the branch name.
- With `--copy`, a copy is not refreshed when its source changes. Run `add` again. To turn a copy back into a link, `remove` it and `add` it again.
- zip sources are not supported.

## License

MIT, see [LICENSE](LICENSE). The fonts in `ui/fonts` have their own license, see [ui/fonts/LICENSE.txt](ui/fonts/LICENSE.txt).
