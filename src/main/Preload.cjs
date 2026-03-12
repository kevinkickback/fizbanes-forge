const { contextBridge, ipcRenderer } = require('electron');

// Electron sandbox prevents require() of arbitrary files, so values are inlined here.
// A unit test (IpcChannels.test.js) verifies these stay in sync.
const IPC_CHANNELS = {
	CHARACTER_SAVE: 'character:save',
	CHARACTER_LOAD: 'character:load',
	CHARACTER_DELETE: 'character:delete',
	CHARACTER_LIST: 'character:list',
	CHARACTER_IMPORT: 'character:import',
	CHARACTER_EXPORT: 'character:export',
	CHARACTER_GENERATE_UUID: 'character:generateUUID',
	FILE_SELECT_FOLDER: 'file:selectFolder',
	FILE_OPEN: 'file:open',
	FILE_OPEN_EXTERNAL: 'file:openExternal',
	SETTINGS_GET_PATH: 'settings:getPath',
	SETTINGS_SET_PATH: 'settings:setPath',
	SETTINGS_GET_ALL: 'settings:getAll',
	PORTRAITS_LIST: 'portraits:list',
	PORTRAITS_SAVE: 'portraits:save',
	DATA_LOAD_JSON: 'data:loadJson',
	DATA_FILE_EXISTS: 'data:fileExists',
	DATA_GET_SOURCE: 'data:getSource',
	DATA_VALIDATE_SOURCE: 'data:validateSource',
	DATA_REFRESH_SOURCE: 'data:refreshSource',
	DATA_CHECK_DEFAULT: 'data:checkDefault',
	DATA_DOWNLOAD_PROGRESS: 'data:downloadProgress',
	UTIL_GET_USER_DATA: 'util:getUserData',
	CHARACTER_EXPORT_PDF: 'character:exportPdf',
	CHARACTER_PDF_PREVIEW: 'character:pdfPreview',
	PDF_LIST_TEMPLATES: 'pdf:listTemplates',
};

// Expose FF_DEBUG to renderer for conditional logging
contextBridge.exposeInMainWorld('FF_DEBUG', process.env.FF_DEBUG === 'true');

contextBridge.exposeInMainWorld('app', {
	getUserDataPath: async () =>
		await ipcRenderer.invoke(IPC_CHANNELS.UTIL_GET_USER_DATA),
	selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),
	openExternal: (url) =>
		ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_EXTERNAL, url),
	getDataSource: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_SOURCE),
	refreshDataSource: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_REFRESH_SOURCE),
	validateDataSource: (source) =>
		ipcRenderer.invoke(IPC_CHANNELS.DATA_VALIDATE_SOURCE, source),
	checkDefaultDataFolder: () =>
		ipcRenderer.invoke(IPC_CHANNELS.DATA_CHECK_DEFAULT),
	/** Subscribe to data download progress events. Returns unsubscribe function. */
	onDataDownloadProgress: (handler) => {
		if (typeof handler !== 'function') return () => { };
		const wrapped = (_event, payload) => handler(payload);
		ipcRenderer.on(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, wrapped);
		return () =>
			ipcRenderer.removeListener(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, wrapped);
	},
	settings: {
		getAll: async () => await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
		get: async (key) =>
			await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_PATH, key),
		set: async (key, value) =>
			await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_PATH, key, value),
	},
});

contextBridge.exposeInMainWorld('data', {
	loadJSON: (filePath) =>
		ipcRenderer.invoke(IPC_CHANNELS.DATA_LOAD_JSON, filePath),
	fileExists: (filePath) =>
		ipcRenderer.invoke(IPC_CHANNELS.DATA_FILE_EXISTS, filePath),
});

contextBridge.exposeInMainWorld('characterStorage', {
	saveCharacter: (characterData) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_SAVE, characterData),
	loadCharacter: (id) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_LOAD, id),
	loadCharacters: () => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_LIST),
	deleteCharacter: (id) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_DELETE, id),
	exportCharacter: (id) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_EXPORT, id),
	importCharacter: (userChoice) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_IMPORT, userChoice),
	openFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN, filePath),
	setSavePath: (path) =>
		ipcRenderer.invoke(
			IPC_CHANNELS.SETTINGS_SET_PATH,
			'characterSavePath',
			path,
		),
	getDefaultSavePath: () =>
		ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_PATH, 'characterSavePath'),
	generateUUID: () => ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_GENERATE_UUID),
	savePortrait: (portraitsDir, imageData, fileName) =>
		ipcRenderer.invoke(
			IPC_CHANNELS.PORTRAITS_SAVE,
			portraitsDir,
			imageData,
			fileName,
		),
	listPortraits: (dirPath) =>
		ipcRenderer.invoke(IPC_CHANNELS.PORTRAITS_LIST, dirPath),
	previewPdf: (characterData, templateName) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_PDF_PREVIEW, characterData, templateName),
	exportPdf: (characterData, templateName) =>
		ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_EXPORT_PDF, characterData, templateName),
	listPdfTemplates: () =>
		ipcRenderer.invoke(IPC_CHANNELS.PDF_LIST_TEMPLATES),
});
