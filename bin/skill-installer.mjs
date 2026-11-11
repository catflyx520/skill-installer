#!/usr/bin/env node
import { add, list, remove, agents, inspect } from '../src/commands.mjs';
import { startUi } from '../src/ui.mjs';

const HELP = `skill-installer - install one skill into Claude Code, Codex, Cursor and Gemini CLI

Usage:
  skill-installer add <source>      Install a skill (source: local folder, owner/repo, or git URL)
  skill-installer list              Show installed skills and where they are installed
  skill-installer remove <name>     Remove a skill everywhere (or only from -a agents)
  skill-installer agents            Show supported agents and whether they are detected
  skill-installer inspect <source>  Print the skills in a source as JSON, without installing
  skill-installer ui                Open the local web page to manage skills

Options:
  -a, --agent <ids>   Agents to target: claude, codex, cursor, gemini, all
                      (comma-separated or repeated; default: every detected agent)
  -s, --skill <name>  Pick a skill when the source contains several (repeatable)
      --all           Install every skill found in the source
      --copy          Copy files instead of linking
      --force         Replace an existing folder/link that skill-installer did not create
      --no-open       With ui: print the address instead of opening a browser
  -h, --help          Show this help
`;

function parse(argv) {
  const opts = { agents: [], skills: [], all: false, copy: false, force: false, help: false, open: true };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '-a' || a === '--agent') opts.agents.push(value());
    else if (a === '-s' || a === '--skill') opts.skills.push(value());
    else if (a === '--all') opts.all = true;
    else if (a === '--copy') opts.copy = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--no-open') opts.open = false;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else positional.push(a);
  }
  return { opts, positional };
}

function main() {
  const { opts, positional } = parse(process.argv.slice(2));
  const [cmd, arg] = positional;
  if (opts.help || !cmd) { console.log(HELP); return cmd || opts.help ? 0 : 1; }
  switch (cmd) {
    case 'add':
      if (!arg) throw new Error('Usage: skill-installer add <folder | owner/repo | git URL>');
      return add(arg, opts);
    case 'list': case 'ls':
      return list();
    case 'remove': case 'rm':
      if (!arg) throw new Error('Usage: skill-installer remove <name>');
      return remove(arg, opts);
    case 'agents':
      return agents();
    case 'inspect':
      if (!arg) throw new Error('Usage: skill-installer inspect <folder | owner/repo | git URL>');
      return inspect(arg);
    case 'ui':
      return startUi(opts);
    default:
      throw new Error(`Unknown command: ${cmd}. Run "skill-installer --help"`);
  }
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
}
