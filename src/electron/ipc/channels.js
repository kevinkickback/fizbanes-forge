/**
 * IPC Channel name constants.
 *
 * ARCHITECTURE: Main Process - Shared Constants
 *
 * PURPOSE:
 * - Single source of truth for all IPC channel names
 * - Prevents typos in channel names
 * - Makes it easy to see all available IPC operations
 * - Used by both main process handlers and preload script
 *
 * CHANNEL CONTRACTS:
 * - character:save        => request: serialized character; response: { success, path?, error? }
 * - character:list        => request: none; response: { success, characters: [], error? }
 * - character:delete      => request: id string; response: { success, error? }
 * - character:import      => request: optional config; response: { success, error?, ... }
 * - character:export      => request: id string; response: { success, path?, error? }
 * - character:generateUUID=> request: none; response: { success, data: uuid }
 * - file:selectFolder     => request: none; response: { success, path?, canceled?, error? }
 * - file:readJson         => request: filePath; response: { success, data?, error? }
 * - file:writeJson        => request: filePath, data; response: { success, error? }
 * - file:exists           => request: filePath; response: { success, exists: boolean }
 * - file:open             => request: filePath; response: { success, error? }
 * - settings:getPath      => request: key; response: value
 * - settings:setPath      => request: key, value; response: { success: boolean }
 * - settings:getAll       => request: none; response: preferences object
 * - data:loadJson         => request: fileName; response: { success, data?, error? }
 * - data:getSource        => request: none; response: { success, type?, value? }
 * - data:validateSource   => request: {type, value}; response: { success, error? }
 * - data:refreshSource    => request: none; response: { success, error?, downloaded?, skipped? }
 * - data:checkDefault     => request: none; response: { success, hasDefaultData: boolean }
 * - data:downloadProgress => event: progress updates during URL download
 * - util:getAppPath       => request: none; response: appPath string
 * - util:getUserData      => request: none; response: userDataPath string
 *
 * @module src/electron/ipc/channels
 */

export const IPC_CHANNELS = {
	// Character operations
	CHARACTER_SAVE: 'character:save',
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

	// Settings operations
	SETTINGS_GET_PATH: 'settings:getPath',
	SETTINGS_SET_PATH: 'settings:setPath',
	SETTINGS_GET_ALL: 'settings:getAll',

	// Data operations (D&D data files)
	DATA_LOAD_JSON: 'data:loadJson',
	DATA_GET_SOURCE: 'data:getSource',
	DATA_VALIDATE_SOURCE: 'data:validateSource',
	DATA_REFRESH_SOURCE: 'data:refreshSource',
	DATA_CHECK_DEFAULT: 'data:checkDefault',
	DATA_DOWNLOAD_PROGRESS: 'data:downloadProgress',

	// Utility operations
	UTIL_GET_APP_PATH: 'util:getAppPath',
	UTIL_GET_USER_DATA: 'util:getUserData',
};
