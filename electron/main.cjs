const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let storeData = {};
let storePath = null;
let writeTimer = null;

function loadStore() {
  storePath = path.join(app.getPath('userData'), 'store.json');
  try {
    if (fs.existsSync(storePath)) {
      storeData = JSON.parse(fs.readFileSync(storePath, 'utf8')) || {};
    }
  } catch (e) {
    storeData = {};
  }
}

function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      const tmp = storePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(storeData));
      fs.renameSync(tmp, storePath);
    } catch (e) {}
  }, 80);
}

function flushSync() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    fs.writeFileSync(storePath, JSON.stringify(storeData));
  } catch (e) {}
}

ipcMain.handle('storage:get', (_e, key) => {
  if (Object.prototype.hasOwnProperty.call(storeData, key)) {
    return { value: storeData[key] };
  }
  return null;
});

ipcMain.handle('storage:set', (_e, key, value) => {
  storeData[key] = value;
  persist();
  return true;
});

ipcMain.handle('storage:remove', (_e, key) => {
  delete storeData[key];
  persist();
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: '#1A1816',
    title: 'Daily Time Boxing',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

const isMac = process.platform === 'darwin';
const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  { role: 'windowMenu' },
];
Menu.setApplicationMenu(Menu.buildFromTemplate(template));

app.whenReady().then(() => {
  loadStore();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', flushSync);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
