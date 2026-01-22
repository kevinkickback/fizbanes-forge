/** BrowserWindow lifecycle helper: create, persist bounds, and expose window ops. */

import { BrowserWindow } from 'electron';
import path from 'node:path';
import { MainLogger } from './Logger.js';

let mainWindow = null;

/** Create the main application window. */
export function createMainWindow({
	preferencesManager,
	rendererPath,
	preloadPath,
	debugMode = false,
	enableDevTools = false,
}) {
	MainLogger.debug('WindowManager', 'Creating main window');

	// Get saved window bounds
	const bounds = preferencesManager.getWindowBounds();

	// Create window with saved bounds
	mainWindow = new BrowserWindow({
		width: bounds.width,
		height: bounds.height,
		x: bounds.x,
		y: bounds.y,
		minWidth: 1240,
		minHeight: 860,
		autoHideMenuBar: true, // Hide default Electron menu bar
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
		show: false, // Don't show until ready
	});

	// Open DevTools in debug mode or when explicitly enabled (before loading)
	if (debugMode || enableDevTools) {
		MainLogger.debug('WindowManager', 'Opening DevTools');
		mainWindow.webContents.openDevTools({ mode: 'detach' });
	}

	// Load the app
	mainWindow.loadFile(path.join(rendererPath, 'index.html'));

	// Show window when ready
	mainWindow.once('ready-to-show', () => {
		MainLogger.debug('WindowManager', 'Window ready to show');
		mainWindow.show();
	});

	// Setup window event handlers
	setupWindowEvents(preferencesManager);

	MainLogger.debug('WindowManager', 'Main window created');
	return mainWindow;
}

function setupWindowEvents(preferencesManager) {
	if (!mainWindow) return;
	// Save window bounds on close
	mainWindow.on('close', () => {
		const bounds = mainWindow.getBounds();
		preferencesManager.setWindowBounds(bounds);
	});

	// Handle window closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

export function getMainWindow() {
	return mainWindow;
}
