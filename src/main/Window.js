import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { MainLogger } from './Logger.js';

let mainWindow = null;

export function createMainWindow({
	preferencesManager,
	rendererPath,
	preloadPath,
	debugMode = false,
	enableDevTools = false,
}) {
	MainLogger.debug('WindowManager', 'Creating main window');

	const bounds = preferencesManager.getWindowBounds();

	mainWindow = new BrowserWindow({
		width: bounds.width,
		height: bounds.height,
		x: bounds.x,
		y: bounds.y,
		minWidth: 1240,
		minHeight: 860,
		autoHideMenuBar: true,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			devTools: !app.isPackaged && (debugMode || enableDevTools),
		},
		show: false,
	});

	if (!app.isPackaged && (debugMode || enableDevTools)) {
		MainLogger.debug('WindowManager', 'Opening DevTools');
		mainWindow.webContents.openDevTools({ mode: 'detach' });
	}

	mainWindow.loadFile(path.join(rendererPath, 'index.html'));

	mainWindow.once('ready-to-show', () => {
		MainLogger.debug('WindowManager', 'Window ready to show');
		mainWindow.show();
	});

	mainWindow.webContents.on('will-navigate', (event) => {
		MainLogger.warn('WindowManager', 'Blocked navigation attempt');
		event.preventDefault();
	});

	mainWindow.webContents.setWindowOpenHandler(() => {
		MainLogger.warn('WindowManager', 'Blocked new window attempt');
		return { action: 'deny' };
	});

	setupWindowEvents(preferencesManager);

	MainLogger.debug('WindowManager', 'Main window created');
	return mainWindow;
}

function setupWindowEvents(preferencesManager) {
	if (!mainWindow) return;
	mainWindow.on('close', () => {
		const bounds = mainWindow.getBounds();
		preferencesManager.setWindowBounds(bounds);
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

export function getMainWindow() {
	return mainWindow;
}
