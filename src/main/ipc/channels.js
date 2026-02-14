/**
 * Single source of truth for IPC channel names.
 * Preload.cjs must inline its own copy (Electron sandbox blocks imports);
 * IpcChannels.test.js verifies the two stay in sync.
 */

export const IPC_CHANNELS = {
	// Character operations
	CHARACTER_SAVE: 'character:save',
	CHARACTER_LOAD: 'character:load',
	CHARACTER_DELETE: 'character:delete',
	CHARACTER_LIST: 'character:list',
	CHARACTER_IMPORT: 'character:import',
	CHARACTER_EXPORT: 'character:export',
	CHARACTER_GENERATE_UUID: 'character:generateUUID',

	// File operations
	FILE_SELECT_FOLDER: 'file:selectFolder',
	FILE_READ_JSON: 'file:readJson',
	FILE_WRITE_JSON: 'file:writeJson',
	FILE_EXISTS: 'file:exists',
	FILE_OPEN: 'file:open',
	FILE_OPEN_EXTERNAL: 'file:openExternal',

	// Settings operations
	SETTINGS_GET_PATH: 'settings:getPath',
	SETTINGS_SET_PATH: 'settings:setPath',
	SETTINGS_GET_ALL: 'settings:getAll',

	// Portrait operations
	PORTRAITS_LIST: 'portraits:list',
	PORTRAITS_SAVE: 'portraits:save',

	// Data operations (D&D data files)
	DATA_LOAD_JSON: 'data:loadJson',
	DATA_FILE_EXISTS: 'data:fileExists',
	DATA_GET_SOURCE: 'data:getSource',
	DATA_VALIDATE_SOURCE: 'data:validateSource',
	DATA_REFRESH_SOURCE: 'data:refreshSource',
	DATA_CHECK_DEFAULT: 'data:checkDefault',
	DATA_DOWNLOAD_PROGRESS: 'data:downloadProgress',

	// Utility operations
	UTIL_GET_APP_PATH: 'util:getAppPath',
	UTIL_GET_USER_DATA: 'util:getUserData',

	// PDF export operations
	CHARACTER_EXPORT_PDF: 'character:exportPdf',
	CHARACTER_PDF_PREVIEW: 'character:pdfPreview',
	PDF_LIST_TEMPLATES: 'pdf:listTemplates',
};
