/**
 * @file main.js
 * Electron application entry point.
 */

import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPCRegistry } from './ipc/IPCRegistry.js';
import { MainLogger } from './MainLogger.js';
import { PreferencesManager } from './PreferencesManager.js';
import { WindowManager } from './WindowManager.js';

// Debug mode - controlled via environment variable `FF_DEBUG`
const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;

let windowManager;
let preferencesManager;
let ipcRegistry;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererRoot = path.join(__dirname, '..', 'renderer');

app.whenReady().then(() => {
	MainLogger.info('App', 'Application ready');

	// Initialize managers
	preferencesManager = new PreferencesManager(app);
	windowManager = new WindowManager(
		preferencesManager,
		{
			rendererPath: rendererRoot,
			preloadPath: path.join(__dirname, 'preload.cjs'),
		},
		DEBUG_MODE,
	);
	ipcRegistry = new IPCRegistry(preferencesManager, windowManager);

	// Register all IPC handlers
	ipcRegistry.registerAll();

	// Create main window
	windowManager.createMainWindow();

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
	if (!windowManager.hasWindow()) {
		windowManager.createMainWindow();
	}
});

app.on('before-quit', () => {
	MainLogger.info('App', 'Application quitting');
});
