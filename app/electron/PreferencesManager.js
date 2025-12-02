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
 * @module electron/PreferencesManager
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
				return { ...this.defaults, ...JSON.parse(data) };
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
			fs.writeFileSync(
				this.preferencesPath,
				JSON.stringify(this.store, null, 2),
			);
		} catch (error) {
			MainLogger.error(
				'PreferencesManager',
				'Error saving preferences:',
				error,
			);
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
	 * Set a preference value.
	 * @param {string} key - Preference key
	 * @param {*} value - Value to set
	 */
	set(key, value) {
		MainLogger.info('PreferencesManager', `Set: ${key} =`, value);
		this.store[key] = value;
		this.savePreferences();
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
