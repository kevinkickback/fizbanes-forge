/**
 * IPC handlers for data operations (D&D data files).
 * 
 * @module electron/ipc/handlers/DataHandlers
 */

const { ipcMain } = require("electron");
const fs = require("node:fs").promises;
const path = require("node:path");
const { IPC_CHANNELS } = require("../channels");
const { MainLogger } = require("../../MainLogger");

function registerDataHandlers(appPath) {
    MainLogger.info('DataHandlers', 'Registering data handlers');

    ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (event, fileName) => {
        try {
            // fileName may already include "data/" prefix, so handle both cases
            const filePath = fileName.startsWith("data/") || fileName.startsWith("data\\")
                ? path.join(appPath, fileName)
                : path.join(appPath, "data", fileName);

            MainLogger.info('DataHandlers', 'Loading JSON:', filePath);
            const content = await fs.readFile(filePath, "utf8");
            const data = JSON.parse(content);
            return { success: true, data };
        } catch (error) {
            MainLogger.error('DataHandlers', 'Load JSON failed:', error);
            return { success: false, error: error.message };
        }
    });

    MainLogger.info('DataHandlers', 'All data handlers registered');
}

module.exports = { registerDataHandlers };
