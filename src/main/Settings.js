/** Preference storage/validation for the main process using electron-store. */

import Store from 'electron-store';
import fs from 'node:fs';
import path from 'node:path';
import { MainLogger } from './Logger.js';

let store;
let defaults;

// Schema for electron-store validation
const schema = {
	characterSavePath: {
		type: 'string',
	},
	dataSourceType: {
		type: ['string', 'null'],
		enum: ['url', 'local', null],
	},
	dataSourceValue: {
		type: ['string', 'null'],
	},
	dataSourceCachePath: {
		type: ['string', 'null'],
	},
	lastOpenedCharacter: {
		type: ['string', 'null'],
	},
	windowBounds: {
		type: 'object',
		properties: {
			width: { type: 'number', minimum: 400 },
			height: { type: 'number', minimum: 300 },
			x: { type: ['number', 'null'] },
			y: { type: ['number', 'null'] },
		},
		default: { width: 1200, height: 800, x: null, y: null },
	},
	theme: {
		type: 'string',
		enum: ['auto', 'light', 'dark'],
		default: 'auto',
	},
	logLevel: {
		type: 'string',
		enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
		default: 'INFO',
	},
	autoSave: {
		type: 'boolean',
		default: true,
	},
	autoSaveInterval: {
		type: 'number',
		minimum: 1,
		maximum: 3600,
		default: 60,
	},
};

/** Initialize preferences module with Electron app instance. */
export function initPreferences(app) {
	defaults = {
		characterSavePath: path.join(
			app.getPath('documents'),
			'Fizbanes Forge',
			'characters',
		),
		dataSourceType: null,
		dataSourceValue: null,
		dataSourceCachePath: null,
		lastOpenedCharacter: null,
		windowBounds: { width: 1200, height: 800, x: null, y: null },
		theme: 'auto',
		logLevel: 'INFO',
		autoSave: true,
		autoSaveInterval: 60,
	};

	try {
		store = new Store({
			name: 'preferences',
			defaults,
			schema,
			clearInvalidConfig: true, // Reset invalid values to defaults
		});

		MainLogger.info('PreferencesManager', 'electron-store initialized', {
			path: store.path,
		});
	} catch (error) {
		MainLogger.error(
			'PreferencesManager',
			'Failed to initialize electron-store, using defaults',
			error,
		);
		// Fallback: create store without schema validation if it fails
		store = new Store({
			name: 'preferences',
			defaults,
		});
	}
}

export function setPreference(key, value) {
	try {
		store.set(key, value);
	} catch (error) {
		MainLogger.error(
			'PreferencesManager',
			`Error setting preference: ${key}`,
			error,
		);
	}
}

export function getPreference(key, defaultValue = undefined) {
	try {
		const value = store.get(key);
		return value !== undefined ? value : defaultValue;
	} catch (error) {
		MainLogger.error(
			'PreferencesManager',
			`Error getting preference: ${key}`,
			error,
		);
		return defaultValue ?? defaults?.[key];
	}
}

export function deletePreference(key) {
	try {
		store.delete(key);
	} catch (error) {
		MainLogger.error(
			'PreferencesManager',
			`Error deleting preference: ${key}`,
			error,
		);
	}
}

export function hasPreference(key) {
	return store.has(key);
}

export function getAllPreferences() {
	return store.store;
}

export function clearPreferences() {
	store.clear();
}

export function getCharacterSavePath() {
	const savePath = getPreference('characterSavePath');
	// Ensure directory exists
	if (!fs.existsSync(savePath)) {
		fs.mkdirSync(savePath, { recursive: true });
	}
	return savePath;
}

export function getWindowBounds() {
	return getPreference('windowBounds', {
		width: 1200,
		height: 800,
		x: null,
		y: null,
	});
}

export function setWindowBounds(bounds) {
	setPreference('windowBounds', bounds);
}

export function getLastOpenedCharacter() {
	return getPreference('lastOpenedCharacter');
}

export function setLastOpenedCharacter(characterPath) {
	setPreference('lastOpenedCharacter', characterPath);
}
