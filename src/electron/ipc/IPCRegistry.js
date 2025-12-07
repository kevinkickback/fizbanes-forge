/** Registers all IPC handler groups for the main process. */

import { MainLogger } from '../MainLogger.js';
import { registerCharacterHandlers } from './handlers/CharacterHandlers.js';
import { registerDataHandlers } from './handlers/DataHandlers.js';
import { registerFileHandlers } from './handlers/FileHandlers.js';
import { registerSettingsHandlers } from './handlers/SettingsHandlers.js';

export class IPCRegistry {
	constructor(preferencesManager, windowManager) {
		this.preferencesManager = preferencesManager;
		this.windowManager = windowManager;
	}

	registerAll() {
		MainLogger.info('IPCRegistry', 'Registering all IPC handlers');

		registerCharacterHandlers(this.preferencesManager, this.windowManager);
		registerFileHandlers(this.windowManager);
		registerSettingsHandlers(this.preferencesManager);
		registerDataHandlers(this.preferencesManager);

		MainLogger.info('IPCRegistry', 'All IPC handlers registered');
	}
}
