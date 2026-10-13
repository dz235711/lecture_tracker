import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyPlanner, upgradePlanner, validatePlanner } from '../lib/model.ts';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const defaultDatabasePath = resolve(root, process.env.LEDGER_DB_PATH || 'data/lecture-ledger.sqlite');
export const maximumBodyBytes = 2_000_000;
export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function openStore(databasePath = defaultDatabasePath) {
  const filename = resolve(databasePath);
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename, { timeout: 5000 });
  chmodSync(filename, 0o600);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS planner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const select = db.prepare('SELECT data, revision FROM planner WHERE id = 1');
  const insert = db.prepare('INSERT INTO planner (id, data, revision, updated_at) VALUES (1, ?, 1, ?) ON CONFLICT(id) DO NOTHING');
  const update = db.prepare('UPDATE planner SET data = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?');
  let closed = false;
  return {
    filename,
    load() {
      const row = select.get();
      if (!row) return { data: emptyPlanner(), revision: 0 };
      let data;
      try { data = upgradePlanner(JSON.parse(row.data)); } catch { /* Preserve an unreadable database rather than resetting it. */ }
      if (!data) throw new AppError(503, 'Your saved timetable could not be read. Keep the database file and restore a backup.');
      return { data, revision: row.revision };
    },
    save(data, revision) {
      if (!validatePlanner(data) || !Number.isSafeInteger(revision) || revision < 0) throw new AppError(400, 'Please check the course details, tags, session times, and term dates.');
      const serialized = JSON.stringify(data);
      if (Buffer.byteLength(serialized) > maximumBodyBytes) throw new AppError(413, 'This timetable is too large.');
      const stamp = new Date().toISOString();
      const result = revision === 0 ? insert.run(serialized, stamp) : update.run(serialized, stamp, revision);
      if (!result.changes) throw new AppError(409, 'Your timetable changed in another tab. Reload to get the latest version.');
      return { revision: revision + 1 };
    },
    close() { if (!closed) { closed = true; db.close(); } },
  };
}
export function readBackup(text) {
  if (Buffer.byteLength(text) > maximumBodyBytes) throw new AppError(413, 'This backup is too large.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new AppError(400, 'This backup is not valid JSON.'); }
  const data = upgradePlanner(parsed?.data);
  if (parsed?.format !== 'lecture-ledger' || ![1, 2].includes(parsed.version) || !data) throw new AppError(400, 'Choose a valid Lecture Tracker backup.');
  return data;
}
