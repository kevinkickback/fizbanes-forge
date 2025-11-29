/**
 * Central IPC handler registry.
 * 
 * ARCHITECTURE: Main Process - IPC Registration
 * 
 * PURPOSE:
 * - Register all IPC handlers in one place
 * - Organize handlers by domain
 * - Make it easy to see all IPC operations
 * 
 * @module electron/ipc/IPCRegistry
 */

const { registerCharacterHandlers } = require("./handlers/CharacterHandlers");
const { registerFileHandlers } = require("./handlers/FileHandlers");
const { registerSettingsHandlers } = require("./handlers/SettingsHandlers");
const { registerDataHandlers } = require("./handlers/DataHandlers");
const { MainLogger } = require("../MainLogger");

class IPCRegistry {
    constructor(preferencesManager, windowManager, appPath) {
        this.preferencesManager = preferencesManager;
        this.windowManager = windowManager;
        this.appPath = appPath;
    }

    registerAll() {
        MainLogger.info('IPCRegistry', 'Registering all IPC handlers');

        registerCharacterHandlers(this.preferencesManager, this.windowManager);
        registerFileHandlers();
        registerSettingsHandlers(this.preferencesManager);
        registerDataHandlers(this.appPath);

        MainLogger.info('IPCRegistry', 'All IPC handlers registered');
    }
}

module.exports = { IPCRegistry };
