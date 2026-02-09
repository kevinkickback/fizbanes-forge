/**
 * SettingsService - Service layer for application settings
 * Handles settings data operations only (no DOM manipulation)
 * 
 * Note: UI interactions for the settings page are handled by SettingsCard
 * in src/ui/components/settings/SettingsCard.js
 */

import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';

export class SettingsService {
	constructor() {
		this._initialized = false;
		this.autoUpdateData = false;
	}

	async initialize() {
		if (this._initialized) return;

		try {
			// Load auto update setting from preferences
			const config = await window.app.settings.getAll();
			this.autoUpdateData = !!config.autoUpdateData;

			this._initialized = true;
			eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'settings', this);
		} catch (error) {
			console.error('[SettingsService]', 'Error initializing', error);
			showNotification('Failed to initialize settings', 'danger');
			throw error;
		}
	}

	/**
	 * Get the auto-update data setting
	 * @returns {boolean}
	 */
	getAutoUpdateData() {
		return this.autoUpdateData;
	}

	/**
	 * Set the auto-update data setting
	 * @param {boolean} enabled
	 */
	async setAutoUpdateData(enabled) {
		this.autoUpdateData = !!enabled;
		await window.app.settings.set('autoUpdateData', this.autoUpdateData);
		return this.autoUpdateData;
	}

	/**
	 * Get all settings from the main process
	 * @returns {Promise<Object>}
	 */
	async getAllSettings() {
		return await window.app.settings.getAll();
	}

	/**
	 * Get a specific setting value
	 * @param {string} key
	 * @returns {Promise<any>}
	 */
	async getSetting(key) {
		return await window.app.settings.get(key);
	}

	/**
	 * Set a specific setting value
	 * @param {string} key
	 * @param {any} value
	 * @returns {Promise<void>}
	 */
	async setSetting(key, value) {
		return await window.app.settings.set(key, value);
	}
}

export const settingsService = new SettingsService();
