import { registerCharacterHandlers } from './ipc/handlers/CharacterHandlers.js';
import { registerDataHandlers } from './ipc/handlers/DataHandlers.js';
import { registerFileHandlers } from './ipc/handlers/FileHandlers.js';
import { registerSettingsHandlers } from './ipc/handlers/SettingsHandlers.js';
/** Electron application entry point. */

import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MainLogger } from './MainLogger.js';
import {
	clearPreferences,
	getAllPreferences,
	getCharacterSavePath,
	getLastOpenedCharacter,
	getPreference,
	getWindowBounds,
	initPreferences,
	setLastOpenedCharacter,
	setPreference,
	setWindowBounds,
} from './PreferencesManager.js';
import { createMainWindow, getMainWindow } from './WindowManager.js';

// Debug mode - controlled via environment variable `FF_DEBUG`
const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererRoot = path.join(__dirname, '..', 'renderer');

app.whenReady().then(() => {
	MainLogger.info('App', 'Application ready');

	// Initialize preferences
	initPreferences(app);

	// Register all IPC handlers directly
	registerCharacterHandlers(
		{
			get: getPreference,
			set: setPreference,
			getWindowBounds,
			setWindowBounds,
			getCharacterSavePath,
			getLastOpenedCharacter,
			setLastOpenedCharacter,
			getAllPreferences,
			clearPreferences,
		},
		{ getMainWindow },
	);
	registerFileHandlers({ getMainWindow });
	registerSettingsHandlers({
		get: getPreference,
		set: setPreference,
		getAll: getAllPreferences,
	});
	registerDataHandlers({
		get: getPreference,
		set: setPreference,
		app,
	});

	// Create main window
	createMainWindow({
		preferencesManager: {
			getWindowBounds,
			setWindowBounds,
		},
		rendererPath: rendererRoot,
		preloadPath: path.join(__dirname, 'preload.cjs'),
		debugMode: DEBUG_MODE,
	});

	MainLogger.info('App', 'Application initialized');
});

app.on('window-all-closed', () => {
	MainLogger.info('App', 'All windows closed');
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	MainLogger.info('App', 'Application activated');
	const win = getMainWindow();
	if (!win || win.isDestroyed()) {
		createMainWindow({
			preferencesManager: {
				getWindowBounds,
				setWindowBounds,
			},
			rendererPath: rendererRoot,
			preloadPath: path.join(__dirname, 'preload.cjs'),
			debugMode: DEBUG_MODE,
		});
	}
});

app.on('before-quit', () => {
	MainLogger.info('App', 'Application quitting');
});
