/**
 * Preload script for Electron renderer process.
 *
 * This script runs with full Node.js access but injects whitelisted APIs
 * into the renderer process via contextBridge. It maintains security by:
 * - Preventing access to fs, path, require() in renderer
 * - Only exposing specific functions through contextBridge
 * - Using invoke() for async IPC (request-response pattern)
 * - Using on() for event subscription (download progress)
 *
 * EXPOSED APIS:
 * - FF_DEBUG: Boolean flag for debug mode
 * - window.app: Application-wide utilities (data source, settings)
 * - window.data: Data loading (JSON files from configured source)
 * - window.characterStorage: Character CRUD operations
 *
 * @module src/electron/preload.cjs
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose FF_DEBUG to renderer for conditional logging
contextBridge.exposeInMainWorld('FF_DEBUG', process.env.FF_DEBUG === 'true');

/**
 * Application utilities namespace.
 * Provides access to:
 * - Data source management (configure, refresh, download)
 * - Settings (get/set application preferences)
 * - File system (select folders)
 */
contextBridge.exposeInMainWorld('app', {
	getUserDataPath: async () => await ipcRenderer.invoke('util:getUserData'),
	selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
	getDataSource: () => ipcRenderer.invoke('data:getSource'),
	refreshDataSource: () => ipcRenderer.invoke('data:refreshSource'),
	validateDataSource: (source) =>
		ipcRenderer.invoke('data:validateSource', source),
	checkDefaultDataFolder: () => ipcRenderer.invoke('data:checkDefault'),
	/**
	 * Subscribe to data download progress events.
	 * @param {Function} handler - Called with each progress update
	 * @returns {Function} Unsubscribe function
	 */
	onDataDownloadProgress: (handler) => {
		if (typeof handler !== 'function') return () => { };
		const wrapped = (_event, payload) => handler(payload);
		ipcRenderer.on('data:downloadProgress', wrapped);
		return () => ipcRenderer.removeListener('data:downloadProgress', wrapped);
	},
	settings: {
		getAll: async () => await ipcRenderer.invoke('settings:getAll'),
		get: async (key) => await ipcRenderer.invoke('settings:getPath', key),
		set: async (key, value) =>
			await ipcRenderer.invoke('settings:setPath', key, value),
	},
});

/**
 * Data loading namespace.
 * Provides access to JSON data files from configured data source.
 */
contextBridge.exposeInMainWorld('data', {
	/**
	 * Load a JSON file from the configured data source.
	 * @param {string} filePath - Relative path to JSON file (e.g., 'races.json')
	 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
	 */
	loadJSON: (filePath) => ipcRenderer.invoke('data:loadJson', filePath),
});

/**
 * Character storage namespace.
 * Provides CRUD operations for character files.
 * Handles both local saves and character imports/exports.
 */
contextBridge.exposeInMainWorld('characterStorage', {
	saveCharacter: (characterData) =>
		ipcRenderer.invoke('character:save', characterData),
	loadCharacters: () => ipcRenderer.invoke('character:list'),
	deleteCharacter: (id) => ipcRenderer.invoke('character:delete', id),
	exportCharacter: (id) => ipcRenderer.invoke('character:export', id),
	importCharacter: (userChoice) =>
		ipcRenderer.invoke('character:import', userChoice),
	openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
	setSavePath: (path) =>
		ipcRenderer.invoke('settings:setPath', 'characterSavePath', path),
	selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
	getDefaultSavePath: () =>
		ipcRenderer.invoke('settings:getPath', 'characterSavePath'),
	generateUUID: () => ipcRenderer.invoke('character:generateUUID'),
});
