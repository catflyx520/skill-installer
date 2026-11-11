// Plugins belong to each tool's own plugin system. skill-installer only asks that
// tool's CLI to list, install or remove them and never writes plugin files itself.
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { AGENTS } from './agents.mjs';

const NAME = /^[A-Za-z0-9][\w.-]*$/;                    // plugin and marketplace names
const REPO = /^[A-Za-z0-9_][\w.-]*\/[A-Za-z0-9_][\w.-]*$/; // GitHub owner/repo
export const isName = (s) => typeof s === 'string' && NAME.test(s);
export const isRepo = (s) => typeof s === 'string' && REPO.test(s);
export const isPluginId = (s) => typeof s === 'string' && s.split('@').length <= 2 && s.split('@').every(isName);

// Runs a tool's CLI. It goes through a shell because on Windows `codex` is a .cmd
// shim, so every argument must be a plain token. Callers validate what users send;
// this is the last check. SKILL_INSTALLER_<TOOL>_BIN lets tests swap in a fake tool.
function run(tool, args) {
  for (const a of args) if (!/^[\w.@/-]+$/.test(a)) throw new Error(`Unsafe argument: ${a}`);
  const bin = process.env[`SKILL_INSTALLER_${tool.toUpperCase()}_BIN`] || tool;
  return new Promise((resolve) => {
    const child = exec(`${bin} ${args.join(' ')}`, {
      timeout: 5 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr });
    });
    child.stdin?.end(); // never wait for input
  });
}

// The most useful line of a failed run: the tool's own JSON message, else its last error line.
function detail(r) {
  try {
    const message = JSON.parse(r.stdout.trim().split('\n').pop()).message;
    if (typeof message === 'string') return message.split('\n')[0];
  } catch { /* not JSON */ }
  const lines = `${r.stderr}\n${r.stdout}`.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('WARNING'));
  return (lines.find((l) => /^error/i.test(l)) || lines.pop() || `exit code ${r.code}`).slice(0, 300);
}

function parseList(tool, r) {
  if (r.code === 127 || /is not recognized|command not found/.test(r.stderr)) {
    throw new Error(`The "${tool}" command was not found, so its plugins cannot be read.`);
  }
  if (r.code !== 0) throw new Error(detail(r));
  return JSON.parse(r.stdout);
}

// Names of the skills a plugin ships in its skills/ folder.
function skillsIn(dir) {
  try {
    return fs.readdirSync(path.join(dir, 'skills'))
      .filter((n) => fs.existsSync(path.join(dir, 'skills', n, 'SKILL.md'))).sort();
  } catch { return []; }
}

// Plugins that come with Codex itself. Shown, but not removable from here.
const builtIn = (agent, marketplace) => agent === 'codex' && marketplace.startsWith('openai-');

function entry(agent, id, version, enabled, dir, removable) {
  const [name, marketplace = ''] = id.split('@');
  return { id, name, marketplace, version: version || '', enabled: enabled !== false,
    removable: removable && !builtIn(agent, marketplace), skills: skillsIn(dir) };
}

const TOOLS = {
  claude: {
    // claude plugin list --json -> [{ id: "name@marketplace", version, scope, enabled, installPath }]
    async list() {
      const found = parseList('claude', await run('claude', ['plugin', 'list', '--json']));
      return found.map((p) => entry('claude', p.id, p.version, p.enabled, p.installPath || '', p.scope === 'user'));
    },
    // Adds the repository as a marketplace first if it is not one yet. Without -y it
    // refuses plugins that would run a marketplace-declared command, which is what we want.
    add: (name, repo) => run('claude', ['plugin', 'install', name, '--marketplace', repo, '--json']),
    remove: (id) => run('claude', ['plugin', 'uninstall', id, '--json']),
  },
  codex: {
    // codex plugin list --json -> { installed: [{ pluginId, name, marketplaceName, version, enabled }] }
    async list() {
      const found = parseList('codex', await run('codex', ['plugin', 'list', '--json']));
      const cache = path.join(AGENTS.codex.detect(), 'plugins', 'cache');
      return found.installed.map((p) => entry('codex', p.pluginId, p.version, p.enabled,
        path.join(cache, p.marketplaceName, p.name, p.version || ''), true));
    },
    async add(name, repo, marketplace) {
      const added = await run('codex', ['plugin', 'marketplace', 'add', repo]); // fine if already added
      return added.code ? added : run('codex', ['plugin', 'add', `${name}@${marketplace}`, '--json']);
    },
    remove: (id) => run('codex', ['plugin', 'remove', id, '--json']),
  },
};

export const pluginAgents = Object.keys(TOOLS);
export const canRemove = (agent, id) => !builtIn(agent, id.split('@')[1] || '');

// { claude: { plugins: [...] } | { error }, codex: ... }
export async function listPlugins() {
  const results = await Promise.all(pluginAgents.map(async (id) => {
    try { return [id, { plugins: await TOOLS[id].list() }]; } catch (e) { return [id, { error: e.message }]; }
  }));
  return Object.fromEntries(results);
}

// Where each tool looks for the plugins a repository offers.
const MANIFESTS = {
  claude: ['.claude-plugin', 'marketplace.json'],
  codex: ['.agents', 'plugins', 'marketplace.json'],
};

// [{ name, description, marketplaces: { claude?: <marketplace name>, codex?: ... } }]
export function pluginsIn(root) {
  const found = new Map();
  for (const [agent, file] of Object.entries(MANIFESTS)) {
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(path.join(root, ...file), 'utf8')); } catch { continue; }
    if (!isName(manifest?.name) || !Array.isArray(manifest.plugins)) continue;
    for (const p of manifest.plugins) {
      if (!isName(p?.name)) continue;
      const item = found.get(p.name) || { name: p.name, description: '', marketplaces: {} };
      if (!item.description && typeof p.description === 'string') item.description = p.description;
      item.marketplaces[agent] = manifest.name;
      found.set(p.name, item);
    }
  }
  return [...found.values()];
}

// Installs each plugin into each chosen agent that the plugin supports.
export async function addPlugins({ repo, plugins, agents }) {
  const lines = [];
  let failed = 0;
  for (const p of plugins) {
    lines.push(p.name);
    for (const id of agents) {
      const marketplace = p.marketplaces[id];
      if (!marketplace) { lines.push(`  - ${AGENTS[id].label}: this plugin has no version for it`); continue; }
      const r = await TOOLS[id].add(p.name, repo, marketplace);
      if (r.code === 0) lines.push(`  + ${AGENTS[id].label}: installed`);
      else { failed++; lines.push(`  x ${AGENTS[id].label}: ${detail(r)}`); }
    }
  }
  return { code: failed ? 1 : 0, output: lines.join('\n') };
}

export async function removePlugin({ agent, id }) {
  const r = await TOOLS[agent].remove(id);
  return { code: r.code, output: r.code === 0 ? `  - ${AGENTS[agent].label}: removed ${id}` : `  x ${AGENTS[agent].label}: ${detail(r)}` };
}
