import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { resolve, sep, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Menu } from 'electron';

export async function smokeTest({ app, window, ledger, root }) {
  for (const filename of [process.env.LEDGER_DB_PATH, process.env.LEDGER_DESKTOP_PROFILE, process.env.LEDGER_DESKTOP_SCREENSHOT]) {
    assert.ok(filename && resolve(filename).startsWith(resolve(tmpdir()) + sep), 'Desktop smoke tests require temporary data, profile and screenshot paths.');
  }
  const javascript = expression => window.webContents.executeJavaScript(expression);
  window.webContents.setBackgroundThrottling(false);
  async function until(expression) {
    for (let attempt = 0; attempt < 200; attempt++) { if (await javascript(`Boolean(${expression})`)) return; await delay(50); }
    throw new Error('Desktop UI did not become ready: ' + expression);
  }
  await until(`document.querySelector('.desktop-app') && document.body.textContent.includes('Saved on this computer')`);
  assert.equal(await javascript(`typeof window.require`), 'undefined');
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
  assert.equal(window.webContents.getLastWebPreferences().contextIsolation, true);
  assert.equal(window.webContents.getLastWebPreferences().nodeIntegration, false);
  if (process.platform === 'linux') {
    const status = await readFile(`/proc/${window.webContents.getOSProcessId()}/status`, 'utf8');
    assert.match(status, /^Seccomp:\s+2$/m, 'The actual renderer must have its OS sandbox enabled.');
  }
  assert.equal(await javascript(`document.querySelector('.page-footer') === null`), true);
  assert.equal(await javascript(`getComputedStyle(document.querySelector('.page-heading .eyebrow')).display`), 'none');
  assert.equal(await javascript(`document.querySelector('.filter-tabs [aria-pressed="true"]').textContent.startsWith('Unfinished')`), true);
  assert.equal(await javascript(`document.querySelector('.scope-toggle .active').textContent`), 'Term');
  assert.equal(await javascript(`document.querySelector('.complete-button.checked') === null`), true, 'Saved completed lectures must be hidden immediately on launch, before Catch up is clicked.');
  const views = Menu.getApplicationMenu().items.find(item => item.label === 'View').submenu.items;
  if (process.env.LEDGER_DESKTOP_SMOKE_PHASE?.startsWith('overview')) {
    const { overviewSmokeTest } = await import('./overview-smoke.mjs');
    await overviewSmokeTest({ window, ledger, views, javascript, until });
    return;
  }
  views.find(item => item.label === 'Courses & lectures').click();
  await until(`document.querySelector('h1')?.textContent === 'Courses & lectures'`);
  assert.equal(await javascript(`document.body.textContent.includes('Quantum gates & circuits') || document.body.textContent.includes('Problem class')`), false);
  if (process.env.LEDGER_DESKTOP_SMOKE_PHASE === 'save') {
    // Editing an older session must keep its ID/history while dispensing with a name field.
    const original = ledger.store.load().data.lectures.find(item => item.id === 'test-lecture');
    await javascript(`document.querySelector('.session-edit-actions button[aria-label^="Edit"]').click()`);
    await until(`document.querySelector('dialog[open] form')`);
    assert.equal(await javascript(`document.querySelector('dialog').textContent.includes('Session name')`), false);
    await javascript(`Array.from(document.querySelectorAll('.suggested-tags button')).find(button => button.textContent.includes('Lecture')).click()`);
    await until(`document.querySelector('dialog input[placeholder="Lecture, Tutorial, Lab"]').value === 'Lecture'`);
    await javascript(`document.querySelector('dialog form').requestSubmit()`);
    await until(`!document.querySelector('dialog[open]') && document.body.textContent.includes('Saved on this computer')`);
    const edited = ledger.store.load().data.lectures.find(item => item.id === original.id);
    assert.equal(edited.title, original.title); assert.deepEqual(edited.tags, ['Lecture']);
    await javascript(`document.querySelector('.course-add-session').click()`);
    await until(`document.querySelector('dialog[open] form')`);
    await javascript(`Array.from(document.querySelectorAll('.suggested-tags button')).find(button => button.textContent.includes('Lab')).click()`);
    await until(`document.querySelector('dialog input[placeholder="Lecture, Tutorial, Lab"]').value === 'Lab'`);
    await javascript(`document.querySelector('dialog form').requestSubmit()`);
    await until(`!document.querySelector('dialog[open]') && document.body.textContent.includes('Saved on this computer')`);
    const added = ledger.store.load().data.lectures.find(item => item.id !== 'test-lecture' && item.id !== 'test-tutorial');
    assert.ok(added && !Object.hasOwn(added, 'title')); assert.deepEqual(added.tags, ['Lab']);
  }
  views.find(item => item.label === 'Overview').click();
  await until(`document.querySelector('h1')?.textContent === 'Overview' && document.querySelector('.complete-button')`);
  assert.equal(await javascript(`document.body.textContent.includes('Quantum gates & circuits') || document.body.textContent.includes('Problem class')`), false);
  if (process.env.LEDGER_DESKTOP_SMOKE_PHASE === 'save') {
    const before = await javascript(`document.querySelectorAll('.complete-button').length`);
    await javascript(`document.querySelector('.complete-button').click()`);
    for (let attempt = 0; attempt < 100 && Object.keys(ledger.store.load().data.completed).length === 0; attempt++) await delay(50);
    await until(`document.querySelectorAll('.complete-button').length === ${before - 1} && document.body.textContent.includes('Saved on this computer')`);
    assert.equal(await javascript(`document.querySelector('.complete-button.checked') === null`), true);
  }
  assert.equal(Object.keys(ledger.store.load().data.completed).length, 1);
  const chooseFilter = async label => {
    await javascript(`Array.from(document.querySelectorAll('.filter-tabs button')).find(button => button.textContent.startsWith(${JSON.stringify(label)})).click()`);
    await until(`document.querySelector('.filter-tabs [aria-pressed="true"]').textContent.startsWith(${JSON.stringify(label)})`);
  };
  await chooseFilter('All sessions');
  await until(`document.querySelector('.complete-button.checked') && document.body.textContent.includes('Saved on this computer')`);
  await chooseFilter('Completed');
  assert.equal(await javascript(`document.querySelectorAll('.complete-button').length`), 1);
  assert.equal(await javascript(`document.querySelectorAll('.complete-button.checked').length`), 1);
  if (process.env.LEDGER_DESKTOP_SMOKE_PHASE === 'save') {
    await javascript(`document.querySelector('.complete-button.checked').click()`);
    await until(`document.querySelectorAll('.complete-button').length === 0 && document.body.textContent.includes('Saved on this computer')`);
    assert.equal(Object.keys(ledger.store.load().data.completed).length, 0, 'Undo removes the saved completion and the Completed row.');
    await chooseFilter('To do');
    await javascript(`document.querySelector('.complete-button').click()`);
    await until(`!document.querySelector('.complete-button.checked') && document.body.textContent.includes('Saved on this computer')`);
    assert.equal(Object.keys(ledger.store.load().data.completed).length, 1);
  }
  await chooseFilter('To do');
  assert.equal(await javascript(`document.querySelector('.complete-button.checked') === null`), true);
  assert.equal(await javascript(`document.querySelectorAll('.complete-button').length === Number(document.querySelector('.filter-tabs [aria-pressed="true"] span').textContent)`), true);
  await javascript(`Array.from(document.querySelectorAll('.scope-toggle button')).find(button => button.textContent === 'Term').click()`);
  // Use the full term so this test includes both past and future occurrences.
  await until(`document.querySelector('.lecture-list')?.textContent.includes('Upcoming')`);
  views.find(item => item.label === 'Catch up').click();
  await until(`document.querySelector('.filter-tabs [aria-pressed="true"]').textContent.startsWith('Unfinished')`);
  assert.equal(await javascript(`document.querySelector('.complete-button.checked') === null && !document.querySelector('.lecture-list').textContent.includes('Upcoming')`), true);
  await chooseFilter('To do');
  // A second launch focuses the same app and can request its settings page.
  await promisify(execFile)(process.execPath, [root, '--settings'], { env: process.env, timeout: 10_000 });
  await until(`document.querySelector('h1')?.textContent === 'Term & settings'`);
  const backupPath = join(resolve(process.env.LEDGER_DESKTOP_PROFILE), 'test-backup.json');
  const downloaded = new Promise((done, reject) => {
    window.webContents.session.once('will-download', (_event, item) => {
      item.setSavePath(backupPath);
      item.once('done', (_event, state) => state === 'completed' ? done() : reject(new Error('Backup download failed: ' + state)));
    });
  });
  await javascript(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Export backup')).click()`);
  await Promise.race([downloaded, delay(10_000).then(() => { throw new Error('Backup download timed out.'); })]);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  assert.deepEqual(backup.data, ledger.store.load().data);
  views.find(item => item.label === 'Overview').click();
  await until(`document.querySelector('h1')?.textContent === 'Overview'`);
  await javascript(`new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))`);
  await delay(100);
  await writeFile(process.env.LEDGER_DESKTOP_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  // Renderer navigation must not replace the tracker with arbitrary remote content.
  await javascript(`window.location.href = 'https://example.com/'`);
  await delay(100);
  assert.equal(window.webContents.getURL(), ledger.origin + '/');
  await javascript(`window.__holdClose = event => event.preventDefault(); window.addEventListener('beforeunload', window.__holdClose)`);
  app.quit();
  await delay(150);
  assert.equal(window.isDestroyed(), false, 'A pending save must keep the window open.');
  assert.equal(ledger.server.listening, true, 'The database/API must remain usable when closing is prevented.');
  await javascript(`window.removeEventListener('beforeunload', window.__holdClose); delete window.__holdClose`);
  const securityContext = process.platform === 'linux' ? (await readFile('/proc/self/attr/current', 'utf8')).trim() : null;
  console.log('LEDGER_DESKTOP_SMOKE_RESULT ' + JSON.stringify({ origin: ledger.origin, revision: ledger.store.load().revision, completed: 1, node: process.versions.node, securityContext }));
  if (process.env.LEDGER_DESKTOP_SMOKE_PHASE === 'save') await javascript(`document.querySelector('.quit-app').click()`);
  else window.close();
}
