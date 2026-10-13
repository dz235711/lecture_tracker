import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openStore, readBackup } from '../server/store.mjs';
const [action, filename, ...options] = process.argv.slice(2);
if (!['import', 'export'].includes(action) || !filename || options.some(option => option !== '--replace')) {
  console.error('Usage: npm run import -- /path/to/backup.json [--replace]\n       npm run export -- /path/to/backup.json');
  process.exit(1);
}
let store;
try {
  store = openStore();
  const current = store.load();
  if (action === 'export') {
    await writeFile(resolve(filename), JSON.stringify({ format: 'lecture-ledger', version: 2, data: current.data }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Backup exported.');
  } else {
    const data = readBackup(await readFile(resolve(filename), 'utf8'));
    if ((current.data.term || current.data.lectures.length || current.data.courses.length) && !options.includes('--replace')) throw new Error('There is already a timetable here. Export a backup first, then add --replace if you want to replace it.');
    store.save(data, current.revision);
    console.log(`Imported ${data.courses.length} courses, ${data.lectures.length} weekly sessions, and ${Object.keys(data.completed).length} completion records.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { store?.close(); }
