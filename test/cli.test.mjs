// End-to-end tests: run the real CLI against a throwaway home directory.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSource, sourceKey } from '../src/hub.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'skill-installer.mjs');
const example = path.join(root, 'examples', 'pony-tails');

let home;
const run = (...args) => {
  const r = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SKILL_INSTALLER_USER_HOME: home, SKILL_INSTALLER_HOME: '', CODEX_HOME: '' },
  });
  return { code: r.status, out: r.stdout + r.stderr };
};
const at = (...p) => path.join(home, ...p);
const skillFile = (...p) => at(...p, 'pony-tails', 'SKILL.md');

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-installer-test-'));
  fs.mkdirSync(at('.claude'));
  fs.mkdirSync(at('.codex'));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

test('add installs into every detected agent, and only those', () => {
  const r = run('add', example);
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(skillFile('.skill-installer', 'skills')));
  assert.ok(fs.existsSync(skillFile('.claude', 'skills')));
  assert.ok(fs.existsSync(skillFile('.agents', 'skills')), 'codex reads ~/.agents/skills');
  assert.ok(!fs.existsSync(at('.cursor')), 'cursor was not detected');
  assert.ok(fs.lstatSync(at('.claude', 'skills', 'pony-tails')).isSymbolicLink());
});

test('-a all installs everywhere; list shows it', () => {
  assert.equal(run('add', example, '-a', 'all').code, 0);
  assert.ok(fs.existsSync(skillFile('.cursor', 'skills')));
  assert.ok(fs.existsSync(skillFile('.gemini', 'skills')));
  const r = run('list');
  assert.match(r.out, /pony-tails\s+link\s+link\s+link\s+link/);
});

test('adding again updates the hub copy that the links point at', () => {
  const src = at('src-skill');
  fs.cpSync(example, src, { recursive: true });
  run('add', src);
  fs.appendFileSync(path.join(src, 'SKILL.md'), '\nVERSION TWO\n');
  assert.equal(run('add', src).code, 0);
  assert.match(fs.readFileSync(skillFile('.claude', 'skills'), 'utf8'), /VERSION TWO/);
});

test('--copy makes real folders, and remove deletes them', () => {
  assert.equal(run('add', example, '--copy').code, 0);
  assert.ok(!fs.lstatSync(at('.claude', 'skills', 'pony-tails')).isSymbolicLink());
  assert.match(run('list').out, /pony-tails\s+copy\s+copy/);
  assert.equal(run('remove', 'pony-tails').code, 0);
  assert.ok(!fs.existsSync(at('.claude', 'skills', 'pony-tails')));
});

test('remove cleans up links, hub copy and manifest', () => {
  run('add', example);
  assert.equal(run('remove', 'pony-tails').code, 0);
  assert.ok(!fs.existsSync(at('.claude', 'skills', 'pony-tails')));
  assert.ok(!fs.existsSync(at('.agents', 'skills', 'pony-tails')));
  assert.ok(!fs.existsSync(at('.skill-installer', 'skills', 'pony-tails')));
  assert.match(run('list').out, /No skills installed/);
});

test('remove -a takes it off one agent only', () => {
  run('add', example);
  assert.equal(run('remove', 'pony-tails', '-a', 'codex').code, 0);
  assert.ok(fs.existsSync(skillFile('.claude', 'skills')));
  assert.ok(!fs.existsSync(at('.agents', 'skills', 'pony-tails')));
  assert.match(run('list').out, /pony-tails\s+link\s+-/);
});

test('never overwrites a skill folder it did not create, unless --force', () => {
  const mine = at('.claude', 'skills', 'pony-tails');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), 'HAND MADE');
  const r = run('add', example);
  assert.equal(r.code, 1);
  assert.match(r.out, /skipped/);
  assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'HAND MADE');
  // remove must leave the hand-made folder alone too
  run('remove', 'pony-tails');
  assert.ok(fs.existsSync(mine));
  assert.equal(run('add', example, '--force').code, 0);
  assert.match(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), /name: pony-tails/);
});

test('a source with several skills asks you to choose', () => {
  const repo = at('repo');
  for (const n of ['alpha', 'beta']) {
    fs.mkdirSync(path.join(repo, 'skills', n), { recursive: true });
    fs.writeFileSync(path.join(repo, 'skills', n, 'SKILL.md'), `---\nname: ${n}\ndescription: test\n---\n`);
  }
  const r = run('add', repo);
  assert.equal(r.code, 1);
  assert.match(r.out, /alpha[\s\S]*beta/);
  assert.ok(!fs.existsSync(at('.skill-installer', 'skills')));
  assert.equal(run('add', repo, '--skill', 'beta').code, 0);
  assert.ok(fs.existsSync(at('.claude', 'skills', 'beta', 'SKILL.md')));
  assert.ok(!fs.existsSync(at('.claude', 'skills', 'alpha')));
  assert.equal(run('add', repo, '--all').code, 0);
  assert.ok(fs.existsSync(at('.claude', 'skills', 'alpha', 'SKILL.md')));
});

test('a skill shipped in several folders is offered once, from the visible folder', () => {
  const repo = at('repo');
  for (const [folder, body] of [['skills', 'MAIN COPY'], ['.other-tool/skills', 'HIDDEN COPY']]) {
    fs.mkdirSync(path.join(repo, folder, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(repo, folder, 'alpha', 'SKILL.md'), `---\nname: alpha\ndescription: test\n---\n${body}\n`);
  }
  const found = JSON.parse(run('inspect', repo).out);
  assert.deepEqual(found.skills.map((s) => s.name), ['alpha']);
  assert.equal(run('add', repo).code, 0, 'one skill, so there is nothing to choose');
  assert.match(fs.readFileSync(at('.claude', 'skills', 'alpha', 'SKILL.md'), 'utf8'), /MAIN COPY/);
});

test('adding a skill through an agent\'s link to it keeps the hub copy', () => {
  fs.mkdirSync(at('.gemini'));
  run('add', example, '-a', 'claude,codex');
  // The link in Claude's folder points at the hub copy; using it as the source must not delete that copy.
  const r = run('add', at('.claude', 'skills', 'pony-tails'), '-a', 'gemini');
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(skillFile('.skill-installer', 'skills')));
  assert.ok(fs.existsSync(skillFile('.claude', 'skills')));
  assert.ok(fs.existsSync(skillFile('.gemini', 'skills')));
  assert.match(run('list').out, new RegExp(`link\\s+link\\s+-\\s+link\\s+${example.replaceAll('\\', '\\\\')}`), 'the source is still the original folder');
});

test('the same skill name from a different source is not treated as an update', () => {
  for (const n of ['one', 'two']) {
    fs.mkdirSync(at(`src-${n}`, 'alpha'), { recursive: true });
    fs.writeFileSync(at(`src-${n}`, 'alpha', 'SKILL.md'), `---\nname: alpha\ndescription: test\n---\nFROM ${n}\n`);
  }
  assert.equal(run('add', at('src-one')).code, 0);
  const r = run('add', at('src-two'));
  assert.equal(r.code, 1);
  assert.match(r.out, /skipped, a skill with this name is already installed from/);
  assert.match(fs.readFileSync(at('.claude', 'skills', 'alpha', 'SKILL.md'), 'utf8'), /FROM one/);
  assert.equal(run('add', at('src-one')).code, 0, 'the same source again is still an update');
  assert.equal(run('add', at('src-two'), '--force').code, 0);
  assert.match(fs.readFileSync(at('.claude', 'skills', 'alpha', 'SKILL.md'), 'utf8'), /FROM two/);
});

test('updating keeps a copy a copy', () => {
  run('add', example, '--copy');
  assert.equal(run('add', example).code, 0);
  assert.ok(!fs.lstatSync(at('.claude', 'skills', 'pony-tails')).isSymbolicLink());
  assert.match(run('list').out, /pony-tails\s+copy\s+copy/);
});

test('a link whose hub copy is gone is reported as broken, and adding again repairs it', () => {
  run('add', example);
  fs.rmSync(at('.skill-installer', 'skills', 'pony-tails'), { recursive: true });
  assert.match(run('list').out, /pony-tails\s+BROKEN\s+BROKEN/);
  assert.equal(run('add', example).code, 0);
  assert.match(run('list').out, /pony-tails\s+link\s+link/);
  assert.ok(fs.existsSync(skillFile('.claude', 'skills')));
});

test('removing a skill from the last agent that has it removes it completely', () => {
  run('add', example, '-a', 'claude');
  assert.equal(run('remove', 'pony-tails', '-a', 'claude').code, 0);
  assert.ok(!fs.existsSync(at('.skill-installer', 'skills', 'pony-tails')), 'no unused copy stays in the hub');
  assert.match(run('list').out, /No skills installed/);
});

test('a missing folder is reported as missing, not looked up on GitHub', () => {
  for (const source of ['./nope/skill', '.\\nope\\skill', '~/nope', at('nope')]) {
    const r = run('inspect', source);
    assert.match(r.out, /Error: Folder not found/, source);
    assert.doesNotMatch(r.out, /Fetching|git clone/, source);
  }
});

test('remote sources are read the same however they are written', () => {
  assert.deepEqual(parseSource('anthropics/skills'),
    { url: 'https://github.com/anthropics/skills.git', ref: undefined, sub: '', repo: 'anthropics/skills' });
  assert.deepEqual(parseSource('anthropics/skills/skills/pdf'),
    { url: 'https://github.com/anthropics/skills.git', ref: undefined, sub: 'skills/pdf', repo: null });
  assert.deepEqual(parseSource('https://github.com/anthropics/skills/tree/main/skills/pdf'),
    { url: 'https://github.com/anthropics/skills.git', ref: 'main', sub: 'skills/pdf', repo: null });
  assert.equal(parseSource('https://github.com/anthropics/skills/tree/main').repo, 'anthropics/skills');
  assert.equal(parseSource('https://github.com/anthropics/skills.git').repo, 'anthropics/skills');
  assert.equal(parseSource('git@github.com:anthropics/skills.git').repo, null, 'only an https GitHub address names a repo');
  assert.equal(parseSource('not a source'), null);

  const same = ['anthropics/skills', 'Anthropics/Skills/skills/pdf', 'https://github.com/anthropics/skills',
    'https://github.com/anthropics/skills.git', 'https://github.com/anthropics/skills/tree/main/skills/pdf'];
  assert.equal(new Set(same.map(sourceKey)).size, 1, 'one repository, one key');
  assert.notEqual(sourceKey('anthropics/skills'), sourceKey('someone/skills'));
});

test('clear errors for bad input', () => {
  assert.match(run('add', at('nope-does-not-exist')).out, /Error: /);
  assert.match(run('add', example, '-a', 'vim').out, /Unknown agent: vim/);
  assert.match(run('remove', 'ghost').out, /not installed by skill-installer/);
  fs.rmSync(at('.claude'), { recursive: true });
  fs.rmSync(at('.codex'), { recursive: true });
  assert.match(run('add', example).out, /No supported agent detected/);
});
