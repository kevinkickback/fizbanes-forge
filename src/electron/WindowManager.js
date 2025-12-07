/** BrowserWindow lifecycle helper: create, persist bounds, and expose window ops. */

import { BrowserWindow } from 'electron';
import path from 'node:path';
import { MainLogger } from './MainLogger.js';

export class WindowManager {
	constructor(preferencesManager, paths, debugMode = false) {
		this.preferencesManager = preferencesManager;
		this.rendererPath = paths.rendererPath;
		this.preloadPath = paths.preloadPath;
		this.debugMode = debugMode;
		this.mainWindow = null;
	}

	/** Create the main application window. */
	createMainWindow() {
		MainLogger.info('WindowManager', 'Creating main window');

		// Get saved window bounds
		const bounds = this.preferencesManager.getWindowBounds();

		// Create window with saved bounds
		this.mainWindow = new BrowserWindow({
			width: bounds.width,
			height: bounds.height,
			x: bounds.x,
			y: bounds.y,
			minWidth: 1000,
			minHeight: 550,
			autoHideMenuBar: true, // Hide default Electron menu bar
			webPreferences: {
				preload: this.preloadPath,
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
			},
			show: false, // Don't show until ready
		});

		// Open DevTools immediately in debug mode (before loading)
		if (this.debugMode) {
			MainLogger.info('WindowManager', 'Opening DevTools (debug mode enabled)');
			this.mainWindow.webContents.openDevTools({ mode: 'detach' });
		}

		// Load the app
		this.mainWindow.loadFile(path.join(this.rendererPath, 'index.html'));

		// Show window when ready
		this.mainWindow.once('ready-to-show', () => {
			MainLogger.info('WindowManager', 'Window ready to show');
			this.mainWindow.show();
		});

		// Setup window event handlers
		this.setupWindowEvents();

		MainLogger.info('WindowManager', 'Main window created');
		return this.mainWindow;
	}

	/** Wire window event listeners. */
	setupWindowEvents() {
		// Save window bounds on close
		this.mainWindow.on('close', () => {
			const bounds = this.mainWindow.getBounds();
			this.preferencesManager.setWindowBounds(bounds);
			MainLogger.info('WindowManager', 'Window bounds saved:', bounds);
		});

		// Handle window closed
		this.mainWindow.on('closed', () => {
			MainLogger.info('WindowManager', 'Window closed');
			this.mainWindow = null;
		});

		// Optional: Log window events for debugging
		this.mainWindow.on('resize', () => {
			// Don't log every resize, too noisy
		});

		this.mainWindow.on('move', () => {
			// Don't log every move, too noisy
		});

		this.mainWindow.on('focus', () => {
			MainLogger.info('WindowManager', 'Window focused');
		});

		this.mainWindow.on('blur', () => {
			MainLogger.info('WindowManager', 'Window blurred');
		});
	}

	/** Get the main window instance. */
	getMainWindow() {
		return this.mainWindow;
	}

	/** True if a main window exists and is not destroyed. */
	hasWindow() {
		return this.mainWindow !== null && !this.mainWindow.isDestroyed();
	}

	/** Close the main window. */
	closeWindow() {
		if (this.hasWindow()) {
			MainLogger.info('WindowManager', 'Closing window');
			this.mainWindow.close();
		}
	}

	/** Minimize the main window. */
	minimizeWindow() {
		if (this.hasWindow()) {
			this.mainWindow.minimize();
		}
	}

	/** Toggle maximize state. */
	maximizeWindow() {
		if (this.hasWindow()) {
			if (this.mainWindow.isMaximized()) {
				this.mainWindow.unmaximize();
			} else {
				this.mainWindow.maximize();
			}
		}
	}

	/** Open DevTools for the main window. */
	openDevTools() {
		if (this.hasWindow()) {
			this.mainWindow.webContents.openDevTools();
		}
	}
}
