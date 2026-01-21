import { app, ipcMain } from 'electron';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

const ALLOWED_KEYS = new Set([
	'characterSavePath',
	'lastOpenedCharacter',
	'windowBounds',
	'theme',
	'logLevel',
	'autoSave',
	'autoSaveInterval',
	'dataSourceType',
	'dataSourceValue',
	'dataSourceCachePath',
]);

export function registerSettingsHandlers(preferencesManager) {
	MainLogger.info('SettingsHandlers', 'Registering settings handlers');

	ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PATH, (_event, key) => {
		if (!ALLOWED_KEYS.has(key)) {
			return { success: false, error: 'Access to the requested key is denied' };
		}
		return preferencesManager.get(key);
	});

	ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PATH, (_event, key, value) => {
		if (!ALLOWED_KEYS.has(key)) {
			return { success: false, error: 'Access to the requested key is denied' };
		}
		preferencesManager.set(key, value);
		return { success: true };
	});

	ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
		const all = preferencesManager.getAll();
		const filtered = Object.fromEntries(
			Object.entries(all).filter(([k]) => ALLOWED_KEYS.has(k)),
		);
		return filtered;
	});

	ipcMain.handle(IPC_CHANNELS.UTIL_GET_APP_PATH, () => {
		return app.getAppPath();
	});

	ipcMain.handle(IPC_CHANNELS.UTIL_GET_USER_DATA, () => {
		return app.getPath('userData');
	});

	MainLogger.info('SettingsHandlers', 'All settings handlers registered');
}
