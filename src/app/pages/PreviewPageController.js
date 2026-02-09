import { showNotification } from '../../lib/Notifications.js';
import { AppState } from '../AppState.js';
import { BasePageController } from './BasePageController.js';

export class PreviewPageController extends BasePageController {
    constructor() {
        super('PreviewPageController');
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[PreviewPageController]', 'No character loaded for preview page');
                return;
            }
        } catch (error) {
            console.error('[PreviewPageController]', 'Error initializing preview page', error);
            showNotification('Error loading preview page', 'error');
        }
    }
}
