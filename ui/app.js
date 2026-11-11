// One page, two backends: the local server when `skill-installer ui` served it,
// otherwise an in-memory demo. Skill and GitHub data is untrusted, so
// everything is rendered as text nodes and never as HTML.
const token = document.querySelector('meta[name="skill-installer-token"]').content;
const isLocal = Boolean(token);
const $ = (id) => document.getElementById(id);

// Phosphor icons, regular weight (MIT).
const ICONS = {
  check: 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z',
  warning: 'M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z',
  refresh: 'M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z',
  trash: 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z',
  x: 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z',
  link: 'M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z',
  copy: 'M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z',
  plus: 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z',
};

const SVG = 'http://www.w3.org/2000/svg';
function icon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((kid) => kid != null && kid !== false));
  return el;
}

// ---------- GitHub search (runs in the browser in both modes) ----------

const OFFICIAL = 'anthropics/skills';
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// No slash, backslash or colon: a name to search for, not an address or a folder.
const isSearch = (text) => !/[\\/:]/.test(text);

async function github(path) {
  let res;
  try {
    res = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    throw new Error(t('netGithub'));
  }
  if (res.status === 403 || res.status === 429) throw new Error(t('rateLimit'));
  return res;
}

// Repositories that look like they hold a skill with this name, the official one first.
async function searchGitHub(name) {
  // Most starred first: GitHub's default "best match" order can put a look-alike above the original.
  const search = (q, n) => github(`/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=${n}`);
  const [byTopic, byName, official] = await Promise.all([
    search(`${name} skill`, 8),
    search(`${name} in:name`, 5), // finds the original when its description never says "skill"
    SKILL_NAME.test(name) ? github(`/repos/${OFFICIAL}/contents/skills/${name}/SKILL.md`).catch(() => null) : null,
  ]);
  if (!byTopic.ok) throw new Error(t('searchFailed', byTopic.status));
  const rows = async (res) => (res.ok ? (await res.json()).items : []).map((r) => ({
    repo: r.full_name, description: r.description || '', stars: r.stargazers_count,
  }));
  // Of the name matches, keep only repositories named exactly like the search; the rest are unrelated projects.
  const exact = (await rows(byName)).filter((r) => r.repo.split('/')[1].toLowerCase() === name.toLowerCase());
  const found = [
    ...(official?.ok ? [{ repo: OFFICIAL, officialFor: name, official: true }] : []),
    ...exact,
    ...(await rows(byTopic)),
  ];
  return found.filter((r, i) => found.findIndex((x) => x.repo === r.repo) === i).slice(0, 9);
}

// ---------- backends ----------

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'X-Skill-Installer-Token': token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(t('netLocal'));
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || t('requestFailed', res.status));
  return data;
}

const localBackend = {
  state: () => call('GET', '/api/state'),
  inspect: (source) => call('POST', '/api/inspect', { source }),
  add: (body) => call('POST', '/api/add', body),
  remove: (body) => call('POST', '/api/remove', body),
  plugins: () => call('GET', '/api/plugins'),
  pluginAdd: (body) => call('POST', '/api/plugin-add', body),
  pluginRemove: (body) => call('POST', '/api/plugin-remove', body),
};

// The demo reads real repositories from GitHub but only pretends to install.
function createDemoBackend() {
  const agents = [
    { id: 'claude', label: 'Claude Code', detected: true, skillsDir: '~/.claude/skills', others: [] },
    { id: 'codex', label: 'Codex', detected: true, skillsDir: '~/.agents/skills', others: [] },
    { id: 'cursor', label: 'Cursor', detected: false, skillsDir: '~/.cursor/skills', others: [] },
    { id: 'gemini', label: 'Gemini CLI', detected: true, skillsDir: '~/.gemini/skills', others: [] },
  ];
  const blank = () => Object.fromEntries(agents.map((a) => [a.id, '-']));
  const skills = [{
    name: 'pdf', description: '', sample: true,
    hubDir: '~/.skill-installer/skills/pdf', source: OFFICIAL,
    agents: { ...blank(), claude: 'link', codex: 'link' },
  }];
  const plugins = {
    claude: { plugins: [] },
    codex: { plugins: [{ id: 'ponytail@ponytail', name: 'ponytail', marketplace: 'ponytail', version: '5.3.3',
      enabled: true, removable: true, skills: ['ponytail', 'ponytail-audit', 'ponytail-review'] }] },
  };
  const wait = () => new Promise((r) => setTimeout(r, 450));
  return {
    // The two sample descriptions are filled in here so they follow the page language.
    state: async () => structuredClone({
      agents: agents.map((a) => (a.id === 'claude' ? { ...a, others: [{ name: 'my-notes', description: t('demoOwnSkill') }] } : a)),
      skills: skills.map((s) => (s.sample ? { ...s, description: t('demoPdf') } : s)),
    }),
    plugins: async () => structuredClone(plugins),
    async inspect(source) {
      const m = source.match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/);
      if (!m) return { code: 1, output: t('demoOnlyGithub') };
      const res = await github(`/repos/${m[1]}/${m[2]}/git/trees/HEAD?recursive=1`);
      if (!res.ok) return { code: 1, output: t(res.status === 404 ? 'repoNotFound' : 'githubDown') };
      const paths = (await res.json()).tree.map((f) => f.path);
      const names = [...new Set(paths.filter((p) => /(^|\/)SKILL\.md$/.test(p)).map((p) => p.split('/').at(-2) || m[2]))];
      // The demo does not download the manifests, so it assumes one plugin named after the repository.
      const marketplaces = {};
      if (paths.includes('.claude-plugin/marketplace.json')) marketplaces.claude = m[2];
      if (paths.includes('.agents/plugins/marketplace.json')) marketplaces.codex = m[2];
      return {
        code: 0,
        skills: names.filter((n) => SKILL_NAME.test(n)).map((name) => ({ name, description: '' })),
        plugins: Object.keys(marketplaces).length ? [{ name: m[2], description: '', marketplaces }] : [],
        repo: `${m[1]}/${m[2]}`,
      };
    },
    async pluginAdd({ plugins: wanted, agents: ids }) {
      await wait();
      for (const p of wanted) {
        for (const id of ids.filter((a) => p.marketplaces[a])) {
          const pid = `${p.name}@${p.marketplaces[id]}`;
          if (!plugins[id].plugins.some((x) => x.id === pid)) {
            plugins[id].plugins.push({ id: pid, name: p.name, marketplace: p.marketplaces[id], version: '', enabled: true, removable: true, skills: [] });
          }
        }
      }
      return { code: 0, output: '' };
    },
    async pluginRemove({ agent, id }) {
      await wait();
      plugins[agent].plugins = plugins[agent].plugins.filter((p) => p.id !== id);
      return { code: 0, output: '' };
    },
    async add({ source, skills: names, agents: ids, copy }) {
      await wait();
      for (const name of names) {
        let skill = skills.find((s) => s.name === name);
        if (!skill) {
          skill = { name, description: '', hubDir: `~/.skill-installer/skills/${name}`, source, agents: blank() };
          skills.push(skill);
          skills.sort((a, b) => a.name.localeCompare(b.name));
        }
        for (const id of ids) skill.agents[id] = copy ? 'copy' : 'link';
      }
      return { code: 0, output: '' };
    },
    async remove({ name, agents: ids }) {
      await wait();
      const i = skills.findIndex((s) => s.name === name);
      for (const id of ids) skills[i].agents[id] = '-';
      if (ids.length === 0 || Object.values(skills[i].agents).every((m) => m === '-')) skills.splice(i, 1);
      return { code: 0, output: '' };
    },
  };
}

const backend = isLocal ? localBackend : createDemoBackend();

// ---------- state ----------

let view = { agents: [], skills: null };
let query = '';        // the name last searched for
let results = null;    // repositories found for that name
let picker = null;     // { source, repo, skills, plugins, selected, pluginsSelected, agents, copy, error }
let finding = false;
let tab = null;        // id of the agent being shown
let kind = 'skills';   // which list of that agent is shown: 'skills' | 'plugins'
let plugins = null;    // per agent: { plugins } | { error }; null while loading
let pluginsStale = true;
let busy = null;       // key of the running change
let confirming = null; // 'skill:<name>' or 'plugin:<id>' waiting for a second click
let notice = null;     // { kind, text, output, action }

const installedIn = (id) => view.skills.filter((s) => s.agents[id] !== '-');
const countIn = (agent) => installedIn(agent.id).length + agent.others.length;
const usable = (agent) => agent.detected || countIn(agent) > 0;
const list = (items) => items.join(t('sep'));
const labels = (ids) => list(ids.map((id) => view.agents.find((a) => a.id === id)?.label ?? id));

async function refresh() {
  try {
    view = await backend.state();
    if (!view.agents.some((a) => a.id === tab && usable(a))) tab = view.agents.find(usable)?.id ?? null;
  } catch (e) {
    notice = { kind: 'error', text: e.message };
  }
  render();
  if (pluginsStale) loadPlugins();
}

// Asking each tool for its plugins is slow, so it only happens at start and after a plugin change.
async function loadPlugins() {
  pluginsStale = false;
  try {
    plugins = await backend.plugins();
  } catch (e) {
    plugins = {};
    notice = { kind: 'error', text: e.message };
  }
  render();
}

function render() {
  const btn = $('find-btn');
  btn.textContent = t(finding ? 'finding' : 'find');
  btn.disabled = finding || Boolean(busy);
  renderFinder();
  renderNotice();
  renderAgents();
}

// Runs one change, then reports it. okText describes the result when it worked.
async function perform(key, job, okText, failText, retry) {
  if (busy) return false;
  busy = key;
  confirming = null;
  notice = null;
  render();
  try {
    const r = await job();
    if (r.code === 0) {
      notice = { kind: 'ok', text: okText, output: r.output };
      return true;
    }
    if (retry && /skipped/.test(r.output)) {
      notice = { kind: 'warn', text: t('skippedText'), output: r.output, action: { label: t('overwrite'), run: retry } };
    } else {
      notice = { kind: 'error', text: failText, output: r.output };
    }
    return false;
  } catch (e) {
    notice = { kind: 'error', text: e.message };
    return false;
  } finally {
    busy = null;
    await refresh();
  }
}

// job(force) installs; when something of the user's is in the way, the notice offers job(true).
async function install(key, job, okText, failText, after) {
  const ok = await perform(key, () => job(false), okText, failText,
    () => install(key, () => job(true), okText, failText, after));
  if (ok && after) {
    after();
    render();
  }
}

// ---------- find: search by name, or open an address ----------

function showSourceError(text) {
  const el = $('source-error');
  el.textContent = text || '';
  el.hidden = !text;
}

async function find(event) {
  event.preventDefault();
  const text = $('source').value.trim();
  if (!text) return showSourceError(t('needInput'));
  if (text.startsWith('-')) return showSourceError(t('noDash'));
  results = null;
  picker = null;
  if (!isSearch(text)) {
    query = '';
    return openSource(text);
  }
  showSourceError('');
  query = text;
  finding = true;
  render();
  try {
    const found = await searchGitHub(text);
    if (found.length) results = found;
    else showSourceError(t('nothingFound', text));
  } catch (e) {
    showSourceError(e.message);
  }
  finding = false;
  render();
}

// Reads what a source contains and shows it for confirmation. Installs nothing.
async function openSource(source) {
  showSourceError('');
  picker = null;
  finding = true;
  render();
  try {
    const r = await backend.inspect(source);
    if (r.code !== 0) showSourceError((r.output || '').replace(/^Error:\s*/, '') || t('cantRead'));
    else if (r.skills.length === 0 && r.plugins.length === 0) showSourceError(t('nothingInside'));
    else {
      const q = query.toLowerCase();
      const near = (s) => Boolean(q) && s.name.toLowerCase().includes(q);
      const skills = [...r.skills].sort((a, b) => near(b) - near(a));
      // Nothing is preselected when the source also offers a plugin: the user picks one kind.
      const preselect = r.plugins.length ? []
        : skills.length === 1 ? skills : skills.filter((s) => s.name.toLowerCase() === q);
      picker = {
        source,
        repo: r.repo,
        skills,
        plugins: r.plugins,
        selected: new Set(preselect.map((s) => s.name)),
        pluginsSelected: new Set(),
        agents: new Set(view.agents.filter((a) => a.detected).map((a) => a.id)),
        copy: false,
        error: '',
      };
    }
  } catch (e) {
    showSourceError(e.message);
  }
  finding = false;
  render();
}

function syncInstallButton() {
  const btn = $('install-btn');
  if (!btn) return;
  const n = picker.selected.size + picker.pluginsSelected.size;
  btn.textContent = busy === 'install' ? t('installing')
    : n === 0 ? t('pickSomething')
    : picker.agents.size === 0 ? t('pickAgent')
    : t('installTo', picker.agents.size);
  btn.disabled = Boolean(busy) || n === 0 || picker.agents.size === 0;
}

const toggleIn = (set, value) => (e) => {
  if (e.target.checked) set.add(value); else set.delete(value);
  syncInstallButton();
};

function submitInstall() {
  const { source, repo, copy } = picker;
  const names = [...picker.selected];
  const agents = [...picker.agents];
  const chosen = picker.plugins.filter((p) => picker.pluginsSelected.has(p.name))
    .map(({ name, marketplaces }) => ({ name, marketplaces }));
  // A plugin only goes into the tools its author packaged it for.
  const stuck = chosen.find((p) => !agents.some((id) => p.marketplaces[id]));
  if (stuck) {
    picker.error = t('pluginStuck', stuck.name, labels(Object.keys(stuck.marketplaces)));
    return render();
  }
  const pluginAgents = agents.filter((id) => chosen.some((p) => p.marketplaces[id]));
  const done = (names.length ? t('doneSkills', list(names), labels(agents)) : '')
    + (chosen.length ? t('donePlugins', list(chosen.map((p) => p.name)), labels(pluginAgents)) : '');
  install('install', async (force) => {
    const runs = [];
    if (names.length) runs.push(await backend.add({ source, skills: names, agents, copy, force }));
    if (chosen.length) {
      runs.push(await backend.pluginAdd({ repo, plugins: chosen, agents: pluginAgents }));
      pluginsStale = true;
    }
    return { code: runs.find((r) => r.code !== 0)?.code ?? 0, output: runs.map((r) => r.output).filter(Boolean).join('\n') };
  }, done + t('newSession'), t('installFailed'), () => {
    picker = null;
    results = null;
    $('source').value = '';
    if (!agents.includes(tab)) tab = agents[0];
    kind = names.length ? 'skills' : 'plugins';
  });
}

function resultRow(r) {
  const description = r.official ? t('officialDesc', r.officialFor) : r.description;
  return h('li', { class: 'row' },
    h('div', { class: 'row-info' },
      h('p', { class: 'row-title' },
        h('span', { class: 'title-4 mono' }, r.repo),
        r.official && h('span', { class: 'chip live caption-4' }, t('official'))),
      description && h('p', { class: 'clamp body-6 muted' }, description),
      h('p', { class: 'caption-5 muted' },
        r.stars != null && `${t('stars', r.stars.toLocaleString(t('locale')))} · `,
        h('a', { class: 'link', href: `https://github.com/${r.repo}`, target: '_blank', rel: 'noopener noreferrer' }, t('viewOnGithub')))),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy), onclick: () => openSource(r.repo) }, t('lookInside'))));
}

function pickerView() {
  const connected = view.agents.filter((a) => a.detected);
  const option = (set, item, extra) => h('label', { class: 'option' },
    h('input', { type: 'checkbox', checked: set.has(item.name), disabled: extra === false, onchange: toggleIn(set, item.name) }),
    h('span', { class: 'option-text' },
      h('span', { class: 'title-4' }, item.name),
      item.description && h('span', { class: 'clamp body-6 muted' }, item.description),
      extra && h('span', { class: 'caption-5 muted' }, extra)));
  return h('div', { class: 'picker' },
    h('p', { class: 'wrap title-4' }, t('pickerTitle', picker.source, picker.skills.length, picker.plugins.length)),
    picker.plugins.length > 0 && h('div', { class: 'picker-group' },
      h('p', { class: 'title-4' }, t('plugins')),
      h('p', { class: 'caption-2 muted' }, t(picker.repo ? 'pluginHelp' : 'pluginNoRepo')),
      h('div', { class: 'options' }, picker.plugins.map((p) => option(picker.pluginsSelected, p,
        picker.repo ? t('pluginVersions', labels(Object.keys(p.marketplaces))) : false)))),
    picker.skills.length > 0 && h('div', { class: 'picker-group' },
      h('p', { class: 'title-4' }, t('skills')),
      h('div', { class: 'options' }, picker.skills.map((s) => option(picker.selected, s)))),
    h('div', { class: 'picker-group' },
      h('p', { class: 'title-4' }, t('installToConnected')),
      connected.length === 0
        ? h('p', { class: 'body-6 error' }, t('noAgents'))
        : h('div', { class: 'pills' }, connected.map((a) => h('label', { class: 'pill' },
          h('input', { type: 'checkbox', checked: picker.agents.has(a.id), onchange: toggleIn(picker.agents, a.id) }),
          h('span', { class: 'body-6' }, a.label))))),
    h('p', { class: 'caption-2 muted' }, t('trustNote')),
    picker.error && h('p', { class: 'caption-2 error' }, picker.error),
    h('div', { class: 'picker-foot' },
      h('label', { class: 'pill' },
        h('input', { type: 'checkbox', checked: picker.copy, onchange: (e) => { picker.copy = e.target.checked; } }),
        h('span', { class: 'body-6' }, t('copyInstead'))),
      h('div', { class: 'actions' },
        results && h('button', { class: 'btn btn-ghost button-md', type: 'button', onclick: () => { picker = null; render(); } }, t('backToResults')),
        h('button', { class: 'btn btn-primary button-md', id: 'install-btn', type: 'button', onclick: submitInstall }))));
}

function renderFinder() {
  const root = $('finder');
  if (finding) return root.replaceChildren(h('div', { class: 'picker' }, h('div', { class: 'skeleton' })));
  if (picker) {
    root.replaceChildren(pickerView());
    return syncInstallButton();
  }
  if (!results) return root.replaceChildren();
  root.replaceChildren(h('div', { class: 'picker' },
    h('div', { class: 'picker-group' },
      h('p', { class: 'title-4' }, t('resultsTitle', query)),
      h('p', { class: 'caption-2 muted' }, t('resultsNote'))),
    h('ul', { class: 'rows' }, results.map(resultRow))));
}

// ---------- notice ----------

function renderNotice() {
  const root = $('notice');
  if (!notice) return root.replaceChildren();
  const { kind: level, text, output, action } = notice;
  root.replaceChildren(h('div', { class: `card notice ${level}` },
    h('div', { class: 'notice-head' },
      icon(level === 'ok' ? 'check' : 'warning'),
      h('p', { class: 'notice-text body-6' }, text),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('closeNotice'), onclick: () => { notice = null; render(); } }, icon('x'))),
    level !== 'ok' && output && h('pre', { class: 'log' }, output),
    action && h('div', { class: 'notice-actions' },
      h('button', { class: 'btn btn-danger button-sm', type: 'button', disabled: Boolean(busy), onclick: action.run }, action.label))));
}

// ---------- skills and plugins per AI ----------

function addTo(skill, agent, okText) {
  install(`add:${skill.name}`,
    (force) => backend.add({ source: skill.hubDir, skills: [skill.name], agents: [agent.id], copy: false, force }),
    okText, t('notDone'));
}

function update(skill) {
  const modes = Object.entries(skill.agents).filter(([, mode]) => mode !== '-');
  install(`update:${skill.name}`, (force) => backend.add({
    source: skill.source,
    skills: [skill.name],
    agents: modes.map(([id]) => id),
    copy: modes.every(([, mode]) => mode === 'copy'),
    force,
  }), t('updated', skill.name), t('updateFailed'));
}

function removePlugin(plugin, agent) {
  pluginsStale = true;
  perform(`unplug:${plugin.id}`, () => backend.pluginRemove({ agent: agent.id, id: plugin.id }),
    t('pluginRemoved', agent.label, plugin.name), t('uninstallFailed'));
}

function removeFrom(skill, agent) {
  // The server removes the skill completely when this was the last AI that had it.
  perform(`remove:${skill.name}`, () => backend.remove({ name: skill.name, agents: [agent.id] }),
    t('removed', agent.label, skill.name), t('removeFailed'));
}

const MODE = { link: ['link', 'linked'], copy: ['copy', 'copied'], BROKEN: ['warning', 'broken'] };

function installedRow(skill, agent) {
  const mode = skill.agents[agent.id];
  const broken = mode === 'BROKEN';
  const [iconName, textKey] = MODE[mode];
  return h('li', { class: 'row' },
    h('div', { class: 'row-info' },
      h('p', { class: 'row-title' },
        h('span', { class: 'title-3' }, skill.name),
        h('span', { class: `chip caption-4${broken ? ' bad' : ''}` }, icon(iconName), t(textKey))),
      skill.description && h('p', { class: 'clamp body-6 muted' }, skill.description),
      h('p', { class: 'wrap caption-5 muted mono' }, skill.source)),
    h('div', { class: 'actions' }, confirming === `skill:${skill.name}` ? [
      h('button', { class: 'btn btn-danger button-sm', type: 'button', onclick: () => removeFrom(skill, agent) }, t('confirmDelete')),
      h('button', { class: 'btn btn-ghost button-sm', type: 'button', onclick: () => { confirming = null; render(); } }, t('cancel')),
    ] : [
      broken
        ? h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy),
          onclick: () => addTo(skill, agent, t('repaired', agent.label, skill.name)) }, icon('refresh'), t('repair'))
        : h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy), onclick: () => update(skill) },
          icon('refresh'), t(busy === `update:${skill.name}` ? 'updating' : 'update')),
      h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy), onclick: () => { confirming = `skill:${skill.name}`; render(); } },
        icon('trash'), t(busy === `remove:${skill.name}` ? 'deleting' : 'delete')),
    ]));
}

function pluginRow(plugin, agent) {
  return h('li', { class: 'row' },
    h('div', { class: 'row-info' },
      h('p', { class: 'row-title' },
        h('span', { class: 'title-3' }, plugin.name),
        plugin.version && h('span', { class: 'chip caption-4' }, plugin.version),
        !plugin.enabled && h('span', { class: 'chip bad caption-4' }, t('disabled')),
        !plugin.removable && h('span', { class: 'chip caption-4' }, t('readOnly'))),
      plugin.skills.length > 0 && h('p', { class: 'clamp body-6 muted' }, t('contains', plugin.skills.length, list(plugin.skills))),
      plugin.marketplace && h('p', { class: 'wrap caption-5 muted mono' }, t('from', plugin.marketplace))),
    plugin.removable && h('div', { class: 'actions' }, confirming === `plugin:${plugin.id}` ? [
      h('button', { class: 'btn btn-danger button-sm', type: 'button', onclick: () => removePlugin(plugin, agent) }, t('confirmUninstall')),
      h('button', { class: 'btn btn-ghost button-sm', type: 'button', onclick: () => { confirming = null; render(); } }, t('cancel')),
    ] : h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy), onclick: () => { confirming = `plugin:${plugin.id}`; render(); } },
      icon('trash'), t(busy === `unplug:${plugin.id}` ? 'uninstalling' : 'uninstall'))));
}

const emptyBox = (title, help) => h('div', { class: 'empty' },
  h('p', { class: 'title-3' }, title), h('p', { class: 'wrap body-6 muted' }, help));

// The plugins of one AI, as its own plugin command reports them.
function pluginPanel(agent) {
  if (plugins === null) return [h('div', { class: 'skeleton' })];
  const mine = plugins[agent.id];
  if (!mine) return [emptyBox(t('noPluginSupport', agent.label), t('noPluginSupportHelp'))];
  if (mine.error) return [emptyBox(t('cantReadPlugins', agent.label), mine.error)];
  if (mine.plugins.length === 0) return [emptyBox(t('noPlugins', agent.label), t('noPluginsHelp'))];
  // The ones the user can remove come first; the rest ship with the tool or its official catalog.
  const sorted = [...mine.plugins].sort((a, b) => b.removable - a.removable);
  return [
    h('p', { class: 'caption-5 muted' }, t('pluginListNote', agent.label)
      + (sorted.some((p) => !p.removable) ? t('readOnlyNote', agent.label) : '')),
    h('ul', { class: 'rows' }, sorted.map((p) => pluginRow(p, agent))),
  ];
}

const plainRow = (skill, action) => h('li', { class: 'row' },
  h('div', { class: 'row-info' },
    h('p', { class: 'title-3' }, skill.name),
    skill.description && h('p', { class: 'clamp body-6 muted' }, skill.description)),
  action && h('div', { class: 'actions' }, action));

function agentPanel(agent) {
  const mine = installedIn(agent.id);
  const addable = view.skills.filter((s) => s.agents[agent.id] === '-');
  const pluginCount = plugins?.[agent.id]?.plugins?.length;
  const choice = (id, text, count) => h('button', {
    class: 'button-sm', type: 'button', 'aria-pressed': String(kind === id),
    onclick: () => { kind = id; confirming = null; render(); },
  }, text, count != null && h('span', { class: 'count caption-4' }, String(count)));
  const head = h('div', { class: 'seg', role: 'group', 'aria-label': t('segLabel') },
    choice('skills', t('skills'), countIn(agent)), choice('plugins', t('plugins'), pluginCount));
  if (kind === 'plugins') return h('div', { class: 'panel', role: 'tabpanel' }, head, pluginPanel(agent));
  return h('div', { class: 'panel', role: 'tabpanel' },
    head,
    h('div', { class: 'row-info' },
      h('p', { class: 'wrap caption-5 muted mono' }, agent.skillsDir),
      h('p', { class: 'caption-5 muted' }, t('skillsFolderNote'))),
    mine.length === 0 && agent.others.length === 0 && h('div', { class: 'empty' },
      h('p', { class: 'title-3' }, t('noSkills', agent.label)),
      h('p', { class: 'body-6 muted' }, t('noSkillsHelp')),
      h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy) || finding,
        onclick: () => { $('source').value = OFFICIAL; $('add-form').requestSubmit(); $('source').focus(); } }, t('seeOfficial'))),
    mine.length > 0 && h('ul', { class: 'rows' }, mine.map((s) => installedRow(s, agent))),
    agent.others.length > 0 && h('div', { class: 'group' },
      h('h3', { class: 'title-4' }, t('notOurs', agent.others.length)),
      h('p', { class: 'caption-2 muted' }, t('notOursHelp')),
      h('ul', { class: 'rows' }, agent.others.map((s) => plainRow(s)))),
    addable.length > 0 && agent.detected && h('div', { class: 'group' },
      h('h3', { class: 'title-4' }, t('addable')),
      h('ul', { class: 'rows' }, addable.map((s) => plainRow(s,
        h('button', { class: 'btn btn-ghost button-sm', type: 'button', disabled: Boolean(busy),
          onclick: () => addTo(s, agent, t('addedTo', s.name, agent.label)) },
        icon('plus'), t(busy === `add:${s.name}` ? 'adding' : 'add')))))));
}

function renderAgents() {
  const root = $('agents');
  if (view.skills === null) return root.replaceChildren(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
  const agent = view.agents.find((a) => a.id === tab);
  root.replaceChildren(
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': t('chooseAi') }, view.agents.map((a) => h('button', {
      class: 'tab button-sm', type: 'button', role: 'tab',
      'aria-selected': String(a.id === tab), disabled: !usable(a),
      onclick: () => { tab = a.id; confirming = null; render(); },
    }, a.label, !usable(a) && h('span', { class: 'count caption-4' }, t('notConnected'))))),
    agent ? agentPanel(agent) : emptyBox(t('noAgentsTitle'), t('noAgentsHelp')));
}

// ---------- page motion (demo page only) ----------

// How a tagline word becomes fully visible. Without scroll motion it simply is.
let showWord = (el) => el.classList.add('on');

function startMotion() {
  const revealer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); }
    }
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Words on one line cross the trigger together, so stagger them in reading order.
  const words = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = `${i * 110}ms`;
      e.target.classList.add('on');
      words.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -30% 0px' });
  showWord = (el) => words.observe(el);
}

// ---------- language ----------

// Fills every static text of the page from the current language.
function applyLanguage() {
  document.documentElement.lang = t('locale');
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  $('source').placeholder = t('placeholder');
  $('lang-btn').textContent = t('langBtn');
  const chip = $('mode-chip');
  chip.textContent = t(isLocal ? 'chipLocal' : 'chipDemo');
  chip.classList.toggle('live', isLocal);
  // The tagline is built word by word so each word can light up on scroll.
  $('tagline').replaceChildren(...t('tagline').flatMap((line, i) => [
    i > 0 && h('br'),
    ...line.flatMap((word, j) => {
      const span = h('span', { class: 'w' }, word);
      showWord(span);
      return [j > 0 && t('wordSep'), span];
    }),
  ]).filter(Boolean));
}

function switchLanguage() {
  lang = lang === 'zh' ? 'en' : 'zh';
  try { localStorage.setItem('lang', lang); } catch { /* private mode: the choice lasts for this visit */ }
  // Messages already on screen were written in the old language.
  notice = null;
  showSourceError('');
  if (picker) picker.error = '';
  applyLanguage();
  render();
  if (!isLocal) refresh(); // the demo's sample descriptions follow the language
}

// ---------- start ----------

$('add-form').addEventListener('submit', find);
$('source').addEventListener('input', () => showSourceError(''));
$('lang-btn').addEventListener('click', switchLanguage);
if (isLocal) window.addEventListener('focus', () => { if (!busy) refresh(); });
else startMotion();
applyLanguage();
render();
refresh();
