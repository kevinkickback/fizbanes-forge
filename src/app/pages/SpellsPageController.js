import { EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { AppState } from '../AppState.js';
import { BasePageController } from './BasePageController.js';

export class SpellsPageController extends BasePageController {
    constructor() {
        super('SpellsPageController');
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[SpellsPageController]', 'No character loaded for spells page');
                return;
            }

            const { SpellsManager } = await import(
                '../../ui/components/spells/SpellManager.js'
            );
            const spellsManager = new SpellsManager();
            spellsManager.render();

            const updateHandler = () => spellsManager.render();
            this._trackListener(EVENTS.CHARACTER_UPDATED, updateHandler);
            this._trackListener(EVENTS.SPELL_ADDED, updateHandler);
            this._trackListener(EVENTS.SPELL_REMOVED, updateHandler);
            this._trackListener(EVENTS.SPELL_PREPARED, updateHandler);
            this._trackListener(EVENTS.SPELL_UNPREPARED, updateHandler);
            this._trackListener(EVENTS.SPELL_SLOTS_USED, updateHandler);
            this._trackListener(EVENTS.SPELL_SLOTS_RESTORED, updateHandler);
        } catch (error) {
            console.error('[SpellsPageController]', 'Error initializing spells page', error);
            showNotification('Error loading spells page', 'error');
        }
    }
}
