// Stand-in for the `claude` and `codex` CLIs in tests: fake-tool.mjs <tool> plugin ...
// Records every call in FAKE_TOOL_DIR/calls.log and keeps its "installed" list there too.
import fs from 'node:fs';
import path from 'node:path';

const [tool, ...args] = process.argv.slice(2);
const dir = process.env.FAKE_TOOL_DIR;
fs.appendFileSync(path.join(dir, 'calls.log'), `${tool} ${args.join(' ')}\n`);

const file = path.join(dir, `${tool}.json`);
const installed = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
const save = (list) => fs.writeFileSync(file, JSON.stringify(list));
const fail = (message) => { console.error(`Error: ${message}`); process.exit(1); };
const command = args.filter((a) => !a.startsWith('--')).slice(0, 3).join(' ');

if (tool === 'claude') {
  if (command === 'plugin list') {
    console.log(JSON.stringify(installed.map((id) => ({ id, version: '1.0.0', scope: 'user', enabled: true, installPath: dir }))));
  } else if (command.startsWith('plugin install')) {
    if (args[2] === 'broken') fail('plugin "broken" could not be installed');
    save([...new Set([...installed, `${args[2]}@fake-market`])]);
    console.log(JSON.stringify({ outcome: 'ok' }));
  } else if (command.startsWith('plugin uninstall')) {
    save(installed.filter((id) => id !== args[2]));
    console.log(JSON.stringify({ outcome: 'ok' }));
  } else fail(`unexpected: ${args.join(' ')}`);
} else if (tool === 'codex') {
  if (command === 'plugin list') {
    console.log(JSON.stringify({
      installed: [
        { pluginId: 'pdf@openai-bundled', name: 'pdf', marketplaceName: 'openai-bundled', version: '2.0.0', enabled: true },
        ...installed.map((id) => ({ pluginId: id, name: id.split('@')[0], marketplaceName: id.split('@')[1], version: '1.0.0', enabled: true })),
      ],
      available: [],
    }));
  } else if (command.startsWith('plugin marketplace add')) {
    console.log('Added marketplace');
  } else if (command.startsWith('plugin add')) {
    save([...new Set([...installed, args[2]])]);
    console.log(JSON.stringify({ pluginId: args[2] }));
  } else if (command.startsWith('plugin remove')) {
    save(installed.filter((id) => id !== args[2]));
    console.log(JSON.stringify({ pluginId: args[2] }));
  } else fail(`unexpected: ${args.join(' ')}`);
} else fail(`unknown tool ${tool}`);
