// End-to-end tests for `skill-installer ui`: start the real server against a throwaway home.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'skill-installer.mjs');
const example = path.join(root, 'examples', 'pony-tails');
// Plugins are handled by the real claude and codex CLIs; tests swap in a fake that records its calls.
const fakeTool = (name) => `"${process.execPath}" "${path.join(root, 'examples', 'fake-tool.mjs')}" ${name}`;

let home, server, address, origin, token;
const at = (...p) => path.join(home, ...p);
const toolCalls = () => (fs.existsSync(at('calls.log')) ? fs.readFileSync(at('calls.log'), 'utf8').trim().split('\n') : []);

beforeEach(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-installer-ui-test-'));
  fs.mkdirSync(at('.claude'));
  fs.mkdirSync(at('.codex'));
  server = spawn(process.execPath, [cli, 'ui', '--no-open'], {
    env: {
      ...process.env, SKILL_INSTALLER_USER_HOME: home, SKILL_INSTALLER_HOME: '', CODEX_HOME: '',
      SKILL_INSTALLER_CLAUDE_BIN: fakeTool('claude'), SKILL_INSTALLER_CODEX_BIN: fakeTool('codex'), FAKE_TOOL_DIR: home,
    },
  });
  address = await new Promise((resolve, reject) => {
    let out = '';
    server.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/http:\/\/\S+/);
      if (m) resolve(m[0]);
    });
    server.once('exit', () => reject(new Error(`server exited: ${out}`)));
  });
  const url = new URL(address);
  origin = url.origin;
  token = url.searchParams.get('t');
});

afterEach(async () => {
  server.removeAllListeners('exit');
  const exited = once(server, 'exit');
  server.kill();
  await exited;
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const headers = () => ({ 'X-Skill-Installer-Token': token, 'Content-Type': 'application/json' });
const post = async (name, body) => {
  const res = await fetch(`${origin}/api/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  return { status: res.status, ...(await res.json()) };
};
const state = async () => (await fetch(`${origin}/api/state`, { headers: headers() })).json();

test('the page and the API need the token', async () => {
  assert.equal((await fetch(`${origin}/`)).status, 403);
  assert.equal((await fetch(`${origin}/api/state`)).status, 403);
  const forged = await fetch(`${origin}/api/add`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: example }),
  });
  assert.equal(forged.status, 403);
  assert.ok(!fs.existsSync(at('.skill-installer')));

  const page = await fetch(address);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /data-mode="local"/);
  assert.ok(html.includes(token));
});

test('only known static files are served', async () => {
  for (const file of ['app.js', 'i18n.js', 'search.js', 'style.css']) assert.equal((await fetch(`${origin}/${file}`)).status, 200, file);
  assert.equal((await fetch(`${origin}/fonts/Geist-Variable.woff2`)).status, 200);
  assert.equal((await fetch(`${origin}/..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${origin}/index.html`)).status, 404, 'the page only comes from / with the token');
});

test('inspect, add and remove work through the API', async () => {
  const found = await post('inspect', { source: example });
  assert.deepEqual(found.skills.map((s) => s.name), ['pony-tails']);
  assert.ok(!fs.existsSync(at('.skill-installer')), 'inspect installs nothing');

  const added = await post('add', { source: example, skills: ['pony-tails'], agents: ['claude', 'codex'] });
  assert.equal(added.code, 0, added.output);
  assert.ok(fs.lstatSync(at('.claude', 'skills', 'pony-tails')).isSymbolicLink());

  const s = await state();
  assert.equal(s.agents.find((a) => a.id === 'cursor').detected, false);
  assert.equal(s.skills[0].agents.claude, 'link');
  assert.match(s.skills[0].description, /Example skill/);

  assert.equal((await post('remove', { name: 'pony-tails', agents: ['codex'] })).code, 0);
  assert.ok(!fs.existsSync(at('.agents', 'skills', 'pony-tails')));
  assert.ok(fs.existsSync(at('.claude', 'skills', 'pony-tails', 'SKILL.md')));

  assert.equal((await post('remove', { name: 'pony-tails' })).code, 0);
  assert.ok(!fs.existsSync(at('.claude', 'skills', 'pony-tails')));
  assert.deepEqual((await state()).skills, []);
});

test('switching an agent back on from the hub keeps the original source', async () => {
  await post('add', { source: example, agents: ['claude', 'codex'] });
  await post('remove', { name: 'pony-tails', agents: ['codex'] });
  const before = (await state()).skills[0];
  const r = await post('add', { source: before.hubDir, skills: ['pony-tails'], agents: ['codex'] });
  assert.equal(r.code, 0, r.output);
  const after = (await state()).skills[0];
  assert.equal(after.agents.codex, 'link');
  assert.equal(after.source, example);
  assert.ok(fs.existsSync(at('.skill-installer', 'skills', 'pony-tails', 'SKILL.md')));
});

test('state lists, per agent, the skills skill-installer did not install', async () => {
  const mine = at('.claude', 'skills', 'hand-made');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), '---\nname: hand-made\ndescription: my own\n---\n');
  fs.mkdirSync(at('.claude', 'skills', 'not-a-skill'));
  // A name skill-installer itself would refuse to install is still a skill the agent has.
  fs.mkdirSync(at('.claude', 'skills', 'My Skill'));
  fs.writeFileSync(at('.claude', 'skills', 'My Skill', 'SKILL.md'), '---\nname: My Skill\ndescription: odd\n---\n');
  await post('add', { source: example, agents: ['claude', 'codex'] });

  const agents = Object.fromEntries((await state()).agents.map((a) => [a.id, a]));
  assert.deepEqual(agents.claude.others, [{ name: 'My Skill', description: '' }, { name: 'hand-made', description: 'my own' }]);
  assert.deepEqual(agents.codex.others, [], 'a skill skill-installer installed is not listed twice');
  assert.deepEqual(agents.cursor.others, [], 'a missing skills folder is fine');
});

test('removing a skill from the last agent that has it removes it completely', async () => {
  await post('add', { source: example, agents: ['claude', 'codex'] });
  assert.equal((await post('remove', { name: 'pony-tails', agents: ['codex'] })).code, 0);
  assert.ok(fs.existsSync(at('.skill-installer', 'skills', 'pony-tails')), 'claude still uses the hub copy');

  assert.equal((await post('remove', { name: 'pony-tails', agents: ['claude'] })).code, 0);
  assert.ok(!fs.existsSync(at('.claude', 'skills', 'pony-tails')));
  assert.ok(!fs.existsSync(at('.skill-installer', 'skills', 'pony-tails')), 'no unused copy is left in the hub');
  assert.deepEqual((await state()).skills, []);
});

test('the page may contact GitHub and nothing else', async () => {
  const csp = (await fetch(address)).headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.github\.com$/);
});

test('inspect reports the plugins a source offers, and for which agents', async () => {
  const repo = at('repo');
  fs.mkdirSync(path.join(repo, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.agents', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'skills', 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'skills', 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: test\n---\n');
  fs.writeFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: 'demo-market', plugins: [{ name: 'demo', description: 'A demo plugin' }, { name: '--force' }],
  }));
  fs.writeFileSync(path.join(repo, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({
    name: 'demo-codex', plugins: [{ name: 'demo' }],
  }));

  const found = await post('inspect', { source: repo });
  assert.deepEqual(found.skills.map((s) => s.name), ['alpha']);
  assert.deepEqual(found.plugins, [
    { name: 'demo', description: 'A demo plugin', marketplaces: { claude: 'demo-market', codex: 'demo-codex' } },
  ], 'a plugin whose name could be read as an option is left out');
  assert.equal(found.repo, null, 'a local folder is not a GitHub repository to install plugins from');
});

test('plugins are installed, listed and removed through each tool\'s own command', async () => {
  const demo = { name: 'demo', marketplaces: { claude: 'demo-market', codex: 'demo-codex' } };
  const added = await post('plugin-add', { repo: 'someone/demo', plugins: [demo], agents: ['claude', 'codex'] });
  assert.equal(added.code, 0, added.output);
  assert.deepEqual(toolCalls(), [
    'claude plugin install demo --marketplace someone/demo --json',
    'codex plugin marketplace add someone/demo',
    'codex plugin add demo@demo-codex --json',
  ]);
  assert.ok(!fs.existsSync(at('.skill-installer')), 'skill-installer keeps no copy of a plugin');

  const listed = await (await fetch(`${origin}/api/plugins`, { headers: headers() })).json();
  assert.deepEqual(listed.claude.plugins.map((p) => [p.id, p.removable]), [['demo@fake-market', true]]);
  assert.deepEqual(listed.codex.plugins.map((p) => [p.id, p.removable]),
    [['pdf@openai-bundled', false], ['demo@demo-codex', true]], 'plugins that come with Codex are not removable here');

  assert.equal((await post('plugin-remove', { agent: 'codex', id: 'demo@demo-codex' })).code, 0);
  assert.equal(toolCalls().at(-1), 'codex plugin remove demo@demo-codex --json');
});

test('a plugin only goes to the agents it has a version for, and failures are reported', async () => {
  const claudeOnly = { name: 'broken', marketplaces: { claude: 'demo-market' } };
  const r = await post('plugin-add', { repo: 'someone/demo', plugins: [claudeOnly], agents: ['claude', 'codex'] });
  assert.equal(r.code, 1);
  assert.match(r.output, /x Claude Code: .*could not be installed/);
  assert.match(r.output, /- Codex: this plugin has no version for it/);
  assert.deepEqual(toolCalls(), ['claude plugin install broken --marketplace someone/demo --json']);
});

test('plugin requests that could reach a shell or an option are refused', async () => {
  const demo = { name: 'demo', marketplaces: { claude: 'demo-market' } };
  const add = (body) => post('plugin-add', { repo: 'someone/demo', plugins: [demo], agents: ['claude'], ...body });
  assert.equal((await add({ repo: '--force' })).status, 400);
  assert.equal((await add({ repo: 'someone/demo & calc' })).status, 400);
  assert.equal((await add({ repo: 'C:\\somewhere' })).status, 400);
  assert.equal((await add({ plugins: [{ name: 'demo; rm', marketplaces: {} }] })).status, 400);
  assert.equal((await add({ plugins: [{ name: 'demo', marketplaces: { claude: 'x y' } }] })).status, 400);
  assert.equal((await add({ plugins: [] })).status, 400);
  assert.equal((await add({ agents: ['gemini'] })).status, 400);
  assert.equal((await post('plugin-remove', { agent: 'codex', id: 'demo@x@y' })).status, 400);
  assert.equal((await post('plugin-remove', { agent: 'codex', id: '--json' })).status, 400);
  assert.equal((await post('plugin-remove', { agent: 'codex', id: 'pdf@openai-bundled' })).status, 400);
  assert.deepEqual(toolCalls(), []);
});

test('the page cannot overwrite a folder skill-installer did not create, unless force is sent', async () => {
  const mine = at('.claude', 'skills', 'pony-tails');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), 'HAND MADE');
  const r = await post('add', { source: example, agents: ['claude'] });
  assert.equal(r.code, 1);
  assert.match(r.output, /skipped/);
  assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'HAND MADE');

  assert.equal((await post('add', { source: example, agents: ['claude'], force: true })).code, 0);
  assert.match(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), /name: pony-tails/);
});

test('values that could become CLI options are refused', async () => {
  assert.equal((await post('add', { source: '--force' })).status, 400);
  assert.equal((await post('inspect', { source: '-a' })).status, 400);
  assert.equal((await post('add', { source: example, agents: ['vim'] })).status, 400);
  assert.equal((await post('add', { source: example, skills: ['--all'] })).status, 400);
  assert.equal((await post('remove', { name: '../escape' })).status, 400);
  assert.equal((await post('remove', { name: '--force' })).status, 400);
  assert.ok(!fs.existsSync(at('.skill-installer')));
});
