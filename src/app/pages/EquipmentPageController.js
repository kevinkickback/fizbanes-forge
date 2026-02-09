import { EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { AppState } from '../AppState.js';
import { BasePageController } from './BasePageController.js';

export class EquipmentPageController extends BasePageController {
    constructor() {
        super('EquipmentPageController');
        this._equipmentManager = null;
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[EquipmentPageController]', 'No character loaded for equipment page');
                return;
            }

            const { EquipmentManager } = await import(
                '../../ui/components/equipment/EquipmentManager.js'
            );
            this._equipmentManager = new EquipmentManager();
            this._equipmentManager.render();

            const updateHandler = () => this._equipmentManager.render();
            this._trackListener(EVENTS.CHARACTER_UPDATED, updateHandler);
            this._trackListener(EVENTS.ITEM_ADDED, updateHandler);
            this._trackListener(EVENTS.ITEM_REMOVED, updateHandler);
            this._trackListener(EVENTS.ITEM_EQUIPPED, updateHandler);
            this._trackListener(EVENTS.ITEM_UNEQUIPPED, updateHandler);
        } catch (error) {
            console.error('[EquipmentPageController]', 'Error initializing equipment page', error);
            showNotification('Error loading equipment page', 'error');
        }
    }

    cleanup() {
        this._equipmentManager = null;
        super.cleanup();
    }
}
