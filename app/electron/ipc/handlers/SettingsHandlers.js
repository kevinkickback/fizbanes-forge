/**
 * IPC handlers for settings operations.
 * 
 * @module electron/ipc/handlers/SettingsHandlers
 */

const { ipcMain, app } = require("electron");
const { IPC_CHANNELS } = require("../channels");

function registerSettingsHandlers(preferencesManager) {
    console.log("[SettingsHandlers] Registering settings handlers");

    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PATH, (event, key) => {
        return preferencesManager.get(key);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PATH, (event, key, value) => {
        preferencesManager.set(key, value);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
        return preferencesManager.getAll();
    });

    ipcMain.handle(IPC_CHANNELS.UTIL_GET_APP_PATH, () => {
        return app.getAppPath();
    });

    ipcMain.handle(IPC_CHANNELS.UTIL_GET_USER_DATA, () => {
        return app.getPath("userData");
    });

    console.log("[SettingsHandlers] All settings handlers registered");
}

module.exports = { registerSettingsHandlers };
