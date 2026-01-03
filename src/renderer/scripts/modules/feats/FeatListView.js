/** Renders the list of selected feats on the build page. */

import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { textProcessor } from '../../utils/TextProcessor.js';

export class FeatListView {
    constructor() {
        this._onRemoveFeatClick = this._onRemoveFeatClick.bind(this);
    }

    /**
     * Render the list of selected feats into the provided container.
     * @param {HTMLElement|null} container - Target container element (#featList)
     * @param {import('../../core/Character.js').Character|null} character - Current character
     */
    async update(container, character) {
        if (!container) return;

        if (!character || !Array.isArray(character.feats) || character.feats.length === 0) {
            container.innerHTML =
                '<div class="text-muted small py-3">No feats selected.</div>';
            return;
        }

        // Render each feat as a card-like item
        let html = '';
        for (const feat of character.feats) {
            const name = feat?.name || 'Unknown Feat';
            const source = feat?.source || 'Unknown Source';

            html += `
				<div class="feat-list-item" data-feat-name="${name}">
					<div class="feat-list-item-info">
						<strong>${name}</strong>
						<span class="badge feat-list-item-badge">${source}</span>
					</div>
					<button class="btn btn-sm btn-outline-danger remove-feat-btn remove-feat" type="button" aria-label="Remove feat">
						<i class="fas fa-trash"></i>
					</button>
				</div>
			`;
        }

        container.innerHTML = html;
        await textProcessor.processElement(container);

        // Attach event listeners to remove buttons
        this._attachRemoveListeners(container, character);
    }

    /**
     * Attach click listeners to remove feat buttons
     * @param {HTMLElement} container - Container with feat items
     * @param {import('../../core/Character.js').Character} character - Current character
     * @private
     */
    _attachRemoveListeners(container, character) {
        const removeButtons = container.querySelectorAll('.remove-feat-btn');
        removeButtons.forEach((button) => {
            button.addEventListener('click', (e) => {
                this._onRemoveFeatClick(e, character);
            });
        });
    }

    /**
     * Handle removal of a feat
     * @param {Event} event - Click event
     * @param {import('../../core/Character.js').Character} character - Current character
     * @private
     */
    _onRemoveFeatClick(event, character) {
        event.preventDefault();
        event.stopPropagation();

        if (!character) return;

        const featItem = event.currentTarget.closest('.feat-list-item');
        const featName = featItem?.getAttribute('data-feat-name');

        if (!featName) {
            console.warn('FeatListView', 'Could not determine feat name to remove');
            return;
        }

        // Remove the feat from character's feats array
        character.feats = character.feats.filter((f) => f.name !== featName);

        // Emit character updated event
        eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

        console.info('FeatListView', 'Feat removed', { featName });
    }
}
