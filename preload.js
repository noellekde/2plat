const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  isElectron: true,
  openProject: () => ipcRenderer.invoke('open-project'),
  saveProject: (json, existing, suggested) => ipcRenderer.invoke('save-project', json, existing, suggested),
  saveFile: (name, data, isBase64) => ipcRenderer.invoke('save-file', name, data, isBase64),
  readText: (rel) => ipcRenderer.invoke('read-text', rel),
  setDirty: (v) => ipcRenderer.send('set-dirty', v),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, a) => cb(a)),
});
