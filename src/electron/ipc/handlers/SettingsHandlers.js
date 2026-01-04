/** IPC handlers for settings operations. */

import { app, ipcMain } from 'electron';
import { MainLogger } from '../../Logger.js';
import { IPC_CHANNELS } from '../channels.js';

export function registerSettingsHandlers(preferencesManager) {
	MainLogger.info('SettingsHandlers', 'Registering settings handlers');

	ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PATH, (_event, key) => {
		return preferencesManager.get(key);
	});

	ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PATH, (_event, key, value) => {
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
		return app.getPath('userData');
	});

	MainLogger.info('SettingsHandlers', 'All settings handlers registered');
}
