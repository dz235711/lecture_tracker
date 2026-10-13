import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function configPath() { return resolve(projectRoot, process.env.LEDGER_CONFIG_PATH || 'ledger.config.json'); }
export function parsePort(value) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('Choose a port between 1 and 65535, such as 3000 or 3001.');
  }
  return Number(value);
}
export function readSettings() {
  let settings;
  try { settings = JSON.parse(readFileSync(configPath(), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return { port: 3000 };
    throw new Error(`Could not read ${configPath()}. Check that it contains valid JSON, for example { "port": 3000 }.`);
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('The port settings must be a JSON object.');
  return { port: parsePort(settings.port) };
}
export function savePort(value) {
  const port = parsePort(value);
  const filename = configPath();
  mkdirSync(dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ port }, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, filename);
  return port;
}
export function portOptions() {
  const explicit = process.env.PORT !== undefined;
  return { port: explicit ? parsePort(process.env.PORT) : readSettings().port, fallback: !explicit };
}
