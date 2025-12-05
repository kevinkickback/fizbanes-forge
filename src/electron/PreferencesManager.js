/**
 * Manages application preferences using electron-store.
 *
 * ARCHITECTURE: Main Process - User Preferences
 *
 * PURPOSE:
 * - Centralized preferences storage and retrieval
 * - Default values for all preferences
 * - Type-safe preference access
 * - Preference validation
 *
 * USAGE:
 *   const prefs = new PreferencesManager(app);
 *   const savePath = prefs.get('characterSavePath');
 *   prefs.set('characterSavePath', '/new/path');
 *
 * @module src/electron/PreferencesManager
 */

import fs from 'node:fs';
import path from 'node:path';
import { MainLogger } from './MainLogger.js';

export class PreferencesManager {
	constructor(app) {
		this.app = app;
		this.preferencesPath = path.join(
			app.getPath('userData'),
			'preferences.json',
		);

		// Default preferences
		this.defaults = {
			characterSavePath: path.join(
				app.getPath('documents'),
				'Fizbanes Forge',
				'characters',
			),
			lastOpenedCharacter: null,
			windowBounds: { width: 1200, height: 800, x: null, y: null },
			theme: 'auto',
			logLevel: 'INFO',
			autoSave: true,
			autoSaveInterval: 60,
		};

		// Load preferences from file
		this.store = this.loadPreferences();

		MainLogger.info(
			'PreferencesManager',
			'Initialized with store:',
			this.preferencesPath,
		);
	}

	loadPreferences() {
		try {
			if (fs.existsSync(this.preferencesPath)) {
				const data = fs.readFileSync(this.preferencesPath, 'utf8');
				const parsed = JSON.parse(data);
				const merged = { ...this.defaults, ...parsed };
				return this.validateStore(merged);
			}
		} catch (error) {
			MainLogger.error(
				'PreferencesManager',
				'Error loading preferences:',
				error,
			);
		}
		return { ...this.defaults };
	}

	savePreferences() {
		try {
			// Atomic write: write to temp file then rename
			const tmpPath = `${this.preferencesPath}.tmp`;
			fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2));
			fs.renameSync(tmpPath, this.preferencesPath);
		} catch (error) {
			MainLogger.error(
				'PreferencesManager',
				'Error saving preferences:',
				error,
			);
		}
	}

	/**
	 * Validate entire preferences store and coerce invalid values to defaults.
	 * @param {object} store
	 * @returns {object} validated store
	 */
	validateStore(store) {
		const out = { ...this.defaults };
		// characterSavePath: string
		if (typeof store.characterSavePath === 'string' && store.characterSavePath) {
			out.characterSavePath = store.characterSavePath;
		}
		// lastOpenedCharacter: string|null
		if (
			store.lastOpenedCharacter === null ||
			(typeof store.lastOpenedCharacter === 'string' && store.lastOpenedCharacter)
		) {
			out.lastOpenedCharacter = store.lastOpenedCharacter;
		}
		// windowBounds: object with numbers or null
		const wb = store.windowBounds;
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
		if (['auto', 'light', 'dark'].includes(store.theme)) {
			out.theme = store.theme;
		}
		// logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
		if (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(store.logLevel)) {
			out.logLevel = store.logLevel;
		}
		// autoSave: boolean
		if (typeof store.autoSave === 'boolean') {
			out.autoSave = store.autoSave;
		}
		// autoSaveInterval: positive integer seconds
		const asi = Number.parseInt(store.autoSaveInterval, 10);
		if (Number.isFinite(asi) && asi > 0 && asi <= 3600) {
			out.autoSaveInterval = asi;
		}
		return out;
	}

	/**
	 * Validate and set a preference value according to schema.
	 * @param {string} key
	 * @param {*} value
	 */
	set(key, value) {
		MainLogger.info('PreferencesManager', `Set: ${key} =`, value);
		const validated = this._validateKeyValue(key, value);
		this.store[key] = validated;
		this.savePreferences();
	}

	_validateKeyValue(key, value) {
		switch (key) {
			case 'characterSavePath':
				return typeof value === 'string' && value ? value : this.defaults.characterSavePath;
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
				return this.defaults.windowBounds;
			}
			case 'theme':
				return ['auto', 'light', 'dark'].includes(value) ? value : this.defaults.theme;
			case 'logLevel':
				return ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(value)
					? value
					: this.defaults.logLevel;
			case 'autoSave':
				return typeof value === 'boolean' ? value : this.defaults.autoSave;
			case 'autoSaveInterval': {
				const asi = Number.parseInt(value, 10);
				return Number.isFinite(asi) && asi > 0 && asi <= 3600
					? asi
					: this.defaults.autoSaveInterval;
			}
			default:
				return value;
		}
	}

	/**
	 * Get a preference value.
	 * @param {string} key - Preference key
	 * @param {*} defaultValue - Optional default if key not found
	 * @returns {*} Preference value
	 */
	get(key, defaultValue = undefined) {
		const value =
			this.store[key] !== undefined ? this.store[key] : defaultValue;
		MainLogger.info('PreferencesManager', `Get: ${key} =`, value);
		return value;
	}



	/**
	 * Delete a preference.
	 * @param {string} key - Preference key
	 */
	delete(key) {
		MainLogger.info('PreferencesManager', `Delete: ${key}`);
		delete this.store[key];
		this.savePreferences();
	}

	/**
	 * Check if a preference exists.
	 * @param {string} key - Preference key
	 * @returns {boolean} True if preference exists
	 */
	has(key) {
		return Object.hasOwn(this.store, key);
	}

	/**
	 * Get all preferences.
	 * @returns {object} All preferences
	 */
	getAll() {
		return { ...this.store };
	}

	/**
	 * Clear all preferences (reset to defaults).
	 */
	clear() {
		MainLogger.info('PreferencesManager', 'Clearing all preferences');
		this.store = { ...this.defaults };
		this.savePreferences();
	}

	/**
	 * Get the character save path, ensuring it exists.
	 * @returns {string} Character save path
	 */
	getCharacterSavePath() {
		const savePath = this.get('characterSavePath');

		// Ensure directory exists
		if (!fs.existsSync(savePath)) {
			fs.mkdirSync(savePath, { recursive: true });
			MainLogger.info(
				'PreferencesManager',
				'Created character save directory:',
				savePath,
			);
		}

		return savePath;
	}

	/**
	 * Get window bounds with fallback to defaults.
	 * @returns {object} Window bounds {width, height, x, y}
	 */
	getWindowBounds() {
		return this.get('windowBounds', {
			width: 1200,
			height: 800,
			x: null,
			y: null,
		});
	}

	/**
	 * Save window bounds.
	 * @param {object} bounds - Window bounds {width, height, x, y}
	 */
	setWindowBounds(bounds) {
		this.set('windowBounds', bounds);
	}

	/**
	 * Get the last opened character path.
	 * @returns {string|null} Last character path or null
	 */
	getLastOpenedCharacter() {
		return this.get('lastOpenedCharacter');
	}

	/**
	 * Set the last opened character path.
	 * @param {string|null} characterPath - Character file path
	 */
	setLastOpenedCharacter(characterPath) {
		this.set('lastOpenedCharacter', characterPath);
	}
}
