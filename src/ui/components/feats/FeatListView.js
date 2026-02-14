// FeatListView.js
// Main feat display list with remove functionality

import { AppState } from '../../../app/AppState.js';
import { Character } from '../../../app/Character.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { featService } from '../../../services/FeatService.js';

export class FeatListView {
    constructor() {
        this._onRemoveFeatClick = this._onRemoveFeatClick.bind(this);
    }

    async update(container, character) {
        if (!container) return;

        if (
            !character ||
            !Array.isArray(character.feats) ||
            character.feats.length === 0
        ) {
            container.innerHTML =
                '<div class="text-light text-center small py-3">No feats selected.</div>';
            return;
        }

        const renderedItems = await Promise.all(
            character.feats.map(async (feat) => {
                const name = feat?.name || 'Unknown Feat';
                const desc = await this._buildFeatDescription(feat);

                return `
					<div class="feat-list-item" data-feat-name="${name}">
						<div class="feat-list-item-info">
							<div class="feat-list-item-header">
								<strong class="feat-list-item-name">${name}</strong>
							</div>
							<div class="feat-list-item-desc">${desc}</div>
						</div>
						<button class="btn btn-sm btn-outline-danger remove-feat-btn remove-feat" type="button" aria-label="Remove feat">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				`;
            }),
        );

        container.innerHTML = renderedItems.join('');
        await textProcessor.processElement(container);

        // Attach event listeners to remove buttons
        this._attachRemoveListeners(container, character);
    }

    async _buildFeatDescription(feat) {
        const descParts = [];
        const resolveFeat = () => {
            if (feat?.entries) return feat;
            const fallback = featService.getFeat(feat?.name || '');
            return fallback || feat;
        };

        const resolved = resolveFeat();

        const pushString = async (text) => {
            if (!text) return;
            descParts.push(await textProcessor.processString(text));
        };

        if (Array.isArray(resolved?.entries)) {
            for (const entry of resolved.entries) {
                if (typeof entry === 'string') {
                    await pushString(entry);
                    if (descParts.length >= 2) break;
                } else if (Array.isArray(entry?.entries)) {
                    for (const nested of entry.entries) {
                        if (typeof nested === 'string') {
                            await pushString(nested);
                            if (descParts.length >= 2) break;
                        }
                    }
                    if (descParts.length >= 2) break;
                }
            }
        } else if (typeof resolved?.entries === 'string') {
            await pushString(resolved.entries);
        }

        if (descParts.length === 0) {
            return '<span class="text-muted">No description available.</span>';
        }

        return descParts.join(' ');
    }

    _attachRemoveListeners(container, character) {
        const removeButtons = container.querySelectorAll('.remove-feat-btn');
        removeButtons.forEach((button) => {
            button.addEventListener('click', (e) => {
                this._onRemoveFeatClick(e, character);
            });
        });
    }

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

        // Build updated data and clean progression level-ups that recorded this feat
        const updatedData = {
            ...character,
            feats: character.feats.filter((f) => f.name !== featName),
        };

        const levelUps = Array.isArray(character.progression?.levelUps)
            ? character.progression.levelUps.map((lu) => ({ ...lu }))
            : [];

        const cleanedLevelUps = levelUps
            .map((lu) => {
                if (
                    Array.isArray(lu.appliedFeats) &&
                    lu.appliedFeats.includes(featName)
                ) {
                    return {
                        ...lu,
                        appliedFeats: lu.appliedFeats.filter((n) => n !== featName),
                    };
                }
                return lu;
            })
            .filter((lu) => {
                const noFeat = !lu.appliedFeats || lu.appliedFeats.length === 0;
                const noASI =
                    !lu.changedAbilities || Object.keys(lu.changedAbilities).length === 0;
                const noFeatures =
                    !lu.appliedFeatures || lu.appliedFeatures.length === 0;
                return !(noFeat && noASI && noFeatures);
            });

        updatedData.progression = {
            ...character.progression,
            levelUps: cleanedLevelUps,
        };

        // Create new Character instance with updated data
        const updatedCharacter = new Character(updatedData);

        // Update AppState with new character instance
        AppState.setCurrentCharacter(updatedCharacter);
        AppState.setHasUnsavedChanges(true);

        // Emit character updated event
        eventBus.emit(EVENTS.CHARACTER_UPDATED, updatedCharacter);

        console.debug('FeatListView', 'Feat removed', { featName });
    }
}
