// FeatSelectionModal.js
// Modal for selecting feats valid for the current character

import { AppState } from '../../core/AppState.js';
import { featService } from '../../services/FeatService.js';
import { sourceService } from '../../services/SourceService.js';
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
		this.ignoreRaceRestrictions = false; // Start with restrictions enforced
	}

	async show() {
		const character = AppState.getCurrentCharacter();
		this._availability = character?.getFeatAvailability?.() || {
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
		const allowedSources = sourceService.getAllowedSources();

		// Filter feats based on:
		// 1. Source is in allowed sources
		// 2. Character prerequisites (level, race, etc.)
		this.validFeats = allFeats
			.filter((f) => {
				// Check if source is allowed
				const featSource = (f.source || '').toLowerCase();
				const isSourceAllowed = allowedSources.some(
					(s) => s.toLowerCase() === featSource,
				);
				if (!isSourceAllowed) return false;

				// Check character prerequisites
				return this._isFeatValidForCharacter(f, character);
			})
			.map((f, index) => ({
				...f,
				id: f.id || `feat-${index}`, // Generate ID if not present
			}));
	}

	_isFeatValidForCharacter(feat, character) {
		if (!feat.prerequisite || !Array.isArray(feat.prerequisite)) {
			return true;
		}

		// All prerequisite conditions must be met (AND logic)
		return feat.prerequisite.every((prereq) =>
			this._validatePrerequisiteCondition(prereq, character),
		);
	}

	_validatePrerequisiteCondition(prereq, character) {
		if (!character) return false;

		// Level requirement
		if (prereq.level !== undefined) {
			const characterLevel = character.level || 1;
			if (characterLevel < prereq.level) {
				return false;
			}
		}

		// Ability score requirement
		if (Array.isArray(prereq.ability)) {
			const abilityScores = character.abilityScores || {};
			const meetsAbilityRequirement = prereq.ability.some((abilityReq) => {
				if (typeof abilityReq === 'string') {
					// Simple ability string (e.g., "str", "dex")
					const score = abilityScores[abilityReq] || 0;
					return score >= 13; // Default threshold
				} else if (typeof abilityReq === 'object' && abilityReq.ability) {
					// Object with ability and minimum score
					const score = abilityScores[abilityReq.ability] || 0;
					const minScore = abilityReq.score || 13;
					return score >= minScore;
				}
				return false;
			});
			if (!meetsAbilityRequirement) return false;
		}

		// Race requirement - skip if ignoreRaceRestrictions is enabled
		if (!this.ignoreRaceRestrictions && Array.isArray(prereq.race)) {
			const characterRace = character.race?.name?.toLowerCase() || '';
			const meetsRaceRequirement = prereq.race.some((raceReq) => {
				if (typeof raceReq === 'string') {
					return characterRace === raceReq.toLowerCase();
				} else if (typeof raceReq === 'object' && raceReq.name) {
					return characterRace === raceReq.name.toLowerCase();
				}
				return false;
			});
			if (!meetsRaceRequirement) return false;
		}

		// Class requirement
		if (Array.isArray(prereq.class)) {
			const characterClass = character.class?.name?.toLowerCase() || '';
			const meetsClassRequirement = prereq.class.some((classReq) => {
				if (typeof classReq === 'string') {
					return characterClass === classReq.toLowerCase();
				} else if (typeof classReq === 'object' && classReq.name) {
					return characterClass === classReq.name.toLowerCase();
				}
				return false;
			});
			if (!meetsClassRequirement) return false;
		}

		// Spellcasting requirement (character must be a spellcaster)
		if (prereq.spellcasting === true) {
			const hasSpellcasting =
				character.spellcastingAbility || character.class?.hasSpellcasting;
			if (!hasSpellcasting) return false;
		}

		// Spellcasting 2020 requirement (character must be a spellcaster with 2020+ rules)
		if (prereq.spellcasting2020 === true) {
			const hasSpellcasting =
				character.spellcastingAbility || character.class?.hasSpellcasting;
			if (!hasSpellcasting) return false;
		}

		// Spellcasting prepared requirement (character must prepare spells)
		if (prereq.spellcastingPrepared === true) {
			const canPrepareSpells =
				character.class?.name?.toLowerCase().includes('cleric') ||
				character.class?.name?.toLowerCase().includes('druid') ||
				character.class?.name?.toLowerCase().includes('wizard') ||
				character.class?.name?.toLowerCase().includes('paladin');
			if (!canPrepareSpells) return false;
		}

		// Spellcasting feature requirement
		if (prereq.spellcastingFeature === true) {
			const hasSpellcasting =
				character.spellcastingAbility || character.class?.hasSpellcasting;
			if (!hasSpellcasting) return false;
		}

		// Proficiency requirement (weapon/armor)
		if (Array.isArray(prereq.proficiency)) {
			const proficiencies = character.proficiencies || {};
			const meetsProficiencyRequirement = prereq.proficiency.some((profReq) => {
				if (typeof profReq === 'string') {
					return proficiencies[profReq] === true;
				} else if (typeof profReq === 'object' && profReq.proficiency) {
					return proficiencies[profReq.proficiency] === true;
				}
				return false;
			});
			if (!meetsProficiencyRequirement) return false;
		}

		// Previous feat requirement
		if (Array.isArray(prereq.feat)) {
			const characterFeats = (character.feats || []).map((f) =>
				typeof f === 'string' ? f.toLowerCase() : (f.name || '').toLowerCase(),
			);
			const meetsFeatRequirement = prereq.feat.some((featReq) => {
				const reqName =
					typeof featReq === 'string'
						? featReq.toLowerCase()
						: (featReq.name || '').toLowerCase();
				return characterFeats.some((cf) => cf.includes(reqName));
			});
			if (!meetsFeatRequirement) return false;
		}

		// Feature requirement (class feature, like "Fighting Style")
		if (Array.isArray(prereq.feature)) {
			const classFeatures = character.class?.features || [];
			const meetsFeatureRequirement = prereq.feature.some((featureReq) => {
				const reqName =
					typeof featureReq === 'string' ? featureReq : featureReq.name || '';
				return classFeatures.some((cf) =>
					(typeof cf === 'string' ? cf : cf.name || '')
						.toLowerCase()
						.includes(reqName.toLowerCase()),
				);
			});
			if (!meetsFeatureRequirement) return false;
		}

		// Campaign requirement (specific campaign, e.g., Eberron)
		if (Array.isArray(prereq.campaign)) {
			const characterCampaign = character.campaign?.toLowerCase() || '';
			const meetsCampaignRequirement = prereq.campaign.some(
				(camp) => characterCampaign === camp.toLowerCase(),
			);
			if (!meetsCampaignRequirement) return false;
		}

		// Other requirements (generic/campaign-specific) - skip validation for now
		// These typically require special knowledge and are handled by DM approval
		if (prereq.other) {
			// For "No other dragonmark" etc., we can't validate without additional context
			// Return true to allow DM override
			return true;
		}

		// If we've made it this far, all conditions are met
		return true;
	}

	_populateFeatOrigins() {
		this._featOrigins.clear();

		if (
			!this._availability?.reasons ||
			this._availability.reasons.length === 0
		) {
			return;
		}

		// For now, assign each reason sequentially to feat selections
		// A more sophisticated approach could let users choose which feat goes with which origin
		let reasonIndex = 0;
		for (const feat of this.validFeats) {
			const reason =
				this._availability.reasons[
					reasonIndex % this._availability.reasons.length
				];
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
				(f) =>
					f.name &&
					f.name.toLowerCase() === (savedFeat.name || '').toLowerCase(),
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
			listEl.innerHTML =
				'<div class="text-center py-4">No feats match your filters.</div>';
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
					showNotification(
						`${featsWithOrigin.length} feat(s) selected!`,
						'success',
					);
				}
				this.close();
			});
		}

		const searchInput = this.modal.querySelector('.feat-search');
		const sourceMenu = this.modal.querySelector('.feat-source-menu');
		const sourceToggle = this.modal.querySelector('.feat-source-toggle');
		const ignoreRestrictionsBtn = this.modal.querySelector(
			'#ignoreRestrictionsToggle',
		);

		if (searchInput) {
			searchInput.addEventListener('input', async () => {
				this.searchTerm = searchInput.value.trim().toLowerCase();
				await this._renderFeatList();
			});
		}

		if (ignoreRestrictionsBtn) {
			ignoreRestrictionsBtn.addEventListener('click', async () => {
				this.ignoreRaceRestrictions = !this.ignoreRaceRestrictions;
				ignoreRestrictionsBtn.setAttribute(
					'data-restrictions',
					!this.ignoreRaceRestrictions,
				);
				// Reload valid feats with new race restriction setting
				await this._loadValidFeats();
				this.filteredFeats = this.validFeats;
				await this._renderFeatList();
			});
		}

		if (sourceMenu && sourceToggle) {
			this._populateSourceFilter(sourceMenu, sourceToggle);
			sourceToggle.addEventListener('click', (e) => {
				e.preventDefault();
				sourceMenu.classList.toggle('show');
				sourceToggle.setAttribute(
					'aria-expanded',
					sourceMenu.classList.contains('show'),
				);
			});
			document.addEventListener('click', (e) => {
				if (!this.modal.contains(e.target)) return;
				if (
					!sourceMenu.contains(e.target) &&
					!sourceToggle.contains(e.target)
				) {
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
		// Get all sources from valid feats, filtered to only allowed sources
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => s.toLowerCase()),
		);

		const sources = Array.from(
			new Set(
				this.validFeats
					.map((f) => (f.source || '').trim())
					.filter((source) => {
						// Only include sources that are in the allowed sources list
						return source && allowedSources.has(source.toLowerCase());
					})
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
