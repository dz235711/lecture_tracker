import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync, openSync, closeSync, chmodSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { projectRoot as root, readSettings, savePort, portOptions } from '../server/config.mjs';
import { prepareBuild } from './build.mjs';

const runtimeDirectory = resolve(root, process.env.LEDGER_RUNTIME_DIR || '.ledger');
const statePath = join(runtimeDirectory, 'running.json');
const logPath = join(runtimeDirectory, 'server.log');
const lockPath = join(runtimeDirectory, 'launch.lock');
function readJson(filename) {
  try { return JSON.parse(readFileSync(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Could not read ${filename}. Check this file before trying again.`); }
}
function privateDirectory() { mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 }); chmodSync(runtimeDirectory, 0o700); }
function processExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}
async function withLaunchLock(action) {
  privateDirectory();
  const deadline = Date.now() + 120_000;
  const owner = randomBytes(16).toString('hex');
  while (true) {
    try { mkdirSync(lockPath, { mode: 0o700 }); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    // A dead launcher may leave a lock. A live launcher keeps it during installation/build.
    try {
      const previous = readJson(join(lockPath, 'owner.json'));
      if ((previous && Number.isInteger(previous.pid) && previous.pid > 0 && !processExists(previous.pid)) || (!previous && Date.now() - statSync(lockPath).mtimeMs > 5000)) {
        rmSync(lockPath, { recursive: true, force: true }); continue;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (Date.now() >= deadline) throw new Error(`Another app control is still running. Wait for it to finish. Startup details: ${logPath}`);
    await delay(150);
  }
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, owner }), { mode: 0o600 });
  try { return await action(); }
  finally { if (readJson(join(lockPath, 'owner.json'))?.owner === owner) rmSync(lockPath, { recursive: true, force: true }); }
}
function validateRecord(record) {
  if (record.root !== root || !Number.isInteger(record.pid) || record.pid < 1 || !/^[a-f0-9]{64}$/.test(record.token) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(record.origin)) {
    throw new Error(`The saved app state is invalid. Check ${statePath} before trying again.`);
  }
  const port = Number(new URL(record.origin).port);
  if (port < 1 || port > 65535 || typeof record.databasePath !== 'string') throw new Error('The saved app address is invalid.');
}
function removeRecord(token) { if (readJson(statePath)?.token === token) rmSync(statePath, { force: true }); }
async function controlRequest(record, path, method = 'GET') {
  return fetch(record.origin + '/api/control/' + path, { method, headers: { Authorization: `Bearer ${record.token}` }, signal: AbortSignal.timeout(1500), redirect: 'error' });
}
export async function runningApp() {
  const record = readJson(statePath);
  if (!record) return null;
  validateRecord(record);
  try {
    const response = await controlRequest(record, 'status');
    const status = await response.json();
    if (!response.ok || status.app !== 'lecture-ledger' || status.instance !== record.token || status.databasePath !== record.databasePath) throw new Error('The running app did not match its saved identity.');
    return record;
  } catch {
    // Never signal a PID from disk: it could have been reused by another program.
    if (processExists(record.pid)) throw new Error(`The saved app is not responding. Try again shortly and check ${logPath}. No other process was stopped.`);
    removeRecord(record.token);
    return null;
  }
}
function checkDatabase(record) {
  const requested = resolve(root, process.env.LEDGER_DB_PATH || 'data/lecture-ledger.sqlite');
  if (record.databasePath !== requested) throw new Error('An app using a different database is already running in this checkout. Stop it with the matching LEDGER_DB_PATH first.');
}
function requireRuntime() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 15)) throw new Error('Lecture Ledger requires Node.js 24.15 or newer. Use ./app.sh or ./start.sh to select the bundled runtime.');
}
async function serve() {
  requireRuntime(); privateDirectory();
  const token = randomBytes(32).toString('hex');
  let app;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try { await app.close(); removeRecord(token); process.exitCode = 0; }
    catch (error) { reportError(error); process.exitCode = 1; }
  };
  const { startConfiguredLedger } = await import('../server/index.mjs');
  app = await startConfiguredLedger({ control: { token, shutdown: stop } });
  try {
    const record = { root, pid: process.pid, origin: app.origin, databasePath: app.store.filename, token };
    const temporary = `${statePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(record) + '\n', { mode: 0o600 });
    renameSync(temporary, statePath);
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    console.log(`Lecture Ledger is running at ${app.origin}/`);
    console.log(`Your database: ${app.store.filename}`);
    console.log('Shut down with ./stop.sh or Ctrl+C.');
    return record;
  } catch (error) { await app.close(); throw error; }
}
export async function startManagedChild() { return serve(); }
export async function startForeground() {
  requireRuntime();
  return withLaunchLock(async () => {
    const existing = await runningApp();
    if (existing) { checkDatabase(existing); console.log(`Lecture Ledger is already running at ${existing.origin}/`); return existing; }
    portOptions(); prepareBuild();
    return serve();
  });
}
export async function openApp({ browser = true } = {}) {
  requireRuntime();
  const record = await withLaunchLock(async () => {
    const existing = await runningApp();
    if (existing) { checkDatabase(existing); return existing; }
    portOptions(); prepareBuild();
    const log = openSync(logPath, 'w', 0o600);
    let child;
    try { child = spawn(process.execPath, [join(root, 'scripts/start.mjs'), '--managed-child'], { cwd: root, env: process.env, detached: true, stdio: ['ignore', log, log] }); }
    finally { closeSync(log); }
    let spawnError;
    child.on('error', error => { spawnError = error; });
    child.unref();
    for (let attempt = 0; attempt < 200; attempt++) {
      if (spawnError) throw spawnError;
      const active = await runningApp();
      if (active) return active;
      if (child.exitCode !== null) break;
      await delay(100);
    }
    throw new Error(`The app could not start. See ${logPath} for the startup error. Use ./app.sh port 3001 to choose another port.`);
  });
  console.log(`Lecture Ledger is open at ${record.origin}/. You can close this terminal.`);
  if (browser) {
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', record.origin + '/'] : [record.origin + '/'];
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    await new Promise(done => { child.once('spawn', done); child.once('error', () => { console.error(`Open ${record.origin}/ in your browser.`); done(); }); });
    child.unref();
  }
  return record;
}
export async function stopApp() {
  return withLaunchLock(async () => {
    const record = await runningApp();
    if (!record) { console.log('Lecture Ledger is already stopped.'); return false; }
    const response = await controlRequest(record, 'shutdown', 'POST');
    if (!response.ok) throw new Error('The app did not accept the shutdown request.');
    await response.json();
    for (let attempt = 0; attempt < 100; attempt++) {
      if (readJson(statePath)?.token !== record.token) { console.log('Lecture Ledger is shut down. Your timetable is saved.'); return true; }
      await delay(100);
    }
    throw new Error('The app is still finishing requests. Try shutting down again shortly.');
  });
}
function dialog(args) {
  const result = spawnSync('zenity', args, { encoding: 'utf8' });
  if (result.error || (result.status !== 0 && result.status !== 1)) throw new Error('Desktop dialogs need zenity and a graphical session. Use ./open.sh, ./stop.sh, or ./app.sh port 3001 in a terminal.');
  return result.status === 0 ? result.stdout.trim() : null;
}
async function configurePort(gui, value) {
  if (gui) value = dialog(['--entry', '--title=Lecture Ledger — port', '--text=Preferred port (1–65535). Takes effect the next time you start the app. If busy, the app tries the next 20 ports.', `--entry-text=${readSettings().port}`]);
  if (value === null) return;
  if (value === undefined) { console.log(`Preferred port: ${readSettings().port}`); return; }
  const port = savePort(value);
  const message = `Preferred port saved: ${port}. It takes effect next time you start the app.`;
  console.log(message);
  if (gui) dialog(['--info', '--title=Lecture Ledger', '--text=' + message]);
}
export function desktopEntry(directory = root) {
  if (/[\n\r]/.test(directory)) throw new Error('The app folder cannot contain line breaks.');
  const quote = value => '"' + value.replace(/[%\\"`$]/g, character => character === '%' ? '%%' : '\\' + character) + '"';
  const executable = quote(join(directory, 'desktop.sh'));
  return `[Desktop Entry]\nType=Application\nName=Lecture Ledger\nComment=Your local lecture tracker\nExec=${executable}\nIcon=${join(directory, 'public/favicon.svg')}\nTerminal=false\nCategories=Education;\nActions=Quit;Settings;\nX-LectureLedger=true\n\n[Desktop Action Quit]\nName=Quit Lecture Ledger\nExec=${executable} --quit\n\n[Desktop Action Settings]\nName=Term & settings\nExec=${executable} --settings\n`;
}
export function installShortcut(directory) {
  if (process.platform !== 'linux') throw new Error('Desktop shortcuts are available on Linux. Use npm run open and npm run stop on this computer.');
  const configured = spawnSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' });
  const desktop = directory || (configured.status === 0 && configured.stdout.trim()) || join(homedir(), 'Desktop');
  const targets = [join(resolve(desktop), 'Lecture Ledger.desktop')];
  if (!directory) targets.push(join(homedir(), '.local/share/applications/lecture-ledger.desktop'));
  for (const target of targets) {
    if (existsSync(target) && !readFileSync(target, 'utf8').includes('\nX-LectureLedger=true\n')) throw new Error(`A different shortcut already exists at ${target}. Move it before installing.`);
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, desktopEntry()); chmodSync(target, 0o755);
    spawnSync('gio', ['set', target, 'metadata::trusted', 'true'], { stdio: 'ignore' });
    console.log(`Shortcut installed: ${target}`);
  }
  console.log('Double-click Lecture Ledger to open the desktop app. Close its window or choose File → Quit to shut down. If your desktop asks, choose Allow Launching.');
  return targets;
}
export function reportError(error) {
  console.error(error.code === 'EADDRINUSE' ? 'The local port is in use. Save another with ./app.sh port 3001, or use PORT=3001 for this run.' : error.message);
}
async function main(args) {
  const gui = args.includes('--gui');
  const browser = !args.includes('--no-browser');
  const positional = args.filter(arg => !arg.startsWith('--'));
  let [command = 'menu', value] = positional;
  if (args.some(arg => arg.startsWith('--') && !['--gui', '--no-browser'].includes(arg)) || positional.length > 2) throw new Error('Unknown option. Use ./app.sh help for app controls.');
  if (value !== undefined && !['port', 'install-shortcut'].includes(command)) throw new Error('Unexpected argument. Use ./app.sh help for app controls.');
  if (command === 'menu') {
    command = dialog(['--list', '--title=Lecture Ledger', '--text=Open your tracker, shut it down, or change its port.', '--column=Action', '--hide-header', '--height=260', 'Open app', 'Shut down', 'Configure port']);
    if (!command) return;
    if (command === 'Open app') await openApp();
    else if (command === 'Shut down') { await stopApp(); dialog(['--info', '--title=Lecture Ledger', '--text=Lecture Ledger is shut down. Your timetable is saved.']); }
    else await configurePort(true);
  } else if (command === 'open') await openApp({ browser });
  else if (command === 'stop') { await stopApp(); if (gui) dialog(['--info', '--title=Lecture Ledger', '--text=Lecture Ledger is shut down. Your timetable is saved.']); }
  else if (command === 'status') { const record = await runningApp(); console.log(record ? `Lecture Ledger is running at ${record.origin}/` : 'Lecture Ledger is stopped.'); }
  else if (command === 'port') await configurePort(gui, value);
  else if (command === 'install-shortcut') installShortcut(value);
  else if (command === 'help') console.log('App controls:\n  ./open.sh                 Start in the background and open your browser\n  ./stop.sh                 Shut down this app safely\n  ./app.sh status           Show the running address\n  ./app.sh port 3001         Save a preferred port\n  ./app.sh                  Open desktop controls\n  ./app.sh install-shortcut  Install desktop and applications-menu shortcuts\n  ./start.sh                Run in a terminal (Ctrl+C stops it)\n\nPORT overrides the saved port for one run, without automatic fallback.');
  else throw new Error('Unknown app control. Use ./app.sh help.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await main(process.argv.slice(2)); }
  catch (error) {
    reportError(error);
    if (process.argv.includes('--gui') || process.argv.length === 2 || process.argv[2] === 'menu') {
      try { dialog(['--error', '--title=Lecture Ledger', '--text=' + error.message]); } catch { /* Terminal output remains available without zenity. */ }
    }
    process.exitCode = 1;
  }
}
