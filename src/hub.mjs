// The hub: one real copy of each skill in ~/.skill-installer/skills/<name>,
// linked (or copied) into every agent's skills folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { AGENTS, hubHome } from './agents.mjs';

const isWin = process.platform === 'win32';
export const hubSkillsDir = () => path.join(hubHome(), 'skills');
const manifestPath = () => path.join(hubHome(), 'manifest.json');

// ---------- manifest ----------

export function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return { version: 1, skills: {} };
    throw new Error(`Cannot read ${manifestPath()}: ${e.message}`);
  }
}

export function saveManifest(m) {
  fs.mkdirSync(hubHome(), { recursive: true });
  fs.writeFileSync(manifestPath(), JSON.stringify(m, null, 2) + '\n');
}

// ---------- SKILL.md ----------

export function readSkillMeta(dir) {
  const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8').replace(/^﻿/, '');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const field = (key) => {
    const m = fm && fm[1].match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
    if (!m) return '';
    let value = m[1].trim();
    if (/^[>|][+-]?$/.test(value)) {
      // YAML block scalar: the text is on the indented lines that follow.
      const rest = fm[1].slice(m.index + m[0].length).split(/\r?\n/).slice(1);
      const end = rest.findIndex((l) => l.trim() && !/^\s/.test(l));
      value = (end === -1 ? rest : rest.slice(0, end)).map((l) => l.trim()).filter(Boolean).join(' ');
    }
    return value.replace(/^["']|["']$/g, '');
  };
  const name = field('name') || path.basename(dir);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`Invalid skill name "${name}" in ${dir} (letters, digits, . _ - only)`);
  }
  return { name, description: field('description'), dir };
}

// Finds every folder containing a SKILL.md, up to 5 levels deep.
export function discoverSkills(root) {
  const found = [];
  const walk = (dir, depth) => {
    if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
      found.push(readSkillMeta(dir));
      return; // a skill's own subfolders are not separate skills
    }
    if (depth >= 5) return;
    const dirs = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '.git' && e.name !== 'node_modules')
      .map((e) => e.name)
      // Hidden folders last: they often hold per-tool copies of the same skills.
      .sort((a, b) => a.startsWith('.') - b.startsWith('.') || a.localeCompare(b));
    for (const name of dirs) walk(path.join(dir, name), depth + 1);
  };
  walk(root, 0);
  // A repository may ship the same skill in several folders; keep the first one found.
  return found.filter((s, i) => found.findIndex((x) => x.name === s.name) === i);
}

// ---------- sources ----------

// Returns { root, label, cleanup } for a local folder, GitHub shorthand, or git URL.
export function fetchSource(source) {
  if (fs.existsSync(source)) {
    const root = path.resolve(source);
    if (!fs.statSync(root).isDirectory()) throw new Error(`${source} is not a folder`);
    return { root, label: root, repo: null, cleanup: () => {} };
  }

  let url, ref, sub = '', repo = null; // repo: GitHub owner/name, when the source is one
  const tree = source.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/tree\/([^/]+)\/?(.*)$/);
  const short = source.match(/^([\w.-]+)\/([\w.-]+)(?:\/(.+))?$/);
  if (tree) {
    url = `https://github.com/${tree[1]}/${tree[2]}.git`; ref = tree[3]; sub = tree[4];
    repo = `${tree[1]}/${tree[2]}`;
  } else if (/^(https?|ssh|git|file):\/\//.test(source) || source.startsWith('git@')) {
    url = source;
    const gh = source.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
    if (gh) repo = `${gh[1]}/${gh[2]}`;
  } else if (short) {
    url = `https://github.com/${short[1]}/${short[2]}.git`; sub = short[3] || '';
    repo = `${short[1]}/${short[2]}`;
  } else {
    throw new Error(`Source not found: ${source} (expected a folder, owner/repo, or a git URL)`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-installer-'));
  const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
  try {
    const args = ['clone', '--depth', '1', ...(ref ? ['--branch', ref] : []), url, tmp];
    execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    cleanup();
    const detail = e.code === 'ENOENT' ? 'git is not installed' : String(e.stderr || e.message).trim();
    throw new Error(`git clone failed for ${url}: ${detail}`);
  }
  const root = path.resolve(tmp, sub);
  if (!root.startsWith(tmp) || !fs.existsSync(root)) {
    cleanup();
    throw new Error(`Path "${sub}" not found in ${url}`);
  }
  // Plugins live at the repository root, so a subfolder source has no repo to offer.
  return { root, label: source, repo: sub ? null : repo, cleanup };
}

// ---------- hub copy ----------

const normalize = (p) => {
  const r = path.resolve(p.replace(/^\\\\\?\\/, '')).replace(/[\\/]+$/, '');
  return isWin ? r.toLowerCase() : r;
};
export const samePath = (a, b) => normalize(a) === normalize(b);

const copyDir = (from, to) =>
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => !['.git', 'node_modules'].includes(path.basename(src)),
  });

export function copyIntoHub(skill) {
  const dest = path.join(hubSkillsDir(), skill.name);
  if (samePath(skill.dir, dest)) return dest;
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(hubSkillsDir(), { recursive: true });
  copyDir(skill.dir, dest);
  return dest;
}

// ---------- agent links ----------

// 'missing' | 'link' (points at our hub copy) | 'foreign-link' | 'dir'
export function destState(dest, hubDir) {
  let st;
  try { st = fs.lstatSync(dest); } catch { return 'missing'; }
  if (!st.isSymbolicLink()) return 'dir';
  const target = path.resolve(path.dirname(dest), fs.readlinkSync(dest));
  return samePath(target, hubDir) ? 'link' : 'foreign-link';
}

function removeLink(dest) {
  try { fs.unlinkSync(dest); } catch { fs.rmdirSync(dest); }
}

// Puts one hub skill into one agent. Returns { mode } or { skipped: reason }.
export function installToAgent(name, agentId, { copy = false, force = false, ours } = {}) {
  const hubDir = path.join(hubSkillsDir(), name);
  const dest = path.join(AGENTS[agentId].skillsDir(), name);
  const state = destState(dest, hubDir);

  if (state === 'link' && !copy) return { mode: 'link', dest };
  if (state === 'link' || state === 'foreign-link') {
    if (state === 'foreign-link' && !force) return { skipped: 'a different link already exists (use --force)', dest };
    removeLink(dest);
  } else if (state === 'dir') {
    // Only replace a real folder if we put it there ourselves as a copy.
    if (ours !== 'copy' && !force) return { skipped: 'a folder not managed by skill-installer already exists (use --force)', dest };
    fs.rmSync(dest, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!copy) {
    try {
      // Junctions need no admin rights on Windows; plain symlinks do.
      fs.symlinkSync(hubDir, dest, isWin ? 'junction' : 'dir');
      return { mode: 'link', dest };
    } catch { /* fall back to copying */ }
  }
  copyDir(hubDir, dest);
  return { mode: 'copy', dest };
}

// Removes one skill from one agent. Returns true if something was removed.
export function removeFromAgent(name, agentId, mode) {
  const hubDir = path.join(hubSkillsDir(), name);
  const dest = path.join(AGENTS[agentId].skillsDir(), name);
  const state = destState(dest, hubDir);
  if (state === 'link') { removeLink(dest); return true; }
  if (state === 'dir' && mode === 'copy') { fs.rmSync(dest, { recursive: true, force: true }); return true; }
  return false; // missing, or something we did not create: leave it alone
}
