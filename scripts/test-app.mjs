import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { projectRoot as root } from '../server/config.mjs';
import { desktopEntry } from './app.mjs';
import { startLedger } from '../server/index.mjs';

const execute = promisify(execFile);
const control = join(root, 'scripts/app.mjs');
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'ledger-controls-'));
  const env = { ...process.env, LEDGER_CONFIG_PATH: join(folder, 'config.json'), LEDGER_RUNTIME_DIR: join(folder, 'runtime'), LEDGER_DB_PATH: join(folder, 'data.sqlite'), LEDGER_NODE_BIN: process.execPath };
  delete env.PORT;
  const run = (...args) => execute(process.execPath, [control, ...args], { cwd: root, env, timeout: 45_000 });
  return { folder, env, run, state: join(env.LEDGER_RUNTIME_DIR, 'running.json'), async clean() { await run('stop'); await rm(folder, { recursive: true, force: true }); } };
}
async function occupyPort() {
  const server = createServer((request, response) => { response.end('Another application'); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { server, port: server.address().port, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}

test('background open, port fallback, repeat open and safe shutdown preserve the timetable', { timeout: 90_000 }, async () => {
  const app = await fixture();
  const other = await occupyPort();
  try {
    await app.run('port', String(other.port));
    const opened = await app.run('open', '--no-browser');
    assert.match(opened.stdout, /You can close this terminal/);
    let state = JSON.parse(await readFile(app.state, 'utf8'));
    assert.notEqual(Number(new URL(state.origin).port), other.port);
    assert.equal((await fetch(state.origin)).status, 200);
    const saved = { schemaVersion: 2, term: { name: 'Launcher test', start: '2026-10-12', end: '2026-11-02', timezone: 'Europe/London' }, courses: [], lectures: [], completed: {} };
    assert.equal((await fetch(state.origin + '/api/planner', { method: 'PUT', headers: { Origin: state.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: saved, revision: 0 }) })).status, 200);
    assert.match((await app.run('status')).stdout, new RegExp(state.origin));
    await app.run('open', '--no-browser');
    assert.equal(JSON.parse(await readFile(app.state, 'utf8')).token, state.token);
    // A changed preference does not lose the address of the app that is already running.
    await app.run('port', String(other.port));
    if (process.platform !== 'win32') {
      assert.equal((await stat(app.state)).mode & 0o777, 0o600);
      assert.equal((await stat(app.env.LEDGER_RUNTIME_DIR)).mode & 0o777, 0o700);
    }
    assert.equal((await fetch(state.origin + '/api/control/shutdown', { method: 'POST' })).status, 403);
    assert.equal((await fetch(state.origin + '/api/control/shutdown', { method: 'POST', headers: { Authorization: 'Bearer wrong' } })).status, 403);
    assert.equal((await fetch(state.origin + '/api/control/shutdown', { method: 'POST', headers: { Authorization: `Bearer ${state.token}`, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.match((await app.run('stop')).stdout, /shut down/);
    await assert.rejects(fetch(state.origin));
    assert.equal(await (await fetch(other.origin)).text(), 'Another application');
    assert.match((await app.run('stop')).stdout, /already stopped/);
    await app.run('open', '--no-browser');
    state = JSON.parse(await readFile(app.state, 'utf8'));
    const persisted = await (await fetch(state.origin + '/api/planner')).json();
    assert.deepEqual(persisted.data, saved);
    assert.equal(persisted.revision, 1);
  } finally { await app.clean(); await other.close(); }
});

test('simultaneous opens start one app and abandoned launch locks recover', { timeout: 90_000 }, async () => {
  const app = await fixture();
  try {
    await mkdir(join(app.env.LEDGER_RUNTIME_DIR, 'launch.lock'), { recursive: true });
    await writeFile(join(app.env.LEDGER_RUNTIME_DIR, 'launch.lock/owner.json'), JSON.stringify({ pid: 2147483647, owner: 'abandoned' }));
    await Promise.all([app.run('open', '--no-browser'), app.run('open', '--no-browser')]);
    const record = JSON.parse(await readFile(app.state, 'utf8'));
    assert.match((await app.run('status')).stdout, new RegExp(record.origin));
    assert.equal((await fetch(record.origin + '/api/planner')).status, 200);
    await assert.rejects(stat(join(app.env.LEDGER_RUNTIME_DIR, 'launch.lock')), { code: 'ENOENT' });
  } finally { await app.clean(); }
});

test('invalid port/configuration fails before creating a database; explicit PORT never falls back', { timeout: 90_000 }, async () => {
  const app = await fixture();
  const other = await occupyPort();
  try {
    for (const value of ['0', '-1', '65536', 'abc', '3e3', '3000.5', '']) await assert.rejects(app.run('port', value), /Choose a port/);
    for (const value of [null, true, [], [3000], {}]) {
      await writeFile(app.env.LEDGER_CONFIG_PATH, JSON.stringify({ port: value }));
      await assert.rejects(app.run('open', '--no-browser'), /Choose a port/);
    }
    await assert.rejects(app.run('open', 'unexpected', '--no-browser'), /Unexpected argument/);
    await writeFile(app.env.LEDGER_CONFIG_PATH, '{broken');
    await assert.rejects(app.run('open', '--no-browser'), /valid JSON/);
    await assert.rejects(stat(app.env.LEDGER_DB_PATH), { code: 'ENOENT' });
    await app.run('port', String(other.port));
    await assert.rejects(execute(process.execPath, [join(root, 'scripts/start.mjs')], { cwd: root, env: { ...app.env, PORT: String(other.port) }, timeout: 45_000 }), /local port is in use/);
    assert.equal(await (await fetch(other.origin)).text(), 'Another application');
    await assert.rejects(stat(app.state), { code: 'ENOENT' });
  } finally { await app.clean(); await other.close(); }
});

test('stale state pointing at an unrelated server never shuts it down', { timeout: 30_000 }, async () => {
  const app = await fixture();
  const other = await occupyPort();
  try {
    await mkdir(app.env.LEDGER_RUNTIME_DIR);
    const stale = { root, pid: process.pid, origin: other.origin, token: 'a'.repeat(64), databasePath: app.env.LEDGER_DB_PATH };
    await writeFile(app.state, JSON.stringify(stale));
    await assert.rejects(app.run('stop'), /not responding/);
    assert.equal(await (await fetch(other.origin)).text(), 'Another application');
    stale.pid = 2147483647;
    await writeFile(app.state, JSON.stringify(stale));
    assert.match((await app.run('stop')).stdout, /already stopped/);
    assert.equal(await (await fetch(other.origin)).text(), 'Another application');
  } finally { await rm(app.state, { force: true }); await app.clean(); await other.close(); }
});

test('foreground browser startup can be stopped with app.sh and Ctrl+C cleans up its state', { timeout: 90_000 }, async () => {
  const app = await fixture();
  let child;
  async function foreground() {
    child = spawn(process.execPath, [join(root, 'scripts/start.mjs')], { cwd: root, env: app.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const exit = new Promise(done => child.once('exit', code => done(code)));
    for (let attempt = 0; attempt < 200; attempt++) {
      try { await readFile(app.state); return { exit }; } catch { /* Wait for startup. */ }
      if (child.exitCode !== null) throw new Error('Foreground startup failed: ' + output);
      await delay(100);
    }
    throw new Error('Foreground startup timed out.');
  }
  try {
    const ready = await foreground();
    await execute(join(root, 'app.sh'), ['stop'], { cwd: root, env: app.env, timeout: 20_000 });
    assert.equal(await ready.exit, 0);
    const interrupted = await foreground();
    child.kill('SIGINT');
    assert.equal(await interrupted.exit, 0);
    await assert.rejects(stat(app.state), { code: 'ENOENT' });
  } finally { child?.kill('SIGTERM'); await app.clean(); }
});

test('desktop shortcut actions and graphical controls use the same persistent settings', { timeout: 30_000 }, async () => {
  const app = await fixture();
  try {
    const desktop = join(app.folder, 'Desktop with spaces');
    await mkdir(desktop);
    const previous = join(desktop, 'Lecture Ledger.desktop');
    await writeFile(previous, desktopEntry().replace('Name=Lecture Tracker', 'Name=Lecture Ledger'));
    await app.run('install-shortcut', desktop);
    await assert.rejects(stat(previous), { code: 'ENOENT' });
    const filename = join(desktop, 'Lecture Tracker.desktop');
    const entry = await readFile(filename, 'utf8');
    // A shortcut belonging to another checkout must survive the rename cleanup.
    const other = desktopEntry(join(app.folder, 'other-checkout'));
    await writeFile(previous, other);
    await app.run('install-shortcut', desktop);
    assert.equal(await readFile(previous, 'utf8'), other);
    assert.match(entry, /desktop\.sh/);
    assert.match(entry, /--quit/);
    assert.match(entry, /--settings/);
    if (process.platform === 'linux') await execute('desktop-file-validate', [filename]);
    const unusual = join(app.folder, 'Ledger $folder % with spaces');
    await writeFile(filename, desktopEntry(unusual));
    if (process.platform === 'linux') await execute('desktop-file-validate', [filename]);
    const bin = join(app.folder, 'bin'); await mkdir(bin);
    const zenity = join(bin, 'zenity');
    await writeFile(zenity, '#!/bin/sh\ncase "$1" in\n  --list) printf "Configure port\\n" ;;\n  --entry) printf "3100\\n" ;;\nesac\n');
    await chmod(zenity, 0o755);
    await execute(process.execPath, [control, 'menu'], { cwd: root, env: { ...app.env, PATH: bin + ':' + app.env.PATH }, timeout: 10_000 });
    assert.equal(JSON.parse(await readFile(app.env.LEDGER_CONFIG_PATH, 'utf8')).port, 3100);
    await writeFile(zenity, '#!/bin/sh\nexit 1\n');
    await execute(process.execPath, [control, 'port', '--gui'], { cwd: root, env: { ...app.env, PATH: bin + ':' + app.env.PATH }, timeout: 10_000 });
    assert.equal(JSON.parse(await readFile(app.env.LEDGER_CONFIG_PATH, 'utf8')).port, 3100);
  } finally { await app.clean(); }
});

test('graceful close releases a port even when a client leaves an unfinished request', { timeout: 15_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ledger-close-'));
  const app = await startLedger({ port: 0, databasePath: join(folder, 'data.sqlite') });
  const { connect } = await import('node:net');
  const socket = connect(Number(new URL(app.origin).port), '127.0.0.1');
  try {
    await new Promise(done => socket.once('connect', done));
    socket.write(`GET / HTTP/1.1\r\nHost: ${new URL(app.origin).host}\r\n`);
    await delay(50);
    await app.close();
    await assert.rejects(fetch(app.origin));
  } finally { socket.destroy(); await app.close(); await rm(folder, { recursive: true, force: true }); }
});
