const { contextBridge, ipcRenderer } = require("electron");

// Expose Electron API methods
contextBridge.exposeInMainWorld("electron", {
    generateUUID: async () => await ipcRenderer.invoke("character:generateUUID"),
    app: {
        getPath: async (name) => {
            if (name === "userData") {
                return await ipcRenderer.invoke("util:getUserData");
            }
            return null;
        }
    },
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
    },
    loadJSON: (filePath) => {
        return ipcRenderer.invoke("data:loadJson", filePath);
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
    saveCharacter: (characterData) => {
        return ipcRenderer.invoke("character:save", characterData);
    },
    loadCharacters: () => {
        return ipcRenderer.invoke("character:list");
    },
    deleteCharacter: (id) => {
        return ipcRenderer.invoke("character:delete", id);
    },
    exportCharacter: (id) => {
        return ipcRenderer.invoke("character:export", id);
    },
    importCharacter: (userChoice) => {
        return ipcRenderer.invoke("character:import", userChoice);
    },
    openFile: (filePath) => ipcRenderer.invoke("file:open", filePath),
    setSavePath: (path) => {
        return ipcRenderer.invoke("settings:setPath", "characterSavePath", path);
    },
    selectFolder: () => {
        return ipcRenderer.invoke("file:selectFolder");
    },
    getDefaultSavePath: () => {
        return ipcRenderer.invoke("settings:getPath", "characterSavePath");
    },
    generateUUID: () => {
        return ipcRenderer.invoke("character:generateUUID");
    }
});
