/**
 * Main process entry point for Fizbane''s Forge.
 *
 * REFACTORED: Phase 2 - Main process split into modular components
 *
 * This file now serves as the application entry point only, delegating
 * responsibilities to specialized managers and handlers.
 */

import { app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPCRegistry } from './electron/ipc/IPCRegistry.js';
import { MainLogger } from './electron/MainLogger.js';
import { PreferencesManager } from './electron/PreferencesManager.js';
import { WindowManager } from './electron/WindowManager.js';

// Debug mode - controlled via environment variable `FF_DEBUG`
const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;

let windowManager;
let preferencesManager;
let ipcRegistry;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.whenReady().then(() => {
	MainLogger.info('App', 'Application ready');

	// Initialize managers
	preferencesManager = new PreferencesManager(app);
	windowManager = new WindowManager(preferencesManager, __dirname, DEBUG_MODE);
	ipcRegistry = new IPCRegistry(preferencesManager, windowManager, __dirname);

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
export { };
