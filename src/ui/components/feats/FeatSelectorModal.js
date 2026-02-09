// FeatSelectorModal.js
// Modal for selecting feats valid for the current character using the universal selector

import { AppState } from '../../../app/AppState.js';
import { Character } from '../../../app/Character.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { featService } from '../../../services/FeatService.js';
import { sourceService } from '../../../services/SourceService.js';
import { BaseSelectorModal } from '../selection/BaseSelectorModal.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';

export class FeatSelectorModal {
	constructor({ allowClose = true } = {}) {
		this.allowClose = allowClose;
		this._controller = null;
		this._availability = null;
		this._selectionLimit = null;
		this._baseSelectionLimit = null;
		this.selectedFeats = [];
		this._snapshot = [];
		this.ignoreRaceRestrictions = false;
		this.ignoreSelectionLimit = false;
		this.descriptionCache = new Map();
		this._resolveSelection = null;
	}

	async show() {
		return new Promise((resolve, reject) => {
			try {
				this._resolveSelection = resolve;

				const character = AppState.getCurrentCharacter();
				this._availability = character?.getFeatAvailability?.() || {
					max: 0,
					remaining: 0,
					reasons: [],
					blockedReason:
						'No feat selections available. Choose Variant Human or reach level 4.',
				};

				this._baseSelectionLimit = this._availability?.max || 0;
				this._selectionLimit = this.ignoreSelectionLimit
					? null
					: this._baseSelectionLimit;

				this.selectedFeats = this._getInitialSelection();
				this._snapshot = [...this.selectedFeats];
				this._ensureController();
				this._controller.config.selectionLimit = this._selectionLimit;

				// Don't await - callbacks will resolve the promise
				this._controller.show(this._getContext());
			} catch (error) {
				console.error('[FeatSelectorModal]', 'Error showing modal:', error);
				reject(error);
			}
		});
	}

	_getContext() {
		return {
			character: AppState.getCurrentCharacter(),
		};
	}

	_ensureController() {
		if (this._controller) return;

		this._controller = new BaseSelectorModal({
			modalId: `featSelectionModal_${Date.now()}`,
			modalTitle: 'Select Feats',
			allowClose: this.allowClose,
			pageSize: 50,
			itemIdAttribute: 'data-feat-id',
			selectionMode: 'multiple',
			selectionLimit: this._selectionLimit,
			getContext: () => this._getContext(),
			getInitialSelection: () => [...this.selectedFeats],
			loadItems: (ctx) => this._loadValidFeats(ctx),
			matchItem: (feat, state) => this._featMatchesFilters(feat, state),
			renderItem: (feat, state) => this._renderFeatCard(feat, state),
			getItemId: (feat) => feat.id,
			onConfirm: (selected) => this._handleConfirm(selected),
			onCancel: () => this._handleCancel(),
			buildFilters: (ctx, panel, cleanup) =>
				this._buildFilters(ctx, panel, cleanup),
			onSelectionChange: (state) => this._updateSelectionUi(state),
			onListRendered: (state) => {
				this._processDescriptions(state);
				this._updateSelectionUi(state);
			},
			onError: (err) => this._onError(err),
		});
	}

	_getInitialSelection() {
		const character = AppState.getCurrentCharacter();
		if (!character?.feats?.length) return [];

		return character.feats.map((feat) => ({
			...feat,
			id: this._buildFeatId(feat),
		}));
	}

	_buildFeatId(feat) {
		const name = (feat?.name || '').toLowerCase();
		const source = (feat?.source || 'PHB').toLowerCase();
		return feat?.id || `${name}|${source}`;
	}

	async _loadValidFeats(ctx) {
		const character = ctx.character;
		const allFeats = featService.getAllFeats();
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => (s || '').toLowerCase()),
		);

		const filtered = allFeats
			.filter((feat) => {
				const src = (feat.source || '').toLowerCase();
				if (!allowedSources.has(src)) return false;
				return featService.isFeatValidForCharacter(feat, character, {
					ignoreRacePrereq: this.ignoreRaceRestrictions,
				});
			})
			.map((feat) => ({
				...feat,
				id: this._buildFeatId(feat),
			}));

		// Keep already selected feats even if they are filtered out (e.g., saved feats from another source)
		this.selectedFeats.forEach((feat) => {
			const exists = filtered.some((f) => f.id === feat.id);
			if (!exists) {
				filtered.push({ ...feat, id: this._buildFeatId(feat) });
			}
		});

		return filtered.sort((a, b) => a.name.localeCompare(b.name));
	}

	_featMatchesFilters() {
		// Additional filters are handled via source/search in BaseSelectorModal
		return true;
	}

	_renderFeatCard(feat, state) {
		const description = this.descriptionCache.has(feat.id)
			? this.descriptionCache.get(feat.id)
			: '<span class="text-muted small">Loading...</span>';

		const isSelected = state?.selectedIds?.has(feat.id);
		const atLimit =
			this._selectionLimit !== null &&
			state?.selectedIds?.size >= this._selectionLimit &&
			!isSelected;

		const selectedClass = isSelected ? 'selected' : '';
		const disabledClass = atLimit ? 'disabled' : '';

		let badgesHtml = '';
		if (feat.source) {
			badgesHtml += `<span class="badge bg-secondary me-2">${feat.source}</span>`;
		}

		return `
			<div class="spell-card selector-card ${selectedClass} ${disabledClass}"
			     data-feat-id="${feat.id}"
			     role="button"
			     aria-pressed="${isSelected}"
			     aria-disabled="${atLimit ? 'true' : 'false'}"
			     tabindex="${atLimit ? '-1' : '0'}">
				<div class="spell-card-header">
					<div>
						<strong>${feat.name}</strong>
					</div>
					<div>${badgesHtml}</div>
				</div>
				<div class="spell-card-body">
					<div class="feat-description">${description}</div>
				</div>
			</div>
		`;
	}

	_processDescriptions(state) {
		const pending = state.filtered.filter(
			(feat) => !this.descriptionCache.has(feat.id),
		);
		if (!pending.length) return;

		const processNext = async (index) => {
			if (index >= pending.length) return;
			const feat = pending[index];
			try {
				const descParts = [];
				if (Array.isArray(feat.entries)) {
					for (const entry of feat.entries) {
						if (typeof entry === 'string') {
							descParts.push(await textProcessor.processString(entry));
						} else if (Array.isArray(entry?.entries)) {
							for (const sub of entry.entries) {
								if (typeof sub === 'string') {
									descParts.push(await textProcessor.processString(sub));
								}
							}
						}
					}
				} else if (typeof feat.entries === 'string') {
					descParts.push(await textProcessor.processString(feat.entries));
				}

				const description = descParts.length
					? descParts.join(' ')
					: '<span class="text-muted small">No description available.</span>';
				this.descriptionCache.set(feat.id, description);

				const slot = document.querySelector(
					`[data-feat-id="${feat.id}"] .feat-description`,
				);
				if (slot) {
					slot.innerHTML = description;
				}
			} catch (error) {
				console.error(
					'[FeatSelectorModal]',
					'Failed to process description',
					error,
				);
			}

			setTimeout(() => processNext(index + 1), 0);
		};

		processNext(0);
	}

	_buildFilters(_ctx, panel, cleanup) {
		if (!panel) return;
		panel.innerHTML = '';

		const collapseId = `collapseRestrictions_${Date.now()}`;

		// Build a card manually to control title and body contents
		const card = document.createElement('div');
		card.className = 'card mb-3';

		const header = document.createElement('div');
		header.className = 'card-header';
		header.style.cursor = 'pointer';
		header.setAttribute('data-bs-toggle', 'collapse');
		header.setAttribute('data-bs-target', `#${collapseId}`);
		header.setAttribute('aria-expanded', 'true');
		header.innerHTML = `
			<h6 class="mb-0 d-flex align-items-center justify-content-between w-100">
				<span>Restrictions</span>
				<i class="fas fa-chevron-down"></i>
			</h6>
		`;
		card.appendChild(header);

		const collapseWrapper = document.createElement('div');
		collapseWrapper.className = 'collapse show';
		collapseWrapper.id = collapseId;

		const body = document.createElement('div');
		body.className = 'card-body';
		const builder = new FilterBuilder(body, cleanup);

		builder.addSwitch({
			id: 'featIgnoreRacePrereq',
			label: 'Ignore race prerequisites',
			checked: this.ignoreRaceRestrictions,
			onChange: async (checked) => {
				this.ignoreRaceRestrictions = checked;
				await this._reloadItems();
			},
		});

		builder.addSwitch({
			id: 'featIgnoreSelectionLimit',
			label: 'Ignore selection limit',
			checked: this.ignoreSelectionLimit,
			onChange: (checked) => {
				this.ignoreSelectionLimit = checked;
				this._applySelectionLimitFromToggle();
			},
		});

		collapseWrapper.appendChild(body);
		card.appendChild(collapseWrapper);
		panel.appendChild(card);
	}

	_updateSelectionUi(state) {
		if (!this._controller?.modal) return;

		const confirmBtn = this._controller.modal.querySelector('.btn-confirm');
		if (confirmBtn) {
			const count = state?.selectedItems?.length || 0;
			confirmBtn.disabled = count === 0;
			confirmBtn.innerHTML =
				count > 0 ? `Add ${count} Feat${count > 1 ? 's' : ''}` : 'Add Feats';
		}

		this._applyLimitClasses(state);
	}

	_applyLimitClasses(state) {
		if (!this._controller?.modal) return;

		const list = this._controller.modal.querySelector('.spell-list-container');
		if (!list) return;

		const atLimit =
			this._selectionLimit !== null && state?.selectedIds?.size >= this._selectionLimit;

		list.querySelectorAll('[data-feat-id]').forEach((el) => {
			const id = el.getAttribute('data-feat-id');
			const isSelected = state?.selectedIds?.has(id);
			const disabled = atLimit && !isSelected;
			el.classList.toggle('disabled', disabled);
			el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
			el.setAttribute('tabindex', disabled ? '-1' : '0');
		});
	}

	async _reloadItems() {
		const items = await this._loadValidFeats(this._getContext());
		this._controller.state.items = items;
		this._controller.state.page = 0;
		this._controller._renderList();
	}

	_applySelectionLimitFromToggle() {
		this._selectionLimit = this.ignoreSelectionLimit
			? null
			: this._baseSelectionLimit;
		if (this._controller) {
			this._controller.config.selectionLimit = this._selectionLimit;
			this._updateSelectionUi(this._controller.state || {});
		}
	}

	_applyOrigins(selected) {
		const reasons = this._availability?.reasons || [];
		if (!reasons.length) return selected.map((feat) => ({ ...feat }));

		return selected.map((feat, idx) => ({
			...feat,
			origin:
				feat.origin ||
				this._formatOrigin(reasons[idx % reasons.length]) ||
				'Unknown',
		}));
	}

	async _handleConfirm(selected) {
		if (!Array.isArray(selected) || !selected.length) {
			showNotification('Please select at least one feat', 'warning');
			return null;
		}

		const enriched = this._applyOrigins(selected);
		this.selectedFeats = enriched;
		this._snapshot = [...enriched];

		eventBus.emit(EVENTS.FEATS_SELECTED, enriched);
		showNotification(
			`${enriched.length} feat${enriched.length === 1 ? '' : 's'} selected!`,
			'success',
		);

		// Resolve the promise
		if (this._resolveSelection) {
			this._resolveSelection(enriched);
			this._resolveSelection = null;
		}

		return enriched;
	}

	_handleCancel() {
		this.selectedFeats = [...this._snapshot];
		// Resolve the promise with null
		if (this._resolveSelection) {
			this._resolveSelection(null);
			this._resolveSelection = null;
		}
	}

	_formatOrigin(reason) {
		if (!reason) return '';
		return reason.replace(/^[^:]+:\s*/, '').trim();
	}

	_onError(err) {
		console.error('FeatSelectorModal', err);
		showNotification('Failed to open feat selection modal', 'error');
	}
}

//=============================================================================
// Feat List View - Main feat display
//=============================================================================

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

//=============================================================================
// Feat Sources View - Source summary display
//=============================================================================

export class FeatSourcesView {
	constructor() {
		this._storageKey = 'featSourcesCollapsed';
	}

	async update(container, character) {
		if (!container) return;

		if (
			!character ||
			!Array.isArray(character.feats) ||
			character.feats.length === 0
		) {
			container.innerHTML = '';
			return;
		}

		if (character.feats.length === 0) {
			container.innerHTML = '';
			return;
		}

		// Group feats by source (origin) and render one line per source
		const grouped = [];
		const sourceIndex = new Map();
		character.feats.forEach((feat) => {
			const name = feat?.name || 'Unknown';
			const source = feat?.source || 'Unknown';

			if (!sourceIndex.has(source)) {
				sourceIndex.set(source, grouped.length);
				grouped.push({ source, names: [] });
			}
			grouped[sourceIndex.get(source)].names.push(name);
		});

		const isCollapsed = localStorage.getItem(this._storageKey) === 'true';
		const chevronClass = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';

		let html = `
			<div class="sources-collapsible-header u-collapsible-header">
				<h6 class="mb-0">Sources</h6>
				<i class="fas ${chevronClass} u-text-md"></i>
			</div>
			<div class="sources-collapsible-content ${isCollapsed ? 'u-hidden' : 'u-block'}">
				<div class="proficiency-note">
		`;

		grouped.forEach(({ source, names }) => {
			html += `<div><strong>${source}:</strong> ${names.join(', ')}</div>`;
		});

		html += `
				</div>
			</div>
		`;

		container.innerHTML = html;

		// Add click listener to toggle collapse
		const header = container.querySelector('.sources-collapsible-header');
		if (header) {
			header.addEventListener('click', () => this._toggleCollapse(container));
		}

		await textProcessor.processElement(container);
	}

	_toggleCollapse(container) {
		const content = container.querySelector('.sources-collapsible-content');
		const icon = container.querySelector('.sources-collapsible-header i');

		if (!content || !icon) return;

		const isCurrentlyCollapsed = content.classList.contains('u-hidden');

		if (isCurrentlyCollapsed) {
			content.classList.remove('u-hidden');
			content.classList.add('u-block');
			icon.className = 'fas fa-chevron-up u-text-md';
			localStorage.setItem(this._storageKey, 'false');
		} else {
			content.classList.remove('u-block');
			content.classList.add('u-hidden');
			icon.className = 'fas fa-chevron-down u-text-md';
			localStorage.setItem(this._storageKey, 'true');
		}
	}
}
