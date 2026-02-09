import { showNotification } from '../../lib/Notifications.js';
import { SettingsCard } from '../../ui/components/settings/SettingsCard.js';
import { BasePageController } from './BasePageController.js';

export class SettingsPageController extends BasePageController {
    constructor() {
        super('SettingsPageController');
    }

    async initialize() {
        try {
            const settingsCard = new SettingsCard();
            await settingsCard.initialize();
        } catch (error) {
            console.error('[SettingsPageController]', 'Error initializing settings page', error);
            showNotification('Error loading settings page', 'error');
        }
    }
}
