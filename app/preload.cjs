const { contextBridge, ipcRenderer } = require('electron');

// Expose FF_DEBUG to renderer
contextBridge.exposeInMainWorld('FF_DEBUG', process.env.FF_DEBUG === 'true');

// App-scoped utilities (whitelisted)
contextBridge.exposeInMainWorld('app', {
    getUserDataPath: async () => await ipcRenderer.invoke('util:getUserData'),
    settings: {
        getAll: async () => await ipcRenderer.invoke('settings:getAll'),
        get: async (key) => await ipcRenderer.invoke('settings:getPath', key),
        set: async (key, value) => await ipcRenderer.invoke('settings:setPath', key, value),
    },
});

// Data domain: restrict to catalog JSON under app/data
contextBridge.exposeInMainWorld('data', {
    loadJSON: (filePath) => ipcRenderer.invoke('data:loadJson', filePath),
});

// Expose character data storage functions
contextBridge.exposeInMainWorld('characterStorage', {
    saveCharacter: (characterData) => ipcRenderer.invoke('character:save', characterData),
    loadCharacters: () => ipcRenderer.invoke('character:list'),
    deleteCharacter: (id) => ipcRenderer.invoke('character:delete', id),
    exportCharacter: (id) => ipcRenderer.invoke('character:export', id),
    importCharacter: (userChoice) => ipcRenderer.invoke('character:import', userChoice),
    openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
    setSavePath: (path) => ipcRenderer.invoke('settings:setPath', 'characterSavePath', path),
    selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
    getDefaultSavePath: () => ipcRenderer.invoke('settings:getPath', 'characterSavePath'),
    generateUUID: () => ipcRenderer.invoke('character:generateUUID'),
});