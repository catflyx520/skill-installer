import fs from 'node:fs';
import path from 'node:path';
import { AGENTS, isDetected, resolveAgents } from './agents.mjs';
import {
  loadManifest, saveManifest, fetchSource, discoverSkills, copyIntoHub,
  installToAgent, removeFromAgent, destState, hubSkillsDir, sameFolder, sourceKey,
} from './hub.mjs';
import { pluginsIn } from './plugins.mjs';

const log = (...a) => console.log(...a);

export function add(source, opts) {
  const agents = resolveAgents(opts.agents);
  if (agents.length === 0) {
    throw new Error('No supported agent detected. Pick some with -a claude,codex,cursor,gemini or -a all');
  }

  const src = fetchSource(source);
  try {
    let skills = discoverSkills(src.root);
    if (skills.length === 0) throw new Error(`No SKILL.md found in ${source}`);

    if (opts.skills.length) {
      const missing = opts.skills.filter((n) => !skills.some((s) => s.name === n));
      if (missing.length) {
        throw new Error(`Skill not found: ${missing.join(', ')}. Available: ${skills.map((s) => s.name).join(', ')}`);
      }
      skills = skills.filter((s) => opts.skills.includes(s.name));
    } else if (skills.length > 1 && !opts.all) {
      log(`Found ${skills.length} skills in ${source}:`);
      for (const s of skills) log(`  ${s.name}${s.description ? '  -  ' + s.description.slice(0, 70) : ''}`);
      log('\nPick with --skill <name> (repeatable), or install everything with --all');
      return 1;
    }

    const manifest = loadManifest();
    let failed = 0;
    for (const skill of skills) {
      const entry = manifest.skills[skill.name] || { agents: {} };
      // Adding from the hub copy itself (enabling another agent) keeps the recorded source.
      const fromHub = sameFolder(skill.dir, path.join(hubSkillsDir(), skill.name));
      log(`${skill.name}`);
      // The same name from somewhere else is a different skill, not an update.
      if (entry.source && !fromHub && !opts.force && sourceKey(entry.source) !== sourceKey(src.label)) {
        failed++;
        log(`  x skipped, a skill with this name is already installed from ${entry.source} (use --force to replace it)`);
        continue;
      }
      copyIntoHub(skill);
      if (!fromHub || !entry.source) entry.source = src.label;
      entry.updatedAt = new Date().toISOString();
      for (const id of agents) {
        // An agent that was given a copy keeps a copy when the skill is updated.
        const copy = opts.copy || entry.agents[id]?.mode === 'copy';
        const r = installToAgent(skill.name, id, { copy, force: opts.force, ours: entry.agents[id]?.mode });
        if (r.skipped) {
          failed++;
          log(`  x ${AGENTS[id].label}: skipped, ${r.skipped}\n      ${r.dest}`);
        } else {
          entry.agents[id] = { mode: r.mode };
          log(`  + ${AGENTS[id].label} (${r.mode}) -> ${r.dest}`);
        }
      }
      manifest.skills[skill.name] = entry;
      saveManifest(manifest); // save per skill so a later failure loses nothing
    }
    return failed ? 1 : 0;
  } finally {
    src.cleanup();
  }
}

// Prints what a source offers as JSON, without installing anything:
// { skills, plugins, repo }. repo is the GitHub owner/name plugins can be installed from.
export function inspect(source) {
  const src = fetchSource(source);
  try {
    log(JSON.stringify({
      skills: discoverSkills(src.root).map(({ name, description }) => ({ name, description })),
      plugins: pluginsIn(src.root),
      repo: src.repo,
    }));
    return 0;
  } finally {
    src.cleanup();
  }
}

// One entry per installed skill; agents maps id -> 'link' | 'copy' | 'BROKEN' | '-'.
export function status() {
  const manifest = loadManifest();
  return Object.keys(manifest.skills).sort().map((name) => {
    const entry = manifest.skills[name];
    const hubDir = path.join(hubSkillsDir(), name);
    const hubOk = fs.existsSync(path.join(hubDir, 'SKILL.md'));
    const agents = {};
    for (const id of Object.keys(AGENTS)) {
      const mode = entry.agents[id]?.mode;
      if (!mode) { agents[id] = '-'; continue; }
      const state = destState(path.join(AGENTS[id].skillsDir(), name), hubDir);
      // A link is only as good as the hub copy it points at; a copy stands on its own.
      agents[id] = (mode === 'link' ? hubOk && state === 'link' : state === 'dir') ? mode : 'BROKEN';
    }
    return { name, hubDir, source: entry.source || '', updatedAt: entry.updatedAt, agents };
  });
}

export function list() {
  const skills = status();
  if (skills.length === 0) {
    log('No skills installed yet. Try: skill-installer add <folder | owner/repo>');
    return 0;
  }
  const ids = Object.keys(AGENTS);
  const rows = [['SKILL', ...ids.map((i) => i.toUpperCase()), 'SOURCE']];
  for (const s of skills) rows.push([s.name, ...ids.map((id) => s.agents[id]), s.source]);
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  for (const r of rows) log(r.map((cell, c) => cell.padEnd(widths[c])).join('  ').trimEnd());
  return 0;
}

export function remove(name, opts) {
  const manifest = loadManifest();
  const entry = manifest.skills[name];
  if (!entry) {
    const known = Object.keys(manifest.skills);
    throw new Error(`"${name}" is not installed by skill-installer.${known.length ? ' Installed: ' + known.join(', ') : ''}`);
  }
  const everywhere = opts.agents.length === 0;
  const targets = everywhere ? Object.keys(entry.agents) : resolveAgents(opts.agents);

  for (const id of targets) {
    if (!entry.agents[id]) { log(`  - ${AGENTS[id].label}: was not installed`); continue; }
    const removed = removeFromAgent(name, id, entry.agents[id].mode);
    log(`  - ${AGENTS[id].label}: ${removed ? 'removed' : 'nothing to remove'}`);
    delete entry.agents[id];
  }

  // Once the last agent is gone nothing uses the hub copy, so it goes too.
  if (everywhere || Object.keys(entry.agents).length === 0) {
    fs.rmSync(path.join(hubSkillsDir(), name), { recursive: true, force: true });
    delete manifest.skills[name];
    log(`Removed ${name}`);
  }
  saveManifest(manifest);
  return 0;
}

export function agents() {
  for (const [id, a] of Object.entries(AGENTS)) {
    log(`${id.padEnd(8)} ${a.label.padEnd(12)} ${isDetected(id) ? 'detected ' : 'not found'}  ${a.skillsDir()}`);
  }
  return 0;
}
