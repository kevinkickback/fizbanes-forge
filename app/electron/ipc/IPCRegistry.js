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

import { MainLogger } from '../MainLogger.js';
import { registerCharacterHandlers } from './handlers/CharacterHandlers.js';
import { registerDataHandlers } from './handlers/DataHandlers.js';
import { registerFileHandlers } from './handlers/FileHandlers.js';
import { registerSettingsHandlers } from './handlers/SettingsHandlers.js';

export class IPCRegistry {
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
