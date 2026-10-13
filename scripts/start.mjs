import { startForeground, startManagedChild, reportError } from './app.mjs';

try {
  if (process.argv.includes('--managed-child')) await startManagedChild();
  else await startForeground();
} catch (error) { reportError(error); process.exitCode = 1; }
