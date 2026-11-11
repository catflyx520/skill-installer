// Agent registry: to support a new tool, add one entry here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// SKILL_INSTALLER_USER_HOME lets tests point at a fake home directory.
export const userHome = () => process.env.SKILL_INSTALLER_USER_HOME || os.homedir();
export const hubHome = () => process.env.SKILL_INSTALLER_HOME || path.join(userHome(), '.skill-installer');

const home = (...p) => path.join(userHome(), ...p);

export const AGENTS = {
  claude: {
    label: 'Claude Code',
    detect: () => home('.claude'),
    skillsDir: () => home('.claude', 'skills'),
  },
  codex: {
    label: 'Codex',
    // Codex keeps its config in ~/.codex but reads user skills from ~/.agents/skills.
    detect: () => process.env.CODEX_HOME || home('.codex'),
    skillsDir: () => home('.agents', 'skills'),
  },
  cursor: {
    label: 'Cursor',
    detect: () => home('.cursor'),
    skillsDir: () => home('.cursor', 'skills'),
  },
  gemini: {
    label: 'Gemini CLI',
    detect: () => home('.gemini'),
    skillsDir: () => home('.gemini', 'skills'),
  },
};

export const isDetected = (id) => fs.existsSync(AGENTS[id].detect());
export const detectedAgents = () => Object.keys(AGENTS).filter(isDetected);

// Turns ["claude,codex", "cursor"] / ["all"] / [] into a list of agent ids.
export function resolveAgents(requested) {
  const ids = requested.flatMap((s) => s.split(',')).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) return detectedAgents();
  if (ids.includes('all')) return Object.keys(AGENTS);
  const unknown = ids.filter((id) => !AGENTS[id]);
  if (unknown.length) {
    throw new Error(`Unknown agent: ${unknown.join(', ')}. Known: ${Object.keys(AGENTS).join(', ')}, all`);
  }
  return [...new Set(ids)];
}
