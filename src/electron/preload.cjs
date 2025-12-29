/** Hardened preload that exposes whitelisted IPC helpers to the renderer. */

const { contextBridge, ipcRenderer } = require('electron');

// Expose FF_DEBUG to renderer for conditional logging
contextBridge.exposeInMainWorld('FF_DEBUG', process.env.FF_DEBUG === 'true');

/** Application utilities exposed to renderer. */
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
	 * @param {(update: {status: string, total?: number, completed?: number, file?: string, success?: boolean, skipped?: boolean, error?: string}) => void} handler
	 * @returns {() => void} unsubscribe function
	 */
	onDataDownloadProgress: (handler) => {
		if (typeof handler !== 'function') return () => {};
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

/** Data loading helpers for JSON assets. */
contextBridge.exposeInMainWorld('data', {
	/**
	 * Load a JSON file from the configured data source.
	 * @param {string} filePath relative path (e.g., 'races.json')
	 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
	 */
	loadJSON: (filePath) => ipcRenderer.invoke('data:loadJson', filePath),
});

/** Character storage CRUD and helper IPC wrappers. */
contextBridge.exposeInMainWorld('characterStorage', {
	/**
	 * Save a character payload to disk.
	 * @param {object|string} characterData character object or JSON string
	 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
	 */
	saveCharacter: (characterData) =>
		ipcRenderer.invoke('character:save', characterData),
	/** List saved characters. */
	loadCharacters: () => ipcRenderer.invoke('character:list'),
	/** Delete a character by id. @param {string} id */
	deleteCharacter: (id) => ipcRenderer.invoke('character:delete', id),
	/** Export a character to user-selected path. @param {string} id */
	exportCharacter: (id) => ipcRenderer.invoke('character:export', id),
	/** Import a character (may prompt if userChoice omitted). @param {object} userChoice */
	importCharacter: (userChoice) =>
		ipcRenderer.invoke('character:import', userChoice),
	/** Open a file with the OS default app. @param {string} filePath */
	openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
	/** Set the save path for characters. @param {string} path */
	setSavePath: (path) =>
		ipcRenderer.invoke('settings:setPath', 'characterSavePath', path),
	/** Select a folder for file operations. */
	selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
	/** Get default character save path. */
	getDefaultSavePath: () =>
		ipcRenderer.invoke('settings:getPath', 'characterSavePath'),
	/** Generate a UUID for new characters. */
	generateUUID: () => ipcRenderer.invoke('character:generateUUID'),
});
