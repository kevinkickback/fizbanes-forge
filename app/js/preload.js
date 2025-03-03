const { contextBridge, ipcRenderer } = require("electron");

// Expose Electron API methods
contextBridge.exposeInMainWorld("electron", {
  generateUUID: async () => await ipcRenderer.invoke("generateUUID"),
  app: {
    getPath: async (name) => {
      if (name === "userData") {
        return await ipcRenderer.invoke("get-app-data-path");
      }
      return null;
    }
  },
  ipc: {
    send: (channel, ...args) => {
      ipcRenderer.send(channel, ...args);
    },
    on: (channel, callback) => {
      const listener = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    invoke: (channel, ...args) => {
      return ipcRenderer.invoke(channel, ...args);
    }
  }
});

// Expose character data storage functions
contextBridge.exposeInMainWorld("characterStorage", {
  saveCharacter: (character) => {
    return ipcRenderer.invoke("saveCharacter", character);
  },
  loadCharacters: () => {
    return ipcRenderer.invoke("loadCharacters");
  },
  deleteCharacter: (id) => {
    return ipcRenderer.invoke("deleteCharacter", id);
  },
  exportCharacter: (id) => {
    return ipcRenderer.invoke("exportCharacter", id);
  },
  importCharacter: () => {
    return ipcRenderer.invoke("importCharacter");
  },
  generatePDF: (characterData) => {
    return ipcRenderer.invoke("generatePDF", characterData);
  },
  openFile: (filePath) => ipcRenderer.invoke("openFile", filePath),
  setSavePath: (path) => {
    return ipcRenderer.invoke("set-save-path", path);
  },
  selectFolder: () => {
    return ipcRenderer.invoke("select-folder");
  },
  checkCharacterFiles: (directory) => {
    return ipcRenderer.invoke("check-character-files", directory);
  }
});
