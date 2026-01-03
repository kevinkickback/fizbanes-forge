// FeatSelectionModal.js
// Modal for selecting feats valid for the current character

import { AppState } from '../../core/AppState.js';
import { featService } from '../../services/FeatService.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { showNotification } from '../../utils/Notifications.js';
import { textProcessor } from '../../utils/TextProcessor.js';

export class FeatSelectionModal {
	constructor({ allowClose = true } = {}) {
		this.allowClose = allowClose;
		this.modal = null;
		this.bootstrapModal = null;
		this.validFeats = [];
		this.filteredFeats = [];
		this.searchTerm = '';
		this.selectedSources = new Set();
		this.selectedFeatIds = new Set();
		this.featSlotLimit = 0;
		this._availability = null;
		this._featOrigins = new Map(); // Map of feat ID to origin reason (e.g., "Variant Human", "Class ASI at level 4")
	}

	async show() {
		const character = AppState.getCurrentCharacter();
		this._availability =
			character?.getFeatAvailability?.() || {
				max: 0,
				remaining: 0,
				reasons: [],
				blockedReason:
					'No feat selections available. Choose Variant Human or reach level 4.',
			};

		this.featSlotLimit = this._availability.max;

		if (!this.featSlotLimit) {
			showNotification(
				this._availability.blockedReason ||
				'No feat selections available for this character.',
				'warning',
			);
			return;
		}

		await this._loadValidFeats();
		this._populateFeatOrigins(); // Build the origin map
		this.filteredFeats = this.validFeats;
		this.selectedFeatIds.clear();

		// Pre-select any already-selected feats
		this._preselectSavedFeats(character);

		// Get the modal element from DOM
		this.modal = document.getElementById('featSelectionModal');
		if (!this.modal) {
			console.error('FeatSelectionModal', 'Modal element not found in DOM');
			showNotification('Could not open feat selection modal', 'error');
			return;
		}

		const slotNote = this.modal.querySelector('.feat-slot-note');
		if (slotNote) {
			const reasonsText =
				Array.isArray(this._availability?.reasons) &&
					this._availability.reasons.length > 0
					? ` Available via ${this._availability.reasons.join(', ')}.`
					: '';
			slotNote.textContent = `You may select up to ${this.featSlotLimit} feat${this.featSlotLimit === 1 ? '' : 's'
				} (currently ${this._availability.remaining} remaining).${reasonsText}`;
		}

		await this._renderFeatList();
		this._attachEventListeners();

		// Create or reuse Bootstrap modal instance
		if (!this.bootstrapModal) {
			this.bootstrapModal = new bootstrap.Modal(this.modal, {
				backdrop: true,
				keyboard: true,
			});
		}
		this.bootstrapModal.show();
	}

	async _loadValidFeats() {
		const allFeats = await featService.getAllFeats();
		const character = AppState.getCurrentCharacter();
		// Filter feats based on character prerequisites
		this.validFeats = allFeats
			.filter((f) => this._isFeatValidForCharacter(f, character))
			.map((f, index) => ({
				...f,
				id: f.id || `feat-${index}`, // Generate ID if not present
			}));
	}

	_isFeatValidForCharacter(feat, _character) {
		// TODO: Implement full prerequisite logic
		if (!feat.prerequisite) return true;
		// Example: check for minimum level, race, class, etc.
		// Return false if requirements not met
		return true;
	}

	_populateFeatOrigins() {
		this._featOrigins.clear();

		if (!this._availability?.reasons || this._availability.reasons.length === 0) {
			return;
		}

		// For now, assign each reason sequentially to feat selections
		// A more sophisticated approach could let users choose which feat goes with which origin
		let reasonIndex = 0;
		for (const feat of this.validFeats) {
			const reason = this._availability.reasons[reasonIndex % this._availability.reasons.length];
			// Format the reason: "Race: Variant Human" -> "Variant Human"
			const origin = reason.replace(/^[^:]+:\s*/, '').trim();
			this._featOrigins.set(feat.id, origin);
			reasonIndex++;
		}
	}

	_preselectSavedFeats(character) {
		if (!character || !Array.isArray(character.feats)) return;

		// Find matching feat objects by name and pre-select them
		for (const savedFeat of character.feats) {
			const matchingFeat = this.validFeats.find(
				(f) => f.name && f.name.toLowerCase() === (savedFeat.name || '').toLowerCase()
			);
			if (matchingFeat) {
				this.selectedFeatIds.add(matchingFeat.id);
				console.debug('FeatSelectionModal', 'Pre-selected saved feat', {
					featName: matchingFeat.name,
					featId: matchingFeat.id,
				});
			}
		}
	}

	async _renderFeatList() {
		const listEl = this.modal.querySelector('.feat-list');
		if (!listEl) return;

		const featsToShow = this.filteredFeats
			.filter((f) => {
				const source = (f.source || '').toLowerCase();
				const matchesSource =
					this.selectedSources.size === 0 || this.selectedSources.has(source);
				if (!matchesSource) return false;
				if (!this.searchTerm) return true;
				return f.name.toLowerCase().includes(this.searchTerm);
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		if (featsToShow.length === 0) {
			listEl.innerHTML = '<div class="text-center text-muted py-4">No feats match your filters.</div>';
			return;
		}

		const renderedFeats = await Promise.all(
			featsToShow.map(async (f) => {
				const descParts = [];
				if (Array.isArray(f.entries)) {
					for (const e of f.entries) {
						if (typeof e === 'string') {
							descParts.push(await textProcessor.processString(e));
						} else if (Array.isArray(e?.entries)) {
							for (const se of e.entries) {
								if (typeof se === 'string') {
									descParts.push(await textProcessor.processString(se));
								}
							}
						}
					}
				} else if (typeof f.entries === 'string') {
					descParts.push(await textProcessor.processString(f.entries));
				}

				const desc = descParts.join(' ');

				const isSelected = this.selectedFeatIds.has(f.id);
				return `
					<div class="feat-item ${isSelected ? 'selected' : ''} ${!isSelected && this.selectedFeatIds.size >= this.featSlotLimit ? 'disabled' : ''}" data-feat-id="${f.id}" role="button" tabindex="${!isSelected && this.selectedFeatIds.size >= this.featSlotLimit ? '-1' : '0'}" aria-pressed="${isSelected}" aria-disabled="${!isSelected && this.selectedFeatIds.size >= this.featSlotLimit ? 'true' : 'false'}">
						<div class="flex-grow-1">
							<div class="feat-item-header">
								<strong class="feat-item-name">${f.name}</strong>
								<span class="badge feat-item-source">${f.source}</span>
							</div>
							<div class="feat-desc">${desc}</div>
						</div>
						<div class="feat-selected-indicator" aria-hidden="true">✓ Selected</div>
					</div>
				`;
			}),
		);

		listEl.innerHTML = renderedFeats.join('');
		this._bindFeatSelectionHandlers(listEl);
	}


	_attachEventListeners() {
		// Cancel button closes modal (using Bootstrap dismiss)
		const cancelButton = this.modal.querySelector('.btn-secondary');
		if (cancelButton) {
			cancelButton.addEventListener('click', () => this.close());
		}

		// OK button emits selected feats (should all be within allowance now)
		const okButton = this.modal.querySelector('.btn-ok');
		if (okButton) {
			okButton.addEventListener('click', () => {
				const selectedFeats = this.validFeats.filter((f) =>
					this.selectedFeatIds.has(f.id),
				);

				if (selectedFeats.length > 0) {
					// Add origin field to each selected feat
					const featsWithOrigin = selectedFeats.map((f) => ({
						...f,
						origin: this._featOrigins.get(f.id) || 'Unknown',
					}));

					console.debug('FeatSelectionModal', 'Emitting FEATS_SELECTED event', {
						count: featsWithOrigin.length,
						feats: featsWithOrigin.map((f) => `${f.name} (${f.origin})`),
					});
					eventBus.emit(EVENTS.FEATS_SELECTED, featsWithOrigin);
					showNotification(`${featsWithOrigin.length} feat(s) selected!`, 'success');
				}
				this.close();
			});
		}

		const searchInput = this.modal.querySelector('.feat-search');
		const sourceMenu = this.modal.querySelector('.feat-source-menu');
		const sourceToggle = this.modal.querySelector('.feat-source-toggle');
		if (searchInput) {
			searchInput.addEventListener('input', async () => {
				this.searchTerm = searchInput.value.trim().toLowerCase();
				await this._renderFeatList();
			});
		}
		if (sourceMenu && sourceToggle) {
			this._populateSourceFilter(sourceMenu, sourceToggle);
			sourceToggle.addEventListener('click', (e) => {
				e.preventDefault();
				sourceMenu.classList.toggle('show');
				sourceToggle.setAttribute('aria-expanded', sourceMenu.classList.contains('show'));
			});
			document.addEventListener('click', (e) => {
				if (!this.modal.contains(e.target)) return;
				if (!sourceMenu.contains(e.target) && !sourceToggle.contains(e.target)) {
					sourceMenu.classList.remove('show');
					sourceToggle.setAttribute('aria-expanded', 'false');
				}
			});
		}
	}

	_bindFeatSelectionHandlers(listEl) {
		const items = listEl.querySelectorAll('.feat-item');
		items.forEach((item) => {
			const featId = item.getAttribute('data-feat-id');
			const toggle = async () => {
				const isCurrentlySelected = this.selectedFeatIds.has(featId);
				const isDisabled = item.getAttribute('aria-disabled') === 'true';

				// Only allow toggling if not disabled, or if already selected (can deselect)
				if (isDisabled && !isCurrentlySelected) {
					return;
				}

				if (isCurrentlySelected) {
					this.selectedFeatIds.delete(featId);
					item.classList.remove('selected');
					item.setAttribute('aria-pressed', 'false');
				} else {
					this.selectedFeatIds.add(featId);
					item.classList.add('selected');
					item.setAttribute('aria-pressed', 'true');
				}

				// Update disabled state of all items after selection changes
				this._updateItemDisabledStates(listEl);
			};

			item.addEventListener('click', (e) => {
				e.preventDefault();
				toggle();
			});
			item.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggle();
				}
			});
		});

		// Initial disable state
		this._updateItemDisabledStates(listEl);
	}

	_updateItemDisabledStates(listEl) {
		const items = listEl.querySelectorAll('.feat-item');
		const atLimit = this.selectedFeatIds.size >= this.featSlotLimit;

		items.forEach((item) => {
			const featId = item.getAttribute('data-feat-id');
			const isSelected = this.selectedFeatIds.has(featId);

			if (!isSelected && atLimit) {
				item.classList.add('disabled');
				item.setAttribute('aria-disabled', 'true');
				item.setAttribute('tabindex', '-1');
			} else {
				item.classList.remove('disabled');
				item.setAttribute('aria-disabled', 'false');
				item.setAttribute('tabindex', '0');
			}
		});
	}

	_populateSourceFilter(menuEl, toggleBtn) {
		const sources = Array.from(
			new Set(
				this.validFeats
					.map((f) => (f.source || '').trim())
					.filter(Boolean)
					.map((s) => s.toLowerCase()),
			),
		);
		sources.sort();

		sources.forEach((src) => {
			const id = `feat-source-${src}`;
			const item = document.createElement('div');
			item.className = 'form-check';
			item.innerHTML = `
				<input class="form-check-input" type="checkbox" value="${src}" id="${id}">
				<label class="form-check-label" for="${id}">${src.toUpperCase()}</label>
			`;
			const cb = item.querySelector('input');
			cb.addEventListener('change', async () => {
				if (cb.checked) {
					this.selectedSources.add(src);
				} else {
					this.selectedSources.delete(src);
				}
				this._updateSourceLabel(toggleBtn);
				await this._renderFeatList();
			});
			menuEl.appendChild(item);
		});
		this._updateSourceLabel(toggleBtn);
	}

	_updateSourceLabel(toggleBtn) {
		if (!toggleBtn) return;
		if (this.selectedSources.size === 0) {
			toggleBtn.textContent = 'All sources';
			return;
		}
		const count = this.selectedSources.size;
		const preview = Array.from(this.selectedSources)
			.slice(0, 2)
			.map((s) => s.toUpperCase())
			.join(', ');
		const suffix = count > 2 ? ` +${count - 2}` : '';
		toggleBtn.textContent = `${preview}${suffix}`;
	}

	close() {
		// Hide the Bootstrap modal properly without removing the element
		if (this.bootstrapModal) {
			this.bootstrapModal.hide();
		}

		// Clean up any lingering backdrops in case Bootstrap missed them
		setTimeout(() => {
			const backdrop = document.querySelector('.modal-backdrop');
			if (backdrop) {
				backdrop.remove();
			}
			document.body.classList.remove('modal-open');
		}, 100);
	}
}
