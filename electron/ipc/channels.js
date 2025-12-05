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
 * - character:save        => request: serialized character object; response: { success, path? , error? }
 * - character:list        => request: none; response: { success, characters: [], error? }
 * - character:delete      => request: id string; response: { success, error? }
 * - character:import      => request: optional { sourceFilePath?, character?, action? }; response: branching per import flow
 * - character:export      => request: id string; response: { success, path?, canceled?, error? }
 * - character:generateUUID=> request: none; response: { success, data }
 * - file:selectFolder     => request: none; response: { success, path?, canceled?, error? }
 * - file:readJson         => request: filePath; response: { success, data?, error? }
 * - file:writeJson        => request: filePath, data; response: { success, error? }
 * - file:exists           => request: filePath; response: { success, exists }
 * - file:open             => request: filePath; response: { success, error? }
 * - settings:getPath      => request: key; response: value
 * - settings:setPath      => request: key, value; response: { success }
 * - settings:getAll       => request: none; response: preferences object
 * - settings:set          => request: key, value; response: { success }
 * - settings:get          => request: key; response: value
 * - data:loadJson         => request: fileName ('data/...' or bare); response: { success, data?, error? }
 * - util:getAppPath       => request: none; response: appPath
 * - util:getUserData      => request: none; response: userDataPath
 *
 * USAGE:
 *   const { IPC_CHANNELS } = require('./ipc/channels');
 *   ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (event, data) => {});
 *
 * @module electron/ipc/channels
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

	// Settings operations
	SETTINGS_GET_PATH: 'settings:getPath',
	SETTINGS_SET_PATH: 'settings:setPath',
	SETTINGS_GET_ALL: 'settings:getAll',
	SETTINGS_SET: 'settings:set',
	SETTINGS_GET: 'settings:get',

	// Data operations (D&D data files)
	DATA_LOAD_JSON: 'data:loadJson',

	// Utility operations
	UTIL_PATH_JOIN: 'util:pathJoin',
	UTIL_GET_APP_PATH: 'util:getAppPath',
	UTIL_GET_USER_DATA: 'util:getUserData',
};
