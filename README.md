# Skill Installer

[![npm](https://img.shields.io/npm/v/ai-skills-installer)](https://www.npmjs.com/package/ai-skills-installer)
[![Tests](https://github.com/catflyx520/skill-installer/actions/workflows/test.yml/badge.svg)](https://github.com/catflyx520/skill-installer/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

One command, or one web page, that installs a skill or a plugin into Claude Code, Codex, Cursor and Gemini CLI at once.

**[Open the site](https://catfly.dev/skill-installer/)** · [Full guide](docs/USAGE.md)

- **One copy of every skill.** It is stored once and linked into each tool. Update it once and every tool sees the change.
- **Your files stay yours.** A folder that Skill Installer did not create is never overwritten or deleted.
- **No dependencies.** Only Node 18 or later. Installing from GitHub also needs git.

## Quick start

```bash
npx ai-skills-installer ui
```

That opens the site in your browser, connected to your computer. Search for a skill, tick the tools you want it in, and install. Without the command the site is a preview: the search is real, and installing changes nothing.

## Command line

```bash
npm install -g ai-skills-installer

skill-installer agents                               # which tools were detected
skill-installer add anthropics/skills --skill pdf    # install one skill into every detected tool
skill-installer add anthropics/skills -s pdf -a claude,codex   # only into the tools you name
skill-installer list                                 # where each skill is installed
skill-installer remove pdf                           # remove from every tool
```

## Supported tools

| Tool | Skills | Plugins |
|---|---|---|
| Claude Code | ✓ | ✓ |
| Codex | ✓ | ✓ |
| Cursor | ✓ | not yet |
| Gemini CLI | ✓ | not yet |

Plugins are installed from the web page. Skill Installer calls the plugin commands of `claude` and `codex` and never touches plugin files.

## Development

```bash
npm test
```

35 end to end tests. They use temporary folders and never touch your real configuration. GitHub Actions runs them on every push and pull request with Node 18, 20 and 22.

## License

MIT, see [LICENSE](LICENSE). The fonts in `ui/fonts` have their own license, see [ui/fonts/LICENSE.txt](ui/fonts/LICENSE.txt).
