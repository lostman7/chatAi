const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { ensureSettingsLoaded, getConfig, updateConfig } = require('./settings');
const { startConversationLoop, stopConversationLoop, getLoopStatus, setConversationStarter } = require('./conversationEngine');
const { getFlowStats, buildArchive, retrieveContext, reloadModels } = require('./ragService');
const { getAgentStatus } = require('./agentManager');
const { ReasoningLogger } = require('./logger');

let mainWindow;
const reasoningLogger = new ReasoningLogger();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const startURL = app.isPackaged
    ? `file://${path.join(__dirname, '../ui/dist/index.html')}`
    : `file://${path.join(__dirname, '../ui/public/index.html')}`;

  mainWindow.loadURL(startURL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  await ensureSettingsLoaded();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('config:get', async () => getConfig());
ipcMain.handle('config:update', async (_event, payload) => {
  const updated = await updateConfig(payload);
  return updated;
});

ipcMain.handle('flow:buildArchive', async (_event, payload) => {
  const result = await buildArchive(payload?.folderPath);
  return result;
});

ipcMain.handle('flow:retrieve', async (_event, payload) => {
  return retrieveContext(payload?.query || '', payload?.topK);
});

ipcMain.handle('flow:stats', async () => getFlowStats());
ipcMain.handle('agents:status', async () => getAgentStatus());

ipcMain.handle('conversation:start', async (_event, payload) => {
  if (payload?.starter) setConversationStarter(payload.starter);
  return startConversationLoop(reasoningLogger);
});

ipcMain.handle('conversation:stop', async () => stopConversationLoop());
ipcMain.handle('conversation:setStarter', async (_event, payload) => {
  setConversationStarter(payload?.starter || '');
  return getLoopStatus();
});
ipcMain.handle('conversation:status', async () => getLoopStatus());
ipcMain.handle('conversation:reloadModels', async () => reloadModels());
ipcMain.handle('reasoning:flush', async () => reasoningLogger.flush());

