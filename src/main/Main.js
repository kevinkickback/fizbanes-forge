import 'dotenv/config';
/** Electron application entry point. */

import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerCharacterHandlers } from './ipc/CharacterHandlers.js';
import { registerDataHandlers } from './ipc/DataHandlers.js';
import { registerEquipmentHandlers } from './ipc/EquipmentHandlers.js';
import { registerFileHandlers } from './ipc/FileHandlers.js';
import { registerProgressionHandlers } from './ipc/ProgressionHandlers.js';
import { registerSettingsHandlers } from './ipc/SettingsHandlers.js';
import { registerSpellHandlers } from './ipc/SpellHandlers.js';
import { MainLogger } from './Logger.js';
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
} from './Settings.js';
import { createMainWindow, getMainWindow } from './Window.js';

// Environment variables loaded from .env file (see .env.example)
const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;
const ENABLE_DEVTOOLS = process.env.FF_DEVTOOLS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererRoot = path.join(__dirname, '..', 'ui');

app.whenReady().then(() => {
	MainLogger.debug('App', 'Application ready');

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
	registerEquipmentHandlers();
	registerSpellHandlers();
	registerProgressionHandlers();

	// Create main window
	createMainWindow({
		preferencesManager: {
			getWindowBounds,
			setWindowBounds,
		},
		rendererPath: rendererRoot,
		preloadPath: path.join(__dirname, 'Preload.cjs'),
		debugMode: DEBUG_MODE,
		enableDevTools: DEBUG_MODE || ENABLE_DEVTOOLS,
	});

	MainLogger.debug('App', 'Application initialized');
});

app.on('window-all-closed', () => {
	MainLogger.debug('App', 'All windows closed');
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	MainLogger.debug('App', 'Application activated');
	const win = getMainWindow();
	if (!win || win.isDestroyed()) {
		createMainWindow({
			preferencesManager: {
				getWindowBounds,
				setWindowBounds,
			},
			rendererPath: rendererRoot,
			preloadPath: path.join(__dirname, 'Preload.cjs'),
			debugMode: DEBUG_MODE,
			enableDevTools: DEBUG_MODE || ENABLE_DEVTOOLS,
		});
	}
});

app.on('before-quit', () => {
	MainLogger.debug('App', 'Application quitting');
});
