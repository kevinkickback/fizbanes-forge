import { eventBus, EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import {
    FeatListView,
    FeatSelectorModal,
    FeatSourcesView,
} from '../../ui/components/feats/FeatSelectorModal.js';
import { AppState } from '../AppState.js';
import { BasePageController } from './BasePageController.js';

export class FeatsPageController extends BasePageController {
    constructor() {
        super('FeatsPageController');
        this._featListView = new FeatListView();
        this._featListContainer = null;
        this._featSourcesView = new FeatSourcesView();
        this._featSourcesContainer = null;
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[FeatsPageController]', 'No character loaded for feats page');
                return;
            }

            this._initializeFeatSources();

            const addFeatBtn = document.getElementById('addFeatBtn');
            if (addFeatBtn) {
                const newAddFeatBtn = addFeatBtn.cloneNode(true);
                addFeatBtn.parentNode.replaceChild(newAddFeatBtn, addFeatBtn);
                newAddFeatBtn.addEventListener('click', async () => {
                    console.debug('[FeatsPageController]', 'Add Feat button clicked');
                    const selector = new FeatSelectorModal();
                    await selector.show();
                });

                this._updateFeatUIState(character);
            }

            this._updateFeatAvailabilitySection(character);
        } catch (error) {
            console.error('[FeatsPageController]', 'Error initializing feats page', error);
            showNotification('Error loading feats page', 'error');
        }
    }

    _initializeFeatSources() {
        this._featListContainer = document.getElementById('featList');
        this._featSourcesContainer = document.getElementById('featSources');
        if (!this._featSourcesContainer) {
            console.debug('[FeatsPageController]', 'Feat sources container not found');
            return;
        }

        const character = AppState.getCurrentCharacter();
        this._featListView.update(this._featListContainer, character);
        this._featSourcesView.update(this._featSourcesContainer, character);
        this._updateFeatUIState(character);

        const onFeatsSelected = (selectedFeats) => {
            console.debug('[FeatsPageController]', 'FEATS_SELECTED event received', {
                selectedFeatsCount: selectedFeats?.length || 0,
                selectedFeatNames: selectedFeats?.map(f => f.name) || [],
            });

            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[FeatsPageController]', 'No character loaded');
                return;
            }

            const availability = character.getFeatAvailability?.();
            const allowedCount = Math.max(0, availability?.max || 0);
            const featsToStore = allowedCount
                ? selectedFeats.slice(0, allowedCount)
                : [];

            console.debug('[FeatsPageController]', 'Setting feats on character', {
                allowedCount,
                receivedCount: selectedFeats.length,
                storingCount: featsToStore.length,
                storingFeats: featsToStore.map(f => f.name),
            });
            character.setFeats(featsToStore, 'Manual selection');
            this._featListView.update(this._featListContainer, character);
            this._featSourcesView.update(this._featSourcesContainer, character);
            this._updateFeatUIState(character);
            this._updateFeatAvailabilitySection(character);
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
        };

        const onCharacterUpdatedForFeats = ({ character }) => {
            const c = character || AppState.getCurrentCharacter();
            this._featListView.update(this._featListContainer, c);
            this._featSourcesView.update(this._featSourcesContainer, c);
            this._updateFeatUIState(c);
            this._updateFeatAvailabilitySection(c);
        };

        const onCharacterSelectedForFeats = (character) => {
            const c = character || AppState.getCurrentCharacter();
            this._featListView.update(this._featListContainer, c);
            this._featSourcesView.update(this._featSourcesContainer, c);
            this._updateFeatUIState(c);
            this._updateFeatAvailabilitySection(c);
        };

        this._trackListener(EVENTS.FEATS_SELECTED, onFeatsSelected);
        this._trackListener(EVENTS.CHARACTER_UPDATED, onCharacterUpdatedForFeats);
        this._trackListener(EVENTS.CHARACTER_SELECTED, onCharacterSelectedForFeats);
    }

    _updateFeatUIState(character) {
        const featCountEl = document.getElementById('featCount');
        const maxFeatsEl = document.getElementById('maxFeats');
        const selectionCounter = document.querySelector('.selection-counter');
        const addFeatBtn = document.getElementById('addFeatBtn');

        const availability = character?.getFeatAvailability?.() || {
            used: character?.feats?.length || 0,
            max: 0,
            remaining: 0,
            reasons: [],
            blockedReason: 'No feat selections available.',
        };

        if (featCountEl) featCountEl.textContent = availability.used ?? 0;
        if (maxFeatsEl) maxFeatsEl.textContent = availability.max ?? 0;

        if (selectionCounter) {
            selectionCounter.style.display = availability.max > 0 ? '' : 'none';
        }

        if (addFeatBtn) {
            addFeatBtn.disabled = false;
            addFeatBtn.title =
                availability.max > 0
                    ? `${availability.remaining} feat choice(s) remaining`
                    : 'Add feats from any source (racial features, magic items, etc.)';
        }
    }

    _updateFeatAvailabilitySection(character) {
        const featSourcesContainer = document.getElementById('featSources');
        if (!character) return;

        if (featSourcesContainer) {
            featSourcesContainer.classList.toggle('u-hidden', !(character.feats?.length > 0));
        }
    }
}
