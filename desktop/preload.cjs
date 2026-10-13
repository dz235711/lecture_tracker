const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lectureLedgerDesktop', {
  quit: () => ipcRenderer.send('ledger:quit'),
  onNavigate: callback => {
    const listener = (_event, view) => { if (['overview', 'schedule', 'settings', 'catchup'].includes(view)) callback(view); };
    ipcRenderer.on('ledger:navigate', listener);
    return () => ipcRenderer.removeListener('ledger:navigate', listener);
  },
});
