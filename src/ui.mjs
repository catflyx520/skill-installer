// `skill-installer ui`: a page on 127.0.0.1 for managing skills.
// Every change runs the real CLI in a child process, so the page follows the
// same safety rules as the command line and git never blocks the server.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AGENTS, isDetected } from './agents.mjs';
import { readSkillMeta } from './hub.mjs';
import { status } from './commands.mjs';
import {
  listPlugins, addPlugins, removePlugin, pluginAgents, canRemove, isName, isRepo, isPluginId,
} from './plugins.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.join(here, '..', 'ui');
const cli = path.join(here, '..', 'bin', 'skill-installer.mjs');

const STATIC = {
  '/style.css': 'text/css; charset=utf-8',
  '/app.js': 'text/javascript; charset=utf-8',
  '/i18n.js': 'text/javascript; charset=utf-8',
  '/search.js': 'text/javascript; charset=utf-8',
  '/fonts/Geist-Variable.woff2': 'font/woff2',
  '/fonts/GeistMono-Variable.woff2': 'font/woff2',
};
const HEADERS = {
  // The page searches GitHub itself; nothing else may be contacted.
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};
class BadRequest extends Error {}

const runCli = (args) => new Promise((resolve) => {
  execFile(process.execPath, [cli, ...args], {
    timeout: 5 * 60_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // fail instead of waiting for a password
  }, (err, stdout, stderr) => {
    const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
    resolve({ code, stdout, output: (stdout + stderr).trim() });
  });
});

// Changes run one at a time: each one reads and rewrites the manifest.
let queue = Promise.resolve();
const enqueue = (job) => (queue = queue.then(job, job));

// Values become CLI arguments, so nothing here may look like an option.
const checkSource = (s) => {
  if (typeof s !== 'string' || !s.trim() || s.trim().startsWith('-')) throw new BadRequest('Invalid source');
  return s.trim();
};
const checkNames = (list) => {
  if (!Array.isArray(list) || !list.every(isName)) throw new BadRequest('Invalid skill name');
  return list;
};
const checkAgents = (list) => {
  if (!Array.isArray(list) || !list.every((id) => Object.hasOwn(AGENTS, id))) throw new BadRequest('Invalid agent');
  return list;
};
const flags = (flag, values) => values.flatMap((v) => [flag, v]);

// Skills in an agent's folder that skill-installer did not put there. Shown, never changed.
function unmanaged(id, managed) {
  const dir = AGENTS[id].skillsDir();
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((name) => !managed.has(name)).sort().flatMap((name) => {
    if (!fs.existsSync(path.join(dir, name, 'SKILL.md'))) return []; // not a skill
    let description = '';
    try { description = readSkillMeta(path.join(dir, name)).description; } catch { /* a name we would not install is still there */ }
    return [{ name, description }];
  });
}

function state() {
  const skills = status().map((s) => {
    let description = '';
    try { description = readSkillMeta(s.hubDir).description; } catch { /* hub copy is gone; the row shows it as broken */ }
    return { ...s, description };
  });
  return {
    agents: Object.entries(AGENTS).map(([id, a]) => ({
      id, label: a.label, detected: isDetected(id), skillsDir: a.skillsDir(),
      others: unmanaged(id, new Set(skills.filter((s) => s.agents[id] !== '-').map((s) => s.name))),
    })),
    skills,
  };
}

const actions = {
  async inspect({ source }) {
    const r = await runCli(['inspect', checkSource(source)]);
    return r.code === 0 ? { code: 0, ...JSON.parse(r.stdout) } : { code: r.code, output: r.output };
  },
  'plugin-add'({ repo, plugins, agents }) {
    if (!isRepo(repo)) throw new BadRequest('Plugins can only be installed from a GitHub repository');
    const valid = Array.isArray(plugins) && plugins.length > 0 && plugins.every((p) => isName(p?.name)
      && p.marketplaces && Object.entries(p.marketplaces).every(([id, m]) => pluginAgents.includes(id) && isName(m)));
    if (!valid) throw new BadRequest('Invalid plugin');
    if (!checkAgents(agents).every((id) => pluginAgents.includes(id))) throw new BadRequest('That agent has no plugin support here');
    const wanted = plugins.map(({ name, marketplaces }) => ({ name, marketplaces }));
    return enqueue(() => addPlugins({ repo, plugins: wanted, agents }));
  },
  'plugin-remove'({ agent, id }) {
    if (!pluginAgents.includes(agent) || !isPluginId(id)) throw new BadRequest('Invalid plugin');
    if (!canRemove(agent, id)) throw new BadRequest('This plugin comes with the tool and is not removed from here');
    return enqueue(() => removePlugin({ agent, id }));
  },
  add({ source, skills = [], agents = [], copy, force }) {
    const args = ['add', checkSource(source), ...flags('-s', checkNames(skills)), ...flags('-a', checkAgents(agents))];
    if (copy === true) args.push('--copy');
    if (force === true) args.push('--force');
    return enqueue(() => runCli(args));
  },
  remove({ name, agents = [] }) {
    const [valid] = checkNames([name]);
    return enqueue(() => runCli(['remove', valid, ...flags('-a', checkAgents(agents))]));
  },
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 65536) { reject(new BadRequest('Request too large')); req.destroy(); }
    });
    req.on('end', () => {
      try {
        const value = JSON.parse(body);
        if (value === null || typeof value !== 'object') throw new Error();
        resolve(value);
      } catch { reject(new BadRequest('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {}); // the address is already printed
  child.unref();
}

export function startUi({ open = true } = {}) {
  // The token keeps other websites and other local users from driving the page.
  const token = crypto.randomBytes(24).toString('hex');
  const send = (res, code, type, body) => {
    res.writeHead(code, { ...HEADERS, 'Content-Type': type });
    res.end(body);
  };
  const json = (res, code, value) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(value));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        if (url.searchParams.get('t') !== token) {
          return send(res, 403, 'text/plain; charset=utf-8', 'Open the full address printed by "skill-installer ui".\n');
        }
        const html = fs.readFileSync(path.join(uiDir, 'index.html'), 'utf8')
          .replace('data-mode="demo"', 'data-mode="local"')
          .replace('<meta name="skill-installer-token" content="">', `<meta name="skill-installer-token" content="${token}">`);
        return send(res, 200, 'text/html; charset=utf-8', html);
      }
      if (req.method === 'GET' && Object.hasOwn(STATIC, url.pathname)) {
        return send(res, 200, STATIC[url.pathname], fs.readFileSync(path.join(uiDir, url.pathname)));
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.headers['x-skill-installer-token'] !== token) return json(res, 403, { error: 'Forbidden' });
        const name = url.pathname.slice(5);
        if (req.method === 'GET' && name === 'state') return json(res, 200, state());
        if (req.method === 'GET' && name === 'plugins') return json(res, 200, await listPlugins());
        if (req.method === 'POST' && Object.hasOwn(actions, name)) {
          return json(res, 200, await actions[name](await readJson(req)));
        }
      }
      send(res, 404, 'text/plain; charset=utf-8', 'Not found\n');
    } catch (e) {
      if (!res.headersSent) json(res, e instanceof BadRequest ? 400 : 500, { error: e.message });
    }
  });

  server.on('error', (e) => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
  server.listen(0, '127.0.0.1', () => {
    const address = `http://127.0.0.1:${server.address().port}/?t=${token}`;
    console.log(`skill-installer is running at ${address}`);
    console.log('Keep this window open while you use the page. Press Ctrl+C to stop.');
    if (open) openBrowser(address);
  });
}
