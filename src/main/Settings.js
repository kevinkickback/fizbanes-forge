/** Preference storage/validation for the main process. */

import fs from 'node:fs';
import path from 'node:path';
import { MainLogger } from './Logger.js';

let preferencesPath;
let defaults;
let store;

/** Initialize preferences module with Electron app instance. */
export function initPreferences(app) {
	preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
	defaults = {
		characterSavePath: path.join(
			app.getPath('documents'),
			'Fizbanes Forge',
			'characters',
		),
		dataSourceType: null, // 'url' or 'local'
		dataSourceValue: null, // URL or file path
		dataSourceCachePath: null, // Local cache path for downloaded URL sources
		lastOpenedCharacter: null,
		windowBounds: { width: 1200, height: 800, x: null, y: null },
		theme: 'auto',
		logLevel: 'INFO',
		autoSave: true,
		autoSaveInterval: 60,
	};
	store = loadPreferences();
}

function loadPreferences() {
	try {
		if (fs.existsSync(preferencesPath)) {
			const data = fs.readFileSync(preferencesPath, 'utf8');
			const parsed = JSON.parse(data);
			const merged = { ...defaults, ...parsed };
			return validateStore(merged);
		}
	} catch (error) {
		MainLogger.error('PreferencesManager', 'Error loading preferences:', error);
	}
	return { ...defaults };
}

function savePreferences() {
	try {
		// Atomic write: write to temp file then rename
		const tmpPath = `${preferencesPath}.tmp`;
		fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2));
		fs.renameSync(tmpPath, preferencesPath);
	} catch (error) {
		MainLogger.error('PreferencesManager', 'Error saving preferences:', error);
	}
}

function validateStore(s) {
	const out = { ...defaults };
	// characterSavePath: string
	if (typeof s.characterSavePath === 'string' && s.characterSavePath) {
		out.characterSavePath = s.characterSavePath;
	}
	// lastOpenedCharacter: string|null
	if (
		s.lastOpenedCharacter === null ||
		(typeof s.lastOpenedCharacter === 'string' && s.lastOpenedCharacter)
	) {
		out.lastOpenedCharacter = s.lastOpenedCharacter;
	}
	// windowBounds: object with numbers or null
	const wb = s.windowBounds;
	if (wb && typeof wb === 'object') {
		const width = Number.parseInt(wb.width, 10);
		const height = Number.parseInt(wb.height, 10);
		const x = wb.x == null ? null : Number.parseInt(wb.x, 10);
		const y = wb.y == null ? null : Number.parseInt(wb.y, 10);
		if (Number.isFinite(width) && Number.isFinite(height)) {
			out.windowBounds = {
				width,
				height,
				x: Number.isFinite(x) ? x : null,
				y: Number.isFinite(y) ? y : null,
			};
		}
	}
	// theme: 'auto' | 'light' | 'dark'
	if (['auto', 'light', 'dark'].includes(s.theme)) {
		out.theme = s.theme;
	}
	// logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
	if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(s.logLevel)) {
		out.logLevel = s.logLevel;
	}
	// autoSave: boolean
	if (typeof s.autoSave === 'boolean') {
		out.autoSave = s.autoSave;
	}
	// autoSaveInterval: positive integer seconds
	const asi = Number.parseInt(s.autoSaveInterval, 10);
	if (Number.isFinite(asi) && asi > 0 && asi <= 3600) {
		out.autoSaveInterval = asi;
	}
	// dataSourceType: 'url' | 'local' | null
	if (
		s.dataSourceType === null ||
		s.dataSourceType === 'url' ||
		s.dataSourceType === 'local'
	) {
		out.dataSourceType = s.dataSourceType;
	}
	// dataSourceValue: string | null
	if (
		s.dataSourceValue === null ||
		(typeof s.dataSourceValue === 'string' && s.dataSourceValue)
	) {
		out.dataSourceValue = s.dataSourceValue;
	}
	// dataSourceCachePath: string | null
	if (
		s.dataSourceCachePath === null ||
		(typeof s.dataSourceCachePath === 'string' && s.dataSourceCachePath)
	) {
		out.dataSourceCachePath = s.dataSourceCachePath;
	}
	return out;
}

function validateKeyValue(key, value) {
	switch (key) {
		case 'characterSavePath':
			return typeof value === 'string' && value
				? value
				: defaults.characterSavePath;
		case 'lastOpenedCharacter':
			return value === null || (typeof value === 'string' && value)
				? value
				: null;
		case 'windowBounds': {
			if (value && typeof value === 'object') {
				const width = Number.parseInt(value.width, 10);
				const height = Number.parseInt(value.height, 10);
				const x = value.x == null ? null : Number.parseInt(value.x, 10);
				const y = value.y == null ? null : Number.parseInt(value.y, 10);
				if (Number.isFinite(width) && Number.isFinite(height)) {
					return {
						width,
						height,
						x: Number.isFinite(x) ? x : null,
						y: Number.isFinite(y) ? y : null,
					};
				}
			}
			return defaults.windowBounds;
		}
		case 'theme':
			return ['auto', 'light', 'dark'].includes(value) ? value : defaults.theme;
		case 'logLevel':
			return ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(value)
				? value
				: defaults.logLevel;
		case 'autoSave':
			return typeof value === 'boolean' ? value : defaults.autoSave;
		case 'autoSaveInterval': {
			const asi = Number.parseInt(value, 10);
			return Number.isFinite(asi) && asi > 0 && asi <= 3600
				? asi
				: defaults.autoSaveInterval;
		}
		case 'dataSourceType':
			return value === null || value === 'url' || value === 'local'
				? value
				: defaults.dataSourceType;
		case 'dataSourceValue':
			return value === null || (typeof value === 'string' && value)
				? value
				: defaults.dataSourceValue;
		case 'dataSourceCachePath':
			return value === null || (typeof value === 'string' && value)
				? value
				: defaults.dataSourceCachePath;
		default:
			return value;
	}
}

export function setPreference(key, value) {
	const validated = validateKeyValue(key, value);
	store[key] = validated;
	savePreferences();
}

export function getPreference(key, defaultValue = undefined) {
	return store[key] !== undefined ? store[key] : defaultValue;
}

export function deletePreference(key) {
	delete store[key];
	savePreferences();
}

export function hasPreference(key) {
	return Object.hasOwn(store, key);
}

export function getAllPreferences() {
	return { ...store };
}

export function clearPreferences() {
	store = { ...defaults };
	savePreferences();
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
