import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 15)) { console.error('Lecture Ledger requires Node.js 24.15 or newer. Run ./start.sh to use the bundled runtime on this computer.'); process.exit(1); }
process.env.PATH = dirname(process.execPath) + (process.platform === 'win32' ? ';' : ':') + process.env.PATH;
function runNpm(args) { const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status || 1); }
if (!existsSync(join(root, 'node_modules/vite/package.json'))) runNpm(['ci', '--no-audit', '--no-fund']);
const hash = createHash('sha256');
function add(filename) { hash.update(filename); hash.update(readFileSync(join(root, filename))); }
function tree(directory) { for (const entry of readdirSync(join(root, directory), { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) { const name = join(directory, entry.name); if (entry.isDirectory()) tree(name); else if (entry.isFile()) add(name); } }
for (const folder of ['app', 'lib', 'src', 'public']) tree(folder);
for (const filename of ['index.html', 'vite.config.ts', 'postcss.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json']) add(filename);
const fingerprint = hash.digest('hex');
const marker = join(root, 'dist/.source-hash');
if (!existsSync(join(root, 'dist/index.html')) || !existsSync(marker) || readFileSync(marker,'utf8') !== fingerprint) { runNpm(['run','build']); writeFileSync(marker, fingerprint); }
const { startLedger } = await import('../server/index.mjs');
try {
  const app = await startLedger({ port: Number(process.env.PORT || 3000) });
  console.log(`\nLecture Ledger is running at ${app.origin}/`);
  console.log(`Your database: ${app.store.filename}`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) { console.error(error.code === 'EADDRINUSE' ? 'That local port is in use. Choose another with PORT=3001 ./start.sh.' : error.message); process.exitCode = 1; }
