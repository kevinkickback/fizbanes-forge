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

	getAutoUpdateData() {
		return this.autoUpdateData;
	}

	async setAutoUpdateData(enabled) {
		this.autoUpdateData = !!enabled;
		await window.app.settings.set('autoUpdateData', this.autoUpdateData);
		return this.autoUpdateData;
	}

	async getAllSettings() {
		return await window.app.settings.getAll();
	}

	async getSetting(key) {
		return await window.app.settings.get(key);
	}

	async setSetting(key, value) {
		return await window.app.settings.set(key, value);
	}
}

export const settingsService = new SettingsService();
