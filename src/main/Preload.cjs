/** Hardened preload that exposes whitelisted IPC helpers to the renderer. */

const { contextBridge, ipcRenderer } = require('electron');

// IPC channel names - MUST be kept in sync with src/main/ipc/channels.js
// Hardcoded here because sandbox environment cannot dynamically import ESM modules
// IMPORTANT: Any changes to channel names must be mirrored in both files
const IPC_CHANNELS = {
	// Character operations
	CHARACTER_SAVE: 'character:save',
	CHARACTER_DELETE: 'character:delete',
	CHARACTER_LIST: 'character:list',
	CHARACTER_IMPORT: 'character:import',
	CHARACTER_EXPORT: 'character:export',
	CHARACTER_GENERATE_UUID: 'character:generateUUID',
	// File operations
	FILE_SELECT_FOLDER: 'file:selectFolder',
	FILE_OPEN: 'file:open',
	// Settings operations
	SETTINGS_GET_PATH: 'settings:getPath',
	SETTINGS_SET_PATH: 'settings:setPath',
	SETTINGS_GET_ALL: 'settings:getAll',
	// Portrait operations
	PORTRAITS_LIST: 'portraits:list',
	PORTRAITS_SAVE: 'portraits:save',
	// Data operations
	DATA_LOAD_JSON: 'data:loadJson',
	DATA_GET_SOURCE: 'data:getSource',
	DATA_VALIDATE_SOURCE: 'data:validateSource',
	DATA_REFRESH_SOURCE: 'data:refreshSource',
	DATA_CHECK_DEFAULT: 'data:checkDefault',
	DATA_DOWNLOAD_PROGRESS: 'data:downloadProgress',
	// Utility operations
	UTIL_GET_USER_DATA: 'util:getUserData',
};

// Expose FF_DEBUG to renderer for conditional logging
contextBridge.exposeInMainWorld('FF_DEBUG', process.env.FF_DEBUG === 'true');

/** Application utilities exposed to renderer. */
contextBridge.exposeInMainWorld('app', {
	getUserDataPath: async () => await ipcRenderer.invoke(IPC_CHANNELS.UTIL_GET_USER_DATA),
	selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),
	getDataSource: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_SOURCE),
	refreshDataSource: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_REFRESH_SOURCE),
	validateDataSource: (source) =>
		ipcRenderer.invoke(IPC_CHANNELS.DATA_VALIDATE_SOURCE, source),
	checkDefaultDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_CHECK_DEFAULT),
	/**
	 * Subscribe to data download progress events.
	 * @param {(update: {status: string, total?: number, completed?: number, file?: string, success?: boolean, skipped?: boolean, error?: string}) => void} handler
	 * @returns {() => void} unsubscribe function
	 */
	onDataDownloadProgress: (handler) => {
		if (typeof handler !== 'function') return () => { };
		const wrapped = (_event, payload) => handler(payload);
		ipcRenderer.on(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, wrapped);
		return () => ipcRenderer.removeListener(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, wrapped);
	},
	settings: {
		getAll: async () => await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
		get: async (key) => await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_PATH, key),
		set: async (key, value) =>
			await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_PATH, key, value),
	},
});

/** Data loading helpers for JSON assets. */
contextBridge.exposeInMainWorld('data', {
	/**
	 * Load a JSON file from the configured data source.
	 * @param {string} filePath relative path (e.g., 'races.json')
	 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
	 */
	loadJSON: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.DATA_LOAD_JSON, filePath),
});

/** Character storage CRUD and helper IPC wrappers. */
contextBridge.exposeInMainWorld('characterStorage', {
	/**
	 * Save a character payload to disk.
	 * @param {object|string} characterData character object or JSON string
	 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
	 */
	saveCharacter: (characterData) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_SAVE, characterData),
	/** List saved characters. */
	loadCharacters: () => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_LIST),
	/** Delete a character by id. @param {string} id */
	deleteCharacter: (id) => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_DELETE, id),
	/** Export a character to user-selected path. @param {string} id */
	exportCharacter: (id) => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_EXPORT, id),
	/** Import a character (may prompt if userChoice omitted). @param {object} userChoice */
	importCharacter: (userChoice) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_IMPORT, userChoice),
	/** Open a file with the OS default app. @param {string} filePath */
	openFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN, filePath),
	/** Set the save path for characters. @param {string} path */
	setSavePath: (path) =>
		ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_PATH, 'characterSavePath', path),
	/** Select a folder for file operations. */
	selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),
	/** Get default character save path. */
	getDefaultSavePath: () =>
		ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_PATH, 'characterSavePath'),
	/** Generate a UUID for new characters. */
	generateUUID: () => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_GENERATE_UUID),
	/**
	 * Save a portrait image to the portraits directory.
	 * @param {string} portraitsDir path to portraits directory
	 * @param {string} imageData base64 data URL or base64 string
	 * @param {string} fileName original filename with extension
	 * @returns {Promise<{success: boolean, filePath?: string, fileName?: string, error?: string}>}
	 */
	savePortrait: (portraitsDir, imageData, fileName) =>
		ipcRenderer.invoke(
			IPC_CHANNELS.PORTRAITS_SAVE,
			portraitsDir,
			imageData,
			fileName,
		),
	/** List portrait files in a directory. @param {string} dirPath */
	listPortraits: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.PORTRAITS_LIST, dirPath),
});
