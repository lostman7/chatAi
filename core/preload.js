const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('TwinLine', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (payload) => ipcRenderer.invoke('config:update', payload),
  buildArchive: (payload) => ipcRenderer.invoke('flow:buildArchive', payload),
  retrieveContext: (payload) => ipcRenderer.invoke('flow:retrieve', payload),
  getFlowStats: () => ipcRenderer.invoke('flow:stats'),
  getAgentStatus: () => ipcRenderer.invoke('agents:status'),
  pingAgent: (agentKey) => ipcRenderer.invoke('agents:ping', agentKey),
  startConversation: (payload) => ipcRenderer.invoke('conversation:start', payload),
  stopConversation: () => ipcRenderer.invoke('conversation:stop'),
  setConversationStarter: (payload) => ipcRenderer.invoke('conversation:setStarter', payload),
  getConversationStatus: () => ipcRenderer.invoke('conversation:status'),
  reloadModels: () => ipcRenderer.invoke('conversation:reloadModels'),
  flushReasoning: () => ipcRenderer.invoke('reasoning:flush'),
  onLoopUpdate: (callback) => ipcRenderer.on('loop:update', (_, data) => callback(data))
});
