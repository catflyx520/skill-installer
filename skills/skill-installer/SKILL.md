---
name: skill-installer
description: Install, update, list or remove agent skills across Claude Code, Codex, Cursor and Gemini CLI using the skill-installer CLI. Use when the user asks to install a skill, add a skill from GitHub or a folder, see which skills are installed, or remove a skill.
---

# Skill installer

Manage skills with the `skill-installer` CLI. Do not copy skill folders by hand: skill-installer keeps one copy per skill, links it into each tool and records where it went.

Run `skill-installer --help` first. If the command is missing, tell the user skill-installer is not installed and stop.

## Install

1. Work out the source: a local folder, `owner/repo`, `owner/repo/path/to/skill`, or a git URL.
2. See what it contains:

   ```
   skill-installer inspect <source>
   ```

3. If it lists several skills and the user did not name one, show the names and descriptions and ask which they want.
4. Skills are instructions an agent will follow, and they can include scripts. If the source is not one the user clearly trusts, say so and let them confirm before installing.
5. Install:

   ```
   skill-installer add <source> --skill <name>
   ```

   Add `-a claude,codex` only if the user named specific tools. By default it installs into every detected tool.
6. Tell the user which tools it went into, and that a new session is needed before the skill loads.

## Other tasks

- See what is installed: `skill-installer list`
- See which tools are detected: `skill-installer agents`
- Update: run the same `skill-installer add` again
- Remove everywhere: `skill-installer remove <name>`
- Remove from one tool: `skill-installer remove <name> -a codex`
- Manage everything in a web page: `skill-installer ui`

## Rules

- If `add` reports `skipped`, a folder or link that skill-installer did not create is already there. Report the path and stop. Use `--force` only after the user has explicitly agreed to replace that specific item.
- Exit code 1 from `add` without a `skipped` line usually means the source has several skills or could not be read. Read the output before retrying.
