import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Synthetic Monday-morning case: 12 past sessions, five completed, six ahead this week.
export const overviewTestPlanner = {
  schemaVersion: 2,
  term: { name: 'Overview regression term', start: '2026-10-05', end: '2026-11-27', timezone: 'Europe/London' },
  courses: [
    { id: 'overview-q', name: 'Quantum computing', number: '', folderId: '', color: 'sage' },
    { id: 'overview-i', name: 'Statistical information theory', number: '', folderId: '', color: 'violet' },
    { id: 'overview-r', name: 'Reinforcement learning', number: '', folderId: '', color: 'blue' },
  ],
  lectures: [
    { id: 'overview-q-lecture', courseId: 'overview-q', day: 0, start: '09:00', end: '10:00', tags: ['Lecture'] },
    { id: 'overview-q-tutorial', courseId: 'overview-q', day: 3, start: '09:00', end: '10:00', tags: ['Tutorial'] },
    { id: 'overview-i-lecture', courseId: 'overview-i', day: 1, start: '09:00', end: '10:00', tags: ['Lecture'] },
    { id: 'overview-i-tutorial', courseId: 'overview-i', day: 4, start: '09:00', end: '10:00', tags: ['Tutorial'] },
    { id: 'overview-r-lecture', courseId: 'overview-r', day: 0, start: '10:00', end: '11:00', tags: ['Lecture'] },
    { id: 'overview-r-tutorial', courseId: 'overview-r', day: 4, start: '10:00', end: '11:00', tags: ['Tutorial'] },
  ],
  completed: Object.fromEntries([
    'overview-q-lecture:2026-10-05', 'overview-q-tutorial:2026-10-08', 'overview-q-lecture:2026-10-12',
    'overview-r-lecture:2026-10-05', 'overview-r-tutorial:2026-10-09',
  ].map(key => [key, '2026-10-18T12:00:00.000Z'])),
};

export async function prepareOverviewTest(window) {
  // Freeze only the temporary test renderer before its very first React render.
  await window.loadURL('about:blank');
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Page.enable');
  await window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `Date.now = () => ${Date.parse('2026-10-19T08:00:00.000Z')};`,
  });
}

export async function overviewSmokeTest({ window, ledger, views, javascript, until }) {
  assert.equal(await javascript('Date.now()'), Date.parse('2026-10-19T08:00:00.000Z'));
  const saved = ledger.store.load();
  const snapshot = () => javascript(`({
    scope: document.querySelector('.scope-toggle .active').textContent,
    filter: document.querySelector('.filter-tabs [aria-pressed="true"]').textContent,
    sidebar: document.querySelector('.nav-count').textContent,
    unfinished: parseInt(document.querySelector('.stat-card.unfinished .stat-value').textContent),
    groups: Array.from(document.querySelectorAll('.course-occurrence-group')).map(group => ({
      course: group.querySelector('h3').textContent,
      dates: Array.from(group.querySelectorAll('.occurrence-date')).map(date => date.title),
      rows: group.querySelectorAll('.lecture-row').length,
    })),
    rows: document.querySelectorAll('.lecture-row').length,
    completed: document.querySelectorAll('.lecture-row.completed').length,
    upcoming: document.querySelectorAll('.lecture-row.upcoming').length,
  })`);
  const initial = await snapshot();
  assert.equal(initial.scope, 'Term'); assert.equal(initial.filter, 'Unfinished7');
  assert.equal(initial.rows, 7); assert.equal(initial.sidebar, '7'); assert.equal(initial.unfinished, 7);
  assert.equal(initial.completed, 0); assert.equal(initial.upcoming, 0);
  assert.deepEqual(initial.groups.map(group => [group.course, group.rows]), [
    ['Quantum computing', 1], ['Statistical information theory', 4], ['Reinforcement learning', 2],
  ]);
  assert.deepEqual(initial.groups[0].dates, ['Thursday, 15 October 2026']);
  assert.deepEqual(initial.groups[1].dates, ['Tuesday, 6 October 2026', 'Friday, 9 October 2026', 'Tuesday, 13 October 2026', 'Friday, 16 October 2026']);
  await javascript(`new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))`);
  await writeFile(process.env.LEDGER_DESKTOP_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  views.find(item => item.label === 'Catch up').click();
  assert.deepEqual(await snapshot(), initial, 'Catch up must not be needed to correct the first screen.');
  await javascript(`Array.from(document.querySelectorAll('.filter-tabs button')).find(button => button.textContent.startsWith('Completed')).click()`);
  await until(`document.querySelectorAll('.lecture-row.completed').length === 5`);
  assert.equal(await javascript(`Array.from(document.querySelectorAll('.course-occurrence-group')).find(group => group.querySelector('h3').textContent === 'Quantum computing').querySelector('button[aria-label*="12 Oct"]').getAttribute('aria-pressed')`), 'true');
  await javascript(`Array.from(document.querySelectorAll('.filter-tabs button')).find(button => button.textContent.startsWith('All sessions')).click()`);
  await javascript(`Array.from(document.querySelectorAll('.scope-toggle button')).find(button => button.textContent === 'Week').click()`);
  await until(`document.querySelectorAll('.lecture-row.upcoming').length === 6`);
  assert.equal((await snapshot()).rows, 6, 'The six upcoming slots belong to this week, separately from the seven past unfinished sessions.');
  views.find(item => item.label === 'Courses & lectures').click();
  await until(`document.querySelector('h1')?.textContent === 'Courses & lectures'`);
  views.find(item => item.label === 'Overview').click();
  await until(`document.querySelector('.filter-tabs [aria-pressed="true"]').textContent === 'Unfinished7'`);
  assert.deepEqual(await snapshot(), initial, 'Native Overview must use the same due-session view.');
  await javascript(`Array.from(document.querySelectorAll('.filter-tabs button')).find(button => button.textContent.startsWith('Upcoming')).click()`);
  await javascript(`Array.from(document.querySelectorAll('.scope-toggle button')).find(button => button.textContent === 'Week').click()`);
  await until(`document.querySelectorAll('.lecture-row.upcoming').length === 6`);
  await javascript(`Array.from(document.querySelectorAll('nav button')).find(button => button.textContent === 'Overview').click()`);
  await until(`document.querySelector('.filter-tabs [aria-pressed="true"]').textContent === 'Unfinished7'`);
  assert.deepEqual(await snapshot(), initial);
  const reloaded = new Promise(done => window.webContents.once('did-finish-load', done));
  window.webContents.reload();
  await reloaded;
  await until(`document.body.textContent.includes('Saved on this computer') && document.querySelectorAll('.lecture-row').length === 7`);
  assert.deepEqual(await snapshot(), initial, 'Reload must immediately restore the same due sessions.');
  assert.deepEqual(ledger.store.load(), saved, 'Reviewing the different views must not rewrite saved completions.');
  console.log('LEDGER_DESKTOP_SMOKE_RESULT ' + JSON.stringify({ origin: ledger.origin, completed: 5, rows: 7 }));
  window.close();
}
