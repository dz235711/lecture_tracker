import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { projectRoot as root } from '../server/config.mjs';

export function prepareBuild() {
  process.env.PATH = dirname(process.execPath) + (process.platform === 'win32' ? ';' : ':') + process.env.PATH;
  function runNpm(args) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`App preparation failed (${args.join(' ')}). Fix the error above and try again.`);
  }
  if (!existsSync(join(root, 'node_modules/vite/package.json')) || !existsSync(join(root, 'node_modules/electron/path.txt'))) runNpm(['ci', '--no-audit', '--no-fund']);
  const hash = createHash('sha256');
  function add(filename) { hash.update(filename); hash.update(readFileSync(join(root, filename))); }
  function tree(directory) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) tree(name); else if (entry.isFile()) add(name);
    }
  }
  for (const folder of ['app', 'lib', 'src', 'public', 'server', 'desktop']) tree(folder);
  for (const filename of ['index.html', 'vite.config.ts', 'vite.desktop.config.ts', 'postcss.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json']) add(filename);
  const fingerprint = hash.digest('hex');
  const marker = join(root, 'dist/.source-hash');
  if (!existsSync(join(root, 'dist/index.html')) || !existsSync(join(root, 'desktop-dist/server.mjs')) || !existsSync(marker) || readFileSync(marker, 'utf8') !== fingerprint) {
    runNpm(['run', 'build']);
    writeFileSync(marker, fingerprint);
  }
}
