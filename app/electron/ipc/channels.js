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
 * USAGE:
 *   const { IPC_CHANNELS } = require('./ipc/channels');
 *   ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (event, data) => {});
 * 
 * @module electron/ipc/channels
 */

const IPC_CHANNELS = {
	// Character operations
	CHARACTER_SAVE: "character:save",
	CHARACTER_LOAD: "character:load",
	CHARACTER_DELETE: "character:delete",
	CHARACTER_LIST: "character:list",
	CHARACTER_IMPORT: "character:import",
	CHARACTER_EXPORT: "character:export",
	CHARACTER_GENERATE_UUID: "character:generateUUID",

	// File operations
	FILE_SELECT: "file:select",
	FILE_SELECT_FOLDER: "file:selectFolder",
	FILE_READ_JSON: "file:readJson",
	FILE_WRITE_JSON: "file:writeJson",
	FILE_EXISTS: "file:exists",
	FILE_DELETE: "file:delete",
	FILE_OPEN: "file:open",

	// Settings operations
	SETTINGS_GET_PATH: "settings:getPath",
	SETTINGS_SET_PATH: "settings:setPath",
	SETTINGS_GET_ALL: "settings:getAll",
	SETTINGS_SET: "settings:set",
	SETTINGS_GET: "settings:get",

	// Data operations (D&D data files)
	DATA_LOAD_CLASSES: "data:loadClasses",
	DATA_LOAD_RACES: "data:loadRaces",
	DATA_LOAD_BACKGROUNDS: "data:loadBackgrounds",
	DATA_LOAD_SPELLS: "data:loadSpells",
	DATA_LOAD_EQUIPMENT: "data:loadEquipment",
	DATA_LOAD_FEATS: "data:loadFeats",
	DATA_LOAD_JSON: "data:loadJson",

	// Utility operations
	UTIL_PATH_JOIN: "util:pathJoin",
	UTIL_GET_APP_PATH: "util:getAppPath",
	UTIL_GET_USER_DATA: "util:getUserData",
};

module.exports = { IPC_CHANNELS };
