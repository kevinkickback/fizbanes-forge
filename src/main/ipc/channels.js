/** Central list of IPC channel names shared by main and preload. */

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

	// Equipment operations
	EQUIPMENT_ADD_ITEM: 'equipment:addItem',
	EQUIPMENT_REMOVE_ITEM: 'equipment:removeItem',
	EQUIPMENT_EQUIP_ITEM: 'equipment:equipItem',
	EQUIPMENT_UNEQUIP_ITEM: 'equipment:unequipItem',
	EQUIPMENT_ATTUNE_ITEM: 'equipment:attuneItem',
	EQUIPMENT_UNATTUNE_ITEM: 'equipment:unattuneItem',
	EQUIPMENT_CALCULATE_WEIGHT: 'equipment:calculateWeight',
	EQUIPMENT_CHECK_ENCUMBRANCE: 'equipment:checkEncumbrance',

	// Spell operations
	SPELL_ADD_KNOWN: 'spell:addKnown',
	SPELL_REMOVE_KNOWN: 'spell:removeKnown',
	SPELL_PREPARE_SPELL: 'spell:prepareSpell',
	SPELL_UNPREPARE_SPELL: 'spell:unprepareSpell',
	SPELL_USE_SLOT: 'spell:useSlot',
	SPELL_RESTORE_SLOTS: 'spell:restoreSlots',
	SPELL_INITIALIZE_CLASS: 'spell:initializeClass',

	// Level-up operations
	PROGRESSION_INCREASE_LEVEL: 'progression:increaseLevel',
	PROGRESSION_DECREASE_LEVEL: 'progression:decreaseLevel',
	PROGRESSION_ADD_CLASS_LEVEL: 'progression:addClassLevel',
	PROGRESSION_REMOVE_CLASS_LEVEL: 'progression:removeClassLevel',
	PROGRESSION_CALCULATE_HP: 'progression:calculateHP',
};
