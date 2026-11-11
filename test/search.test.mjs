// The page's search ranking. ui/search.js is a plain browser script, so it is loaded as text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'ui', 'search.js');
const rankRepos = new Function(`${fs.readFileSync(file, 'utf8')}; return rankRepos;`)();
const repo = (full_name, stargazers_count, description = '') => ({ full_name, stargazers_count, description });

test('the original repository comes before look-alikes', () => {
  // What GitHub really returned for "ponytail": the original never says "skill", so only the name search finds it.
  const topic = [repo('someone/karpathy-ponytail-skills', 64), repo('other/dsh-ponytail', 42)];
  const byName = [repo('DietrichGebert/ponytail', 188404), repo('copy/ponytail-lite', 243), repo('someone/karpathy-ponytail-skills', 64)];
  assert.deepEqual(rankRepos('ponytail', topic, byName, false).map((r) => r.repo),
    ['DietrichGebert/ponytail', 'someone/karpathy-ponytail-skills', 'other/dsh-ponytail']);
});

test('the official repository is first, and each repository appears once', () => {
  const topic = [repo('anthropics/skills', 9000), repo('big/book-to-skill', 37547)];
  const found = rankRepos('pdf', topic, [repo('mozilla/pdf.js', 54122), repo('Someone/PDF', 12)], true);
  assert.deepEqual(found.map((r) => r.repo), ['anthropics/skills', 'Someone/PDF', 'big/book-to-skill']);
  assert.equal(found[0].official, true);
  assert.equal(found[0].officialFor, 'pdf');
  assert.deepEqual(found[1], { repo: 'Someone/PDF', description: '', stars: 12 }, 'an unrelated project with the word in its name is left out');
});

test('at most nine results', () => {
  const topic = Array.from({ length: 12 }, (_, i) => repo(`owner/repo-${i}`, 100 - i));
  assert.equal(rankRepos('x', topic, [], false).length, 9);
});
