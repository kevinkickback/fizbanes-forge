/**
 * IPC handlers for data operations (D&D data files).
 * 
 * @module electron/ipc/handlers/DataHandlers
 */

const { ipcMain } = require("electron");
const fs = require("node:fs").promises;
const path = require("node:path");
const { IPC_CHANNELS } = require("../channels");

function registerDataHandlers(appPath) {
    console.log("[DataHandlers] Registering data handlers");

    ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (event, fileName) => {
        try {
            // fileName may already include "data/" prefix, so handle both cases
            const filePath = fileName.startsWith("data/") || fileName.startsWith("data\\")
                ? path.join(appPath, fileName)
                : path.join(appPath, "data", fileName);

            console.log("[DataHandlers] Loading JSON:", filePath);
            const content = await fs.readFile(filePath, "utf8");
            const data = JSON.parse(content);
            return { success: true, data };
        } catch (error) {
            console.error("[DataHandlers] Load JSON failed:", error);
            return { success: false, error: error.message };
        }
    });

    console.log("[DataHandlers] All data handlers registered");
}

module.exports = { registerDataHandlers };
