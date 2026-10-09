const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null, dirty = false, forceClose = false;

function send(action) { if (win) win.webContents.send('menu', action); }

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1000, minHeight: 640, backgroundColor: '#12131c', title: '2plat',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('close', (e) => {
    if (!dirty || forceClose) return;
    const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Cancel', 'Quit without saving'], defaultId: 0, cancelId: 0, title: '2plat', message: 'You have unsaved changes.', detail: 'Quit and discard them? (Your work is also autosaved inside the app.)' });
    if (r === 0) e.preventDefault();
  });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const t = [
    { label: 'File', submenu: [
      { label: 'New project…', click: () => send('new') },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
      { label: 'Save as…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveas') },
      { type: 'separator' },
      { label: 'Export game (HTML)…', click: () => send('export') },
      { type: 'separator' }, { role: 'quit' } ] },
    { label: 'Game', submenu: [{ label: 'Playtest', accelerator: 'F5', click: () => send('play') }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'toggleDevTools' }] },
    { label: 'Help', submenu: [{ label: 'Quick guide', click: () => send('help') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

ipcMain.handle('open-project', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open 2plat project', filters: [{ name: '2plat project', extensions: ['2plat', 'json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { path: r.filePaths[0], data: fs.readFileSync(r.filePaths[0], 'utf8') };
});
ipcMain.handle('save-project', async (_e, json, existing, suggested) => {
  let p = existing && path.isAbsolute(existing) ? existing : null;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { title: 'Save 2plat project', defaultPath: suggested || 'game.2plat', filters: [{ name: '2plat project', extensions: ['2plat'] }] });
    if (r.canceled || !r.filePath) return null; p = r.filePath;
  }
  fs.writeFileSync(p, json, 'utf8'); return p;
});
ipcMain.handle('save-file', async (_e, name, data, isBase64) => {
  const ext = path.extname(name).slice(1) || 'txt';
  const r = await dialog.showSaveDialog(win, { title: 'Save file', defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, isBase64 ? Buffer.from(data, 'base64') : data); return r.filePath;
});
ipcMain.handle('read-text', async (_e, rel) => {
  const base = path.resolve(__dirname);
  const p = path.resolve(base, rel);
  if (!p.startsWith(base + path.sep)) throw new Error('Bad path');
  return fs.readFileSync(p, 'utf8');
});
ipcMain.on('set-dirty', (_e, v) => { dirty = !!v; });

app.whenReady().then(() => { buildMenu(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
