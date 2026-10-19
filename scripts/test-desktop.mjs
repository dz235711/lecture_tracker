import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { openStore } from '../server/store.mjs';
import { projectRoot as root } from '../server/config.mjs';
import { isAppPage, isUniversityLink } from '../desktop/policy.mjs';
import { desktopEntry } from './app.mjs';
import { addDays, dateInZone, monday } from '../lib/model.ts';
import { overviewTestPlanner } from '../desktop/overview-smoke.mjs';

for (const link of ['https://scientia.doc.ic.ac.uk/2627/modules/70021/materials', 'https://imperial.cloud.panopto.eu/Panopto/Pages/Sessions/List.aspx']) assert.equal(isUniversityLink(link), true);
for (const link of ['javascript:alert(1)', 'file:///etc/passwd', 'http://scientia.doc.ic.ac.uk/', 'https://scientia.doc.ic.ac.uk.example.com/', 'https://user@scientia.doc.ic.ac.uk/', 'https://scientia.doc.ic.ac.uk:444/', 'https://example.com']) assert.equal(isUniversityLink(link), false);
assert.equal(isAppPage('http://127.0.0.1:3000/', 'http://127.0.0.1:3000'), true);
assert.equal(isAppPage('http://127.0.0.1:3001/', 'http://127.0.0.1:3000'), false);
assert.equal(isAppPage('http://127.0.0.1:3000.evil.example/', 'http://127.0.0.1:3000'), false);
const folder = await mkdtemp(join(tmpdir(), 'ledger-desktop-'));
const databasePath = join(folder, 'test.sqlite');
const profile = join(folder, 'profile'); await mkdir(profile);
let store = openStore(databasePath);
const currentWeek = monday(dateInZone(Date.now(), 'Europe/London'));
store.save({ schemaVersion: 2, term: { name: 'Desktop test term', start: addDays(currentWeek, -7), end: addDays(currentWeek, 20), timezone: 'Europe/London' }, courses: [{ id: 'test-quantum', name: 'Quantum computing', number: '70021', folderId: '4394cd01-a3d6-489a-b98c-b49b011de184', color: 'violet' }], lectures: [{ id: 'test-lecture', courseId: 'test-quantum', title: 'Quantum gates & circuits', day: 0, start: '09:00', end: '10:00', tags: [] }, { id: 'test-tutorial', courseId: 'test-quantum', title: 'Problem class', day: 2, start: '10:00', end: '11:00', tags: ['Tutorial'] }], completed: {} }, 0);
store.close(); store = null;
const electron = createRequire(import.meta.url)('electron');
try {
  for (const phase of ['save', 'reopen']) {
    const env = { ...process.env, LEDGER_DB_PATH: databasePath, LEDGER_DESKTOP_PROFILE: profile, LEDGER_DESKTOP_SMOKE: '1', LEDGER_DESKTOP_SMOKE_PHASE: phase, LEDGER_DESKTOP_SCREENSHOT: join(folder, `desktop-${phase}.png`) };
    delete env.ELECTRON_RUN_AS_NODE;
    const { stdout, stderr } = await promisify(execFile)(electron, [root], { cwd: root, env, timeout: 45_000, maxBuffer: 1_000_000 });
    const marker = stdout.split('\n').find(line => line.startsWith('LEDGER_DESKTOP_SMOKE_RESULT '));
    assert.ok(marker, 'The desktop app must finish its real renderer checks.\n' + stdout + '\n' + stderr);
    const result = JSON.parse(marker.slice('LEDGER_DESKTOP_SMOKE_RESULT '.length));
    assert.equal(result.completed, 1);
    await assert.rejects(fetch(result.origin));
    console.log(`Passed desktop ${phase}: native window, isolated renderer, menu/single-instance navigation, completion/backup, SQLite persistence and shutdown/port release.`);
  }
  store = openStore(databasePath); assert.equal(Object.keys(store.load().data.completed).length, 1); store.close(); store = null;
  const runtime = join(folder, 'runtime');
  const env = { ...process.env, LEDGER_DB_PATH: databasePath, LEDGER_DESKTOP_PROFILE: profile, LEDGER_RUNTIME_DIR: runtime, LEDGER_NODE_BIN: process.execPath, LEDGER_DESKTOP_SMOKE: '1', LEDGER_DESKTOP_SMOKE_PHASE: 'reopen', LEDGER_DESKTOP_SCREENSHOT: join(folder, 'desktop-shortcut.png') };
  // GNOME's pinned icon launches this desktop ID through the desktop-entry service.
  const applications = join(folder, 'applications'); await mkdir(applications);
  await writeFile(join(applications, 'lecture-tracker.desktop'), desktopEntry());
  const launcherEnv = { ...env, XDG_DATA_HOME: folder };
  if (process.env.LEDGER_TEST_DESKTOP_SERVICE === '1') {
    // Launch from the ordinary desktop service context, not Codex's AppArmor profile.
    const settings = Object.entries(launcherEnv).filter(([key]) => key.startsWith('LEDGER_') || key === 'XDG_DATA_HOME').map(([key, value]) => `--setenv=${key}=${value}`);
    await promisify(execFile)('systemd-run', ['--user', '--wait', '--pipe', '--collect', '--property=ExitType=cgroup', ...settings, '/usr/bin/gtk-launch', 'lecture-tracker'], { cwd: tmpdir(), env: launcherEnv, timeout: 45_000 });
  } else {
    await promisify(execFile)('gtk-launch', ['lecture-tracker'], { cwd: tmpdir(), env: launcherEnv, timeout: 30_000 });
  }
  let result;
  for (let attempt = 0; attempt < 300; attempt++) {
    const log = await readFile(join(runtime, 'desktop.log'), 'utf8').catch(() => '');
    const marker = log.split('\n').find(line => line.startsWith('LEDGER_DESKTOP_SMOKE_RESULT '));
    if (marker) { result = JSON.parse(marker.slice('LEDGER_DESKTOP_SMOKE_RESULT '.length)); break; }
    await delay(100);
  }
  assert.ok(result, 'The default shell/shortcut launcher must open the Electron app.');
  if (process.env.LEDGER_TEST_DESKTOP_SERVICE === '1') assert.match(result.securityContext, /^lecture-tracker-[a-f0-9]{16} /, 'The ordinary desktop launch must use the installed app-specific sandbox permission.');
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(result.origin, { signal: AbortSignal.timeout(500) }); await delay(50); }
    catch { break; }
  }
  await assert.rejects(fetch(result.origin));
  console.log('Passed desktop-ID launcher: pinned-icon entry, automatic build, native window, initial filter and clean shutdown with isolated data.');
  const overviewDatabase = join(folder, 'overview.sqlite');
  store = openStore(overviewDatabase); store.save(overviewTestPlanner, 0); store.close(); store = null;
  for (const phase of ['overview', 'overview-reopen']) {
    const env = { ...process.env, LEDGER_DB_PATH: overviewDatabase, LEDGER_DESKTOP_PROFILE: join(folder, 'overview-profile'), LEDGER_DESKTOP_SMOKE: '1', LEDGER_DESKTOP_SMOKE_PHASE: phase, LEDGER_DESKTOP_SCREENSHOT: join(folder, `${phase}.png`) };
    delete env.ELECTRON_RUN_AS_NODE;
    const { stdout, stderr } = await promisify(execFile)(electron, [root], { cwd: root, env, timeout: 45_000, maxBuffer: 1_000_000 });
    const marker = stdout.split('\n').find(line => line.startsWith('LEDGER_DESKTOP_SMOKE_RESULT '));
    assert.ok(marker, 'The due-session startup checks must finish.\n' + stdout + '\n' + stderr);
    const result = JSON.parse(marker.slice('LEDGER_DESKTOP_SMOKE_RESULT '.length));
    assert.equal(result.completed, 5); assert.equal(result.rows, 7);
    await assert.rejects(fetch(result.origin));
    store = openStore(overviewDatabase); assert.deepEqual(store.load().data, overviewTestPlanner); store.close(); store = null;
    console.log(`Passed ${phase}: seven due sessions, four information-theory rows, saved Quantum completion, Overview navigation, week browsing and reload without changing data.`);
  }
  console.log('Desktop screenshots: ' + folder);
} catch (error) { await rm(folder, { recursive: true, force: true }); throw error; }
finally { store?.close(); }
