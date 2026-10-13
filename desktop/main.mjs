import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from 'electron';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startLedger } from '../desktop-dist/server.mjs';
import { isAppPage, isUniversityLink } from './policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.LEDGER_DESKTOP_SMOKE === '1') {
  for (const filename of [process.env.LEDGER_DB_PATH, process.env.LEDGER_DESKTOP_PROFILE, process.env.LEDGER_DESKTOP_SCREENSHOT]) {
    if (!filename || !resolve(filename).startsWith(resolve(tmpdir()) + sep)) throw new Error('Desktop tests require temporary data, profile and screenshot paths before opening the database.');
  }
}
app.setName('Lecture Ledger');
const profile = resolve(process.env.LEDGER_DESKTOP_PROFILE || join(app.getPath('appData'), 'Lecture Ledger'));
mkdirSync(profile, { recursive: true, mode: 0o700 });
app.setPath('userData', profile); app.setPath('sessionData', profile);
if (process.platform === 'linux') app.setDesktopName('lecture-ledger.desktop');
let window;
let ledger;
let quitting = false;
let pendingView = process.argv.includes('--settings') ? 'settings' : null;
const quitRequested = process.argv.includes('--quit');
const singleInstance = app.requestSingleInstanceLock();
if (process.env.LEDGER_DESKTOP_SMOKE === '1') console.log('Desktop startup', JSON.stringify({ singleInstance, quitRequested, profile: app.getPath('userData') }));

function navigate(view) {
  if (!window || window.webContents.isLoading()) { pendingView = view; return; }
  window.webContents.send('ledger:navigate', view);
}
function focus() { if (window) { if (window.isMinimized()) window.restore(); if (process.env.LEDGER_DESKTOP_SMOKE !== '1') { window.show(); window.focus(); } } }
function openExternal(url) { if (isUniversityLink(url)) void shell.openExternal(url).catch(error => dialog.showErrorBox('Could not open this resource', error.message)); }

if (!singleInstance || quitRequested) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--quit')) { app.quit(); return; }
    focus(); if (argv.includes('--settings')) navigate('settings');
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!ledger || quitting) return;
    event.preventDefault();
    // Give the renderer's pending-save guard a chance to keep the window open.
    if (window && !window.isDestroyed()) { window.close(); return; }
    quitting = true;
    void ledger.close().then(() => app.quit()).catch(error => { dialog.showErrorBox('Could not close the database', error.message); app.exit(1); });
  });
  process.once('SIGINT', () => app.quit()); process.once('SIGTERM', () => app.quit());
  void app.whenReady().then(async () => {
    if (process.env.LEDGER_DESKTOP_SMOKE === '1') console.log('Desktop runtime ready');
    try {
      // The OS chooses a free internal port. Desktop use never depends on port 3000.
      const databasePath = process.env.LEDGER_DB_PATH || (app.isPackaged ? join(app.getPath('userData'), 'lecture-ledger.sqlite') : join(root, 'data/lecture-ledger.sqlite'));
      ledger = await startLedger({ port: 0, databasePath, staticDirectory: join(root, 'dist') });
      window = new BrowserWindow({
        title: 'Lecture Ledger', width: 1280, height: 880, minWidth: 860, minHeight: 640,
        backgroundColor: '#f7f8f4', show: false, icon: join(root, 'public/app-icon.png'),
        webPreferences: { preload: join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      const session = window.webContents.session;
      session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      session.setPermissionCheckHandler(() => false);
      session.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        if (details.url.startsWith(ledger.origin + '/')) headers['Content-Security-Policy'] = ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"];
        callback({ responseHeaders: headers });
      });
      session.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Save Lecture Ledger backup', defaultPath: join(app.getPath('downloads'), 'lecture-ledger-backup.json') }));
      window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
      window.webContents.on('will-navigate', (event, url) => { if (!isAppPage(url, ledger.origin)) { event.preventDefault(); openExternal(url); } });
      window.webContents.on('will-attach-webview', event => event.preventDefault());
      window.webContents.on('will-prevent-unload', () => { if (process.env.LEDGER_DESKTOP_SMOKE !== '1') void dialog.showMessageBox(window, { type: 'info', title: 'Finishing your save', message: 'Wait for the current save to finish, then close the app again.' }); });
      ipcMain.on('ledger:quit', event => { if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && isAppPage(event.senderFrame.url, ledger.origin)) app.quit(); });
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: 'File', submenu: [
          { label: 'Term & settings', accelerator: 'CommandOrControl+,', click: () => navigate('settings') },
          { type: 'separator' }, { label: 'Quit Lecture Ledger', accelerator: 'CommandOrControl+Q', click: () => app.quit() },
        ] },
        { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: 'View', submenu: [
          { label: 'Overview', accelerator: 'CommandOrControl+1', click: () => navigate('overview') },
          { label: 'Courses & lectures', accelerator: 'CommandOrControl+2', click: () => navigate('schedule') },
          { label: 'Catch up', accelerator: 'CommandOrControl+3', click: () => navigate('catchup') },
          { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' },
        ] },
        { label: 'Help', submenu: [{ label: 'About Lecture Ledger', click: () => { void dialog.showMessageBox(window, { title: 'Lecture Ledger', message: 'Lecture Ledger', detail: 'Your lectures, resources and progress, saved on this computer.\nClose the window or choose File → Quit to shut down the app.' }); } }] },
      ]));
      window.once('ready-to-show', () => { if (process.env.LEDGER_DESKTOP_SMOKE !== '1') window.show(); });
      await window.loadURL(ledger.origin + '/');
      if (process.env.LEDGER_DESKTOP_SMOKE === '1') console.log('Desktop renderer loaded');
      if (pendingView) { navigate(pendingView); pendingView = null; }
      if (process.env.LEDGER_DESKTOP_SMOKE === '1') {
        const { smokeTest } = await import('./smoke.mjs');
        await smokeTest({ app, window, ledger, root });
      }
    } catch (error) {
      if (process.env.LEDGER_DESKTOP_SMOKE === '1') console.error(error);
      else dialog.showErrorBox('Lecture Ledger could not start', error.message);
      await ledger?.close(); app.exit(1);
    }
  });
}
