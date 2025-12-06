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
 * @module src/electron/ipc/IPCRegistry
 */

import { MainLogger } from '../MainLogger.js';
import { registerCharacterHandlers } from './handlers/CharacterHandlers.js';
import { registerDataHandlers } from './handlers/DataHandlers.js';
import { registerFileHandlers } from './handlers/FileHandlers.js';
import { registerSettingsHandlers } from './handlers/SettingsHandlers.js';

export class IPCRegistry {
	constructor(preferencesManager, windowManager, dataPath) {
		this.preferencesManager = preferencesManager;
		this.windowManager = windowManager;
		this.dataPath = dataPath;
	}

	registerAll() {
		MainLogger.info('IPCRegistry', 'Registering all IPC handlers');

		registerCharacterHandlers(this.preferencesManager, this.windowManager);
		registerFileHandlers(this.windowManager);
		registerSettingsHandlers(this.preferencesManager);
		registerDataHandlers(this.dataPath, this.preferencesManager);

		MainLogger.info('IPCRegistry', 'All IPC handlers registered');
	}
}
