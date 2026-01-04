/** Renders the list of selected feats on the build page. */

import { featService } from '../../services/FeatService.js';
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
