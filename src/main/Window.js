/** BrowserWindow lifecycle helper: create, persist bounds, and expose window ops. */

import { BrowserWindow } from 'electron';
import path from 'node:path';
import { MainLogger } from './Logger.js';

let mainWindow = null;

/**
 * Create the main application window.
 * @param {object} options - { preferencesManager, rendererPath, preloadPath, debugMode }
 * @returns {BrowserWindow}
 */
export function createMainWindow({
	preferencesManager,
	rendererPath,
	preloadPath,
	debugMode = false,
}) {
	MainLogger.info('WindowManager', 'Creating main window');

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

	// Open DevTools immediately in debug mode (before loading)
	if (debugMode) {
		MainLogger.info('WindowManager', 'Opening DevTools (debug mode enabled)');
		mainWindow.webContents.openDevTools({ mode: 'detach' });
	}

	// Load the app
	mainWindow.loadFile(path.join(rendererPath, 'index.html'));

	// Show window when ready
	mainWindow.once('ready-to-show', () => {
		MainLogger.info('WindowManager', 'Window ready to show');
		mainWindow.show();
	});

	// Setup window event handlers
	setupWindowEvents(preferencesManager);

	MainLogger.info('WindowManager', 'Main window created');
	return mainWindow;
}

/**
 * Wire window event listeners.
 * @param {object} preferencesManager
 */
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

/**
 * Get the current main window instance.
 */
export function getMainWindow() {
	return mainWindow;
}
