import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, closeSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectRoot as root } from '../server/config.mjs';
import { prepareBuild } from './build.mjs';

try {
  if (process.argv.includes('--quit') && !existsSync(join(root, 'node_modules/electron/path.txt'))) process.exit(0);
  if (!process.argv.includes('--quit')) prepareBuild();
  const electron = createRequire(import.meta.url)('electron');
  const directory = resolve(root, process.env.LEDGER_RUNTIME_DIR || '.ledger'); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const log = openSync(join(directory, 'desktop.log'), 'a', 0o600);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [join(root, 'desktop/main.mjs'), ...process.argv.slice(2)], { cwd: root, env, detached: true, stdio: ['ignore', log, log] });
  closeSync(log);
  await new Promise((done, reject) => { child.once('spawn', done); child.once('error', reject); });
  child.unref();
} catch (error) {
  console.error(error.message);
  if (process.platform === 'linux') {
    const { spawnSync } = await import('node:child_process');
    spawnSync('zenity', ['--error', '--title=Lecture Ledger', '--text=' + error.message], { stdio: 'ignore' });
  }
  process.exitCode = 1;
}
