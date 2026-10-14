import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, closeSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectRoot as root } from '../server/config.mjs';
import { prepareBuild } from './build.mjs';

try {
  if (process.argv.includes('--quit') && !existsSync(join(root, 'node_modules/electron/path.txt'))) process.exit(0);
  if (!process.argv.includes('--quit')) prepareBuild();
  const electron = createRequire(import.meta.url)('electron');
  const directory = resolve(root, process.env.LEDGER_RUNTIME_DIR || '.ledger'); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const logPath = join(directory, 'desktop.log');
  const log = openSync(logPath, 'a', 0o600);
  const logStart = statSync(logPath).size;
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [root, ...process.argv.slice(2)], { cwd: root, env, detached: true, stdio: ['ignore', log, log, 'ipc'] });
  closeSync(log);
  await new Promise((done, reject) => {
    const timer = setTimeout(() => finish(new Error(`The app did not finish starting. See ${logPath} for details.`)), 30_000);
    const finish = error => { clearTimeout(timer); child.removeListener('exit', exited); child.removeListener('message', ready); child.removeListener('error', finish); if (child.connected) child.disconnect(); child.unref(); error ? reject(error) : done(); };
    const ready = message => { if (message?.type === 'ledger:ready') finish(); };
    const exited = (code, signal) => {
      if (code === 0) { finish(); return; } // Second-instance open/quit requests finish immediately.
      const output = readFileSync(logPath).subarray(logStart).toString('utf8');
      const sandboxBlocked = /setuid_sandbox_host|No usable sandbox/.test(output);
      finish(new Error(sandboxBlocked
        ? 'Ubuntu blocked the app’s secure sandbox. Enable desktop launching once by running ./setup-sandbox.sh from the Lecture Tracker folder, then open the app again. This requests administrator approval for this app only.'
        : `The app could not start (${signal || code}). See ${logPath} for details.`));
    };
    child.once('error', finish); child.once('exit', exited); child.on('message', ready);
  });
  child.unref();
} catch (error) {
  console.error(error.message);
  if (process.platform === 'linux' && process.env.LEDGER_DESKTOP_SMOKE !== '1') {
    const { spawnSync } = await import('node:child_process');
    spawnSync('zenity', ['--error', '--title=Lecture Tracker', '--text=' + error.message], { stdio: 'ignore' });
  }
  process.exitCode = 1;
}
