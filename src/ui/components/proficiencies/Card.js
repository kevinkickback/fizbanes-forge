// Controller for proficiency display/selection/notes UI

import { CharacterManager } from '../../../app/CharacterManager.js';
import { ProficiencyCore } from '../../../app/Proficiency.js';
import DataNormalizer from '../../../lib/DataNormalizer.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import { ARTISAN_TOOLS, MUSICAL_INSTRUMENTS } from '../../../lib/ProficiencyConstants.js';
import { proficiencyService } from '../../../services/ProficiencyService.js';
import { ProficiencyDisplayView } from './Display.js';
import { ProficiencyNotesView } from './Notes.js';
import { ProficiencySelectionView } from './Selection.js';

class InstrumentChoicesView {
	constructor() {
		this._container = null;
	}

	render(toolsContainer, slots, onChange) {
		if (!toolsContainer) return;

		const host = this._getOrCreateHost(toolsContainer);

		if (!slots || slots.length === 0) {
			host.remove();
			return;
		}

		host.innerHTML = this._buildContent(slots);
		this._wireEvents(host, onChange);
	}

	_buildContent(slots) {
		const selectedInstruments = new Set(
			slots.map((s) => s.selection).filter(Boolean),
		);

		return `
			<div class="instrument-choices-grid">
				${slots
				.map((slot, index) => {
					return `
							<div class="instrument-choice-group">
								<label class="form-label">${slot.sourceLabel} instrument</label>
								<select class="form-select form-select-sm instrument-choice-select" data-slot-index="${index}" data-source-label="${slot.sourceLabel}" data-key="${slot.key}">
									<option value="">Choose...</option>
									${MUSICAL_INSTRUMENTS.map((inst) => {
						const isSelected = slot.selection === inst;
						const isUsedElsewhere = selectedInstruments.has(inst) && !isSelected;
						return `<option value="${inst}" ${isSelected ? 'selected' : ''} ${isUsedElsewhere ? 'disabled' : ''}>${inst}${isUsedElsewhere ? ' (used)' : ''}</option>`;
					}).join('')}
								</select>
							</div>
						`;
				})
				.join('')}
			</div>
		`;
	}

	_wireEvents(host, onChange) {
		const selects = host.querySelectorAll('.instrument-choice-select');
		for (const select of selects) {
			select.addEventListener('change', onChange);
		}
	}

	_getOrCreateHost(toolsContainer) {
		let host = toolsContainer.querySelector('.instrument-choices-container');
		if (!host) {
			host = document.createElement('div');
			host.className = 'instrument-choices-container';
			toolsContainer.appendChild(host);
		}
		return host;
	}
}

export class ProficiencyCard {
	constructor() {
		this._character = null;
		this._proficiencyManager = proficiencyService;
		this._proficiencyTypes = [
			'skills',
			'savingThrows',
			'languages',
			'tools',
			'armor',
			'weapons',
		];

		this._defaultProficiencies = {
			languages: ['Common'],
			weapons: [],
			armor: [],
			tools: [],
			skills: [],
			savingThrows: [],
		};

		this._proficiencyContainers = {};
		this._proficiencyNotesContainer = null;

		// Initialize views
		this._displayView = new ProficiencyDisplayView();
		this._selectionView = new ProficiencySelectionView();
		this._notesView = new ProficiencyNotesView();
		this._instrumentChoicesView = new InstrumentChoicesView();

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();
	}

	async initialize() {
		try {
			this._character = CharacterManager.getCurrentCharacter();
			if (!this._character) {
				console.error('ProficiencyCard', 'No active character found');
				return;
			}

			this._initializeDomReferences();
			this._setupEventListeners();
			this._initializeCharacterProficiencies();
			this._rehydrateInstrumentChoices();
			await this._populateProficiencyContainers();
			this._updateProficiencyNotes();
		} catch (error) {
			console.error('ProficiencyCard', 'Initialization error:', error);
		}
	}

	_initializeDomReferences() {
		for (const type of this._proficiencyTypes) {
			const containerId = `${type}Container`;
			this._proficiencyContainers[type] = document.getElementById(containerId);

			if (!this._proficiencyContainers[type]) {
				console.warn(
					'ProficiencyCard',
					`Container for ${type} not found: #${containerId}`,
				);
			}
		}

		this._proficiencyNotesContainer =
			document.getElementById('proficiencyNotes');

		if (!this._proficiencyNotesContainer) {
			console.warn('ProficiencyCard', 'Proficiency notes container not found');
		}
	}

	_initializeCharacterProficiencies() {
		if (!this._character) return;

		try {
			// Initialize proficiencies object if it doesn't exist
			if (!this._character.proficiencies) {
				this._character.proficiencies = {};
			}

			// Initialize proficiency sources object if it doesn't exist
			if (!this._character.proficiencySources) {
				this._character.proficiencySources = {};
			}

			// Initialize optional proficiencies object if it doesn't exist
			if (!this._character.optionalProficiencies) {
				this._character.optionalProficiencies = {};
			}

			// Initialize instrument choice slots (for specific instrument selections)
			if (!Array.isArray(this._character.instrumentChoices)) {
				this._character.instrumentChoices = [];
			}

			// Initialize each proficiency type as an array
			for (const type of this._proficiencyTypes) {
				// Regular proficiencies
				if (!Array.isArray(this._character.proficiencies[type])) {
					this._character.proficiencies[type] = [];
				}

				// Proficiency sources
				if (!this._character.proficiencySources[type]) {
					this._character.proficiencySources[type] = new Map();
				}

				// Optional proficiencies
				if (!this._character.optionalProficiencies[type]) {
					this._character.optionalProficiencies[type] = {
						allowed: 0,
						selected: [],
					};
				}

				// For skills and languages, ensure we have all the nested structures
				if (type === 'skills' || type === 'languages' || type === 'tools') {
					this._initializeNestedProficiencyStructures(type);
				}
			}

			// Add default proficiencies if not already present
			this._addDefaultProficiencies();
		} catch (error) {
			console.error(
				'ProficiencyCard',
				'Error initializing character proficiencies:',
				error,
			);
		}
	}

	_initializeNestedProficiencyStructures(type) {
		// Make sure top level options array exists
		if (!this._character.optionalProficiencies[type].options) {
			this._character.optionalProficiencies[type].options = [];
		}

		// Initialize race, class, and background structures
		const sources = ['race', 'class', 'background'];
		for (const source of sources) {
			if (!this._character.optionalProficiencies[type][source]) {
				this._character.optionalProficiencies[type][source] = {
					allowed: 0,
					options: [],
					selected: [],
				};
			} else {
				// Ensure all properties exist if the object itself does
				if (
					typeof this._character.optionalProficiencies[type][source].allowed ===
					'undefined'
				) {
					this._character.optionalProficiencies[type][source].allowed = 0;
				}
				if (
					!Array.isArray(
						this._character.optionalProficiencies[type][source].options,
					)
				) {
					this._character.optionalProficiencies[type][source].options = [];
				}
				if (
					!Array.isArray(
						this._character.optionalProficiencies[type][source].selected,
					)
				) {
					this._character.optionalProficiencies[type][source].selected = [];
				}
			}
		}
	}

	_addDefaultProficiencies() {
		for (const [type, defaults] of Object.entries(this._defaultProficiencies)) {
			for (const prof of defaults) {
				if (!this._character.proficiencies[type].includes(prof)) {
					this._character.addProficiency(type, prof, 'Default');
				}
			}
		}
	}

	_setupEventListeners() {
		try {
			// Set up click listeners for each proficiency container
			this._setupContainerClickListeners();

			// Store handler references for cleanup
			this._characterChangedDocHandler = this._handleCharacterChanged.bind(this);
			this._characterSelectedHandler = this._handleCharacterChanged.bind(this);
			this._proficiencyAddedHandler = this._handleProficiencyAdded.bind(this);
			this._proficiencyRemovedHandler = this._handleProficiencyRemoved.bind(this);
			this._proficiencyRefundedHandler = this._handleProficiencyRefunded.bind(this);
			this._proficiencyChangedHandler = this._handleProficiencyChanged.bind(this);
			this._proficiencyChangedDocHandler = this._handleProficiencyChanged.bind(this);

			// Track document listeners
			this._cleanup.on(document, 'characterChanged', this._characterChangedDocHandler);
			this._cleanup.on(document, 'proficiencyChanged', this._proficiencyChangedDocHandler);

			// Track eventBus listeners (manually since they're not DOM events)
			eventBus.on(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
			eventBus.on('proficiency:added', this._proficiencyAddedHandler);
			eventBus.on('proficiency:removedBySource', this._proficiencyRemovedHandler);
			eventBus.on('proficiency:refunded', this._proficiencyRefundedHandler);
			eventBus.on('proficiency:optionalSelected', this._proficiencyChangedHandler);
			eventBus.on('proficiency:optionalDeselected', this._proficiencyChangedHandler);
		} catch (error) {
			console.error(
				'ProficiencyCard',
				'Error setting up event listeners:',
				error,
			);
		}
	}

	_cleanupEventListeners() {
		// Manually remove eventBus listeners
		if (this._characterSelectedHandler) {
			eventBus.off(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
		}
		if (this._proficiencyAddedHandler) {
			eventBus.off('proficiency:added', this._proficiencyAddedHandler);
		}
		if (this._proficiencyRemovedHandler) {
			eventBus.off('proficiency:removedBySource', this._proficiencyRemovedHandler);
		}
		if (this._proficiencyRefundedHandler) {
			eventBus.off('proficiency:refunded', this._proficiencyRefundedHandler);
		}
		if (this._proficiencyChangedHandler) {
			eventBus.off('proficiency:optionalSelected', this._proficiencyChangedHandler);
			eventBus.off('proficiency:optionalDeselected', this._proficiencyChangedHandler);
		}

		// Clean up all tracked DOM listeners
		this._cleanup.cleanup();
	}

	_setupContainerClickListeners() {
		for (const type of this._proficiencyTypes) {
			const container = this._proficiencyContainers[type];
			if (!container) continue;

			this._cleanup.on(container, 'click', (e) => {
				const item = e.target.closest('.proficiency-item');
				if (!item) return;

				// Only toggle if it's selectable or optionally selected
				const isSelectable = item.classList.contains('selectable');
				const isOptionalSelected = item.classList.contains('optional-selected');
				const isDefault = item.classList.contains('default');

				if ((isSelectable || isOptionalSelected) && !isDefault) {
					const changed = this._selectionView.toggleOptionalProficiency(
						item,
						this._character,
					);

					if (changed) {
						// Update proficiency count displays for all types
						this._displayView.updateSelectionCounters(
							this._proficiencyContainers,
							this._character,
						);

						// Refresh the specific container to reflect detailed UI state changes
						this._populateProficiencyContainers();

						// Emit CHARACTER_UPDATED event to signal proficiency change
						eventBus.emit(EVENTS.CHARACTER_UPDATED, {
							character: CharacterManager.getCurrentCharacter(),
						});
					}
				}
			});
		}
	}

	_handleProficiencyAdded(data) {
		this._handleProficiencyChanged({ detail: data });
	}

	_handleProficiencyRemoved(_data) {
		this._handleProficiencyChanged({ detail: { forcedRefresh: true } });
	}

	_handleProficiencyRefunded(data) {
		this._handleProficiencyChanged({
			detail: {
				triggerCleanup: true,
				showRefund: true,
				proficiency: data.proficiency,
			},
		});
	}

	_handleCharacterChanged(_event) {
		console.log('[ProficiencyCard] _handleCharacterChanged() called');

		try {
			this._character = CharacterManager.getCurrentCharacter();

			if (this._character) {
				console.log('[ProficiencyCard] _handleCharacterChanged - optionalProficiencies.tools.class before reinit:',
					JSON.stringify(this._character.optionalProficiencies?.tools?.class || {}));

				ProficiencyCore.initializeProficiencyStructures(this._character);
				this._initializeCharacterProficiencies();
				this._reinitializeClassToolProficiencies();
				this._cleanupOptionalProficiencies();
				this._rehydrateInstrumentChoices();
				this._populateProficiencyContainers();
				this._updateProficiencyNotes();
				this._renderInstrumentChoices();
			}
		} catch (error) {
			console.error(
				'ProficiencyCard',
				'Error handling character change:',
				error,
			);
		}
	}

	/**
	 * Re-initialize class tool proficiencies when character is loaded.
	 * This ensures optionalProficiencies.tools.class.options is populated
	 * so instrument slots can be computed correctly.
	 * 
	 * NOTE: This method attempts to reload class data to repopulate options.
	 * However, if classService isn't available yet (during initial load),
	 * the data should already be present from Character.toJSON/fromJSON.
	 * @private
	 */
	_reinitializeClassToolProficiencies() {
		console.log('[ProficiencyCard] _reinitializeClassToolProficiencies() called');

		if (!this._character?.class) {
			console.log('[ProficiencyCard] No character or class, returning');
			return;
		}

		// If options and selected arrays are already populated from saved data, we're done
		const currentOptions = this._character.optionalProficiencies?.tools?.class?.options || [];
		const currentSelected = this._character.optionalProficiencies?.tools?.class?.selected || [];
		const currentAllowed = this._character.optionalProficiencies?.tools?.class?.allowed || 0;

		console.log('[ProficiencyCard] Current state: options=', currentOptions, 'selected=', currentSelected, 'allowed=', currentAllowed);

		// If we already have valid data, don't overwrite it
		if (currentOptions.length > 0 && currentSelected.length > 0 && currentAllowed > 0) {
			console.log('[ProficiencyCard] Data already populated from save, skipping reinit');
			return;
		}

		const classService = window.classService;
		if (!classService) {
			console.log('[ProficiencyCard] No classService yet - data should be loaded from save file');
			return;
		}

		const classData = classService.getClassByName(this._character.class);
		if (!classData) {
			console.log('[ProficiencyCard] No classData for', this._character.class);
			return;
		}

		console.log('[ProficiencyCard] Processing class:', this._character.class);

		// Re-process class tool proficiencies using the same logic as ClassCard
		const toolProfs = classData?.startingProficiencies?.toolProficiencies;
		if (!toolProfs || !Array.isArray(toolProfs)) {
			console.log('[ProficiencyCard] No toolProficiencies, returning');
			return;
		}

		let maxAllowed = 0;
		const allOptions = [];

		for (const profObj of toolProfs) {
			// Handle "any musical instrument" choice (e.g., Bard with anyMusicalInstrument: 3)
			if (profObj.anyMusicalInstrument) {
				const count = profObj.anyMusicalInstrument;
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push('Musical instrument');
			}

			// Handle "any artisan's tool" choice (e.g., Monk with anyArtisansTool: 1)
			if (profObj.anyArtisansTool) {
				const count = profObj.anyArtisansTool;
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push(...ARTISAN_TOOLS);
			}

			// Handle "any" tool proficiency choice
			if (profObj.any && profObj.any > 0) {
				maxAllowed = Math.max(maxAllowed, profObj.any);
				allOptions.push('any');
			}

			// Handle choose from specific list
			if (profObj.choose) {
				const count = profObj.choose.count || 1;
				const options = profObj.choose.from || [];
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push(...options);
			}
		}

		console.log('[ProficiencyCard] maxAllowed:', maxAllowed, 'allOptions:', allOptions);

		// Apply accumulated tool choices if any
		if (maxAllowed > 0) {
			this._character.optionalProficiencies.tools.class.allowed = maxAllowed;
			this._character.optionalProficiencies.tools.class.options = allOptions;

			// Special case: if ONLY "Musical instrument" is offered (like Bard),
			// ensure the selected array has the right number of entries
			if (allOptions.length === 1 && allOptions[0] === 'Musical instrument') {
				// For Bard: always ensure we have maxAllowed "Musical instrument" entries
				const musicalInstrumentCount = (this._character.optionalProficiencies.tools.class.selected || [])
					.filter(sel => sel === 'Musical instrument').length;

				console.log('[ProficiencyCard] Bard detected - current instrument count:', musicalInstrumentCount, 'maxAllowed:', maxAllowed);

				if (musicalInstrumentCount < maxAllowed) {
					// Ensure selected array exists and has correct entries
					this._character.optionalProficiencies.tools.class.selected = [];
					for (let i = 0; i < maxAllowed; i++) {
						this._character.optionalProficiencies.tools.class.selected.push('Musical instrument');
					}
					console.log('[ProficiencyCard] Set selected array to:', this._character.optionalProficiencies.tools.class.selected);
				}
			} else {
				// For other classes: preserve existing selections if they're still valid
				const existingSelected = this._character.optionalProficiencies.tools.class.selected || [];
				this._character.optionalProficiencies.tools.class.selected = existingSelected.filter(
					(sel) => allOptions.includes(sel) || allOptions.includes('any')
				);
				console.log('[ProficiencyCard] Filtered selected array to:', this._character.optionalProficiencies.tools.class.selected);
			}
		}
	}

	_handleProficiencyChanged(event) {
		try {
			const detail = event.detail || {};

			if (detail.triggerCleanup) {
				this._cleanupOptionalProficiencies();
			}

			if (detail.forcedRefresh) {
				this._populateProficiencyContainers();
			} else {
				this._displayView.updateSelectionCounters(
					this._proficiencyContainers,
					this._character,
				);
			}

			this._updateProficiencyNotes();
			this._renderInstrumentChoices();

			if (detail.showRefund && detail.proficiency) {
				this._showRefundNotification(detail.proficiency);
			}
		} catch (error) {
			console.error(
				'ProficiencyCard',
				'Error handling proficiency change:',
				error,
			);
		}
	}

	_showRefundNotification(skill) {
		console.info('ProficiencyCard', `Skill proficiency refunded: ${skill}`);
	}

	async _populateProficiencyContainers() {
		if (!this._character) return;

		// Get available options for all types
		const availableOptionsMap = {};
		for (const type of this._proficiencyTypes) {
			availableOptionsMap[type] = await this._getAvailableOptions(type);
		}

		// Render containers using display view
		this._displayView.renderContainers(
			this._proficiencyContainers,
			this._character,
			availableOptionsMap,
			this._defaultProficiencies,
			this._isGrantedBySource.bind(this),
			this._isProficiencyAvailable.bind(this),
			this._displayView.getIconForType.bind(this._displayView),
			this._proficiencyManager,
		);

		// Render instrument dropdowns (after main list so container exists)
		this._renderInstrumentChoices();
	}

	_renderInstrumentChoices() {
		const toolsContainer = this._proficiencyContainers?.tools;
		if (!toolsContainer) return;

		const slots = this._computeInstrumentSlots();
		console.log('[ProficiencyCard] Rendering instrument choices with', slots.length, 'slots:', slots);
		this._instrumentChoicesView.render(
			toolsContainer,
			slots,
			this._handleInstrumentChoiceChange.bind(this),
		);
	}

	async _getAvailableOptions(type) {
		switch (type) {
			case 'skills': {
				const allSkills = await this._proficiencyManager.getAvailableSkills();
				// Return skills with proper casing from 5etools JSON
				return allSkills;
			}
			case 'savingThrows':
				return [
					'Strength',
					'Dexterity',
					'Constitution',
					'Intelligence',
					'Wisdom',
					'Charisma',
				];
			case 'languages': {
				// Return languages with proper casing from 5etools JSON
				const availableLanguages = [
					'Common',
					'Dwarvish',
					'Elvish',
					'Giant',
					'Gnomish',
					'Goblin',
					'Halfling',
					'Orc',
					'Abyssal',
					'Celestial',
					'Draconic',
					'Deep Speech',
					'Infernal',
					'Primordial',
					'Sylvan',
					'Undercommon',
				];
				return availableLanguages;
			}
			case 'tools': {
				const allTools = await this._proficiencyManager.getAvailableTools();
				// Return tools with original JSON casing preserved
				return allTools;
			}
			case 'armor':
				return ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'];
			case 'weapons':
				return ['Simple Weapons', 'Martial Weapons'];
			default:
				return [];
		}
	}

	/**
	 * Compute instrument slots based on sources that offer "Musical instrument".
	 * Creates one slot for each allowed instrument choice from a source.
	 * 
	 * IMPORTANT: Only creates slots if Musical Instrument is the ONLY tool option.
	 * If it's one of several options, user must explicitly select it first.
	 * 
	 * @returns {Array<{key: string, sourceLabel: string, slotIndex: number, selection?: string}>}
	 * @private
	 */
	_computeInstrumentSlots() {
		console.log('[ProficiencyCard] _computeInstrumentSlots() called');

		const normalizedInstrument = DataNormalizer.normalizeForLookup(
			'Musical instrument',
		);
		const slots = [];

		// Check each source (race, class, background) for instrument offerings
		const sources = [
			{ key: 'race', label: 'Race' },
			{ key: 'class', label: 'Class' },
			{ key: 'background', label: 'Background' },
		];

		for (const { key, label } of sources) {
			const config = this._character?.optionalProficiencies?.tools?.[key];
			if (!config) {
				console.log(`[ProficiencyCard] No config for source: ${key}`);
				continue;
			}

			const options = config.options || [];
			const allowed = config.allowed || 0;

			console.log(`[ProficiencyCard] Source ${key}: options=`, options, 'allowed=', allowed);

			// Check if this source offers Musical Instrument
			const offersInstruments = options.some(
				(opt) => DataNormalizer.normalizeForLookup(opt) === normalizedInstrument,
			);

			// Check if user explicitly selected Musical Instrument
			const selected = config.selected || [];
			console.log(`[ProficiencyCard] Source ${key}: selected=`, selected);

			const isExplicitlySelected = selected.some(
				(sel) => DataNormalizer.normalizeForLookup(sel) === normalizedInstrument,
			);

			console.log(`[ProficiencyCard] Source ${key}: offersInstruments=${offersInstruments}, isExplicitlySelected=${isExplicitlySelected}`);

			// Create slots if:
			// 1. Musical Instrument is the ONLY option (e.g., Bard gets 3 slots automatically), OR
			// 2. Musical Instrument was explicitly selected by user (e.g., Monk choosing it)
			const isOnlyOption = options.length === 1 && offersInstruments;
			const shouldCreateSlots = (isOnlyOption || isExplicitlySelected) && allowed > 0;

			console.log(`[ProficiencyCard] Source ${key}: isOnlyOption=${isOnlyOption}, shouldCreateSlots=${shouldCreateSlots}`);

			if (shouldCreateSlots) {
				// Create a slot for each choice allowed by this source
				for (let i = 0; i < allowed; i++) {
					slots.push({
						key,
						sourceLabel: label,
						slotIndex: i, // Index within this source's slots
						selection: null,
					});
				}
			}
		}

		// Restore saved selections from character data
		return this._restoreSavedSelections(slots);
	}

	_restoreSavedSelections(computedSlots) {
		const saved = this._character.instrumentChoices || [];
		const remaining = [...saved];
		const result = [];

		// Match computed slots with saved selections
		for (const slot of computedSlots) {
			const idx = remaining.findIndex(
				(s) =>
					s.key === slot.key &&
					s.sourceLabel === slot.sourceLabel &&
					s.slotIndex === slot.slotIndex,
			);
			let selection = null;
			if (idx !== -1) {
				selection = remaining[idx].selection || null;
				remaining.splice(idx, 1);
			}
			result.push({ ...slot, selection });
		}

		// Remove proficiencies for slots that no longer exist
		for (const orphaned of remaining) {
			if (orphaned.selection) {
				ProficiencyCore._removeProficiencyFromSource(
					this._character,
					'tools',
					orphaned.selection,
					`${orphaned.sourceLabel} Instrument Choice`,
				);
			}
		}

		this._character.instrumentChoices = result;
		return result;
	}

	/**
	 * Rehydrate instrument proficiencies and rebuild instrumentChoices from saved selections.
	 * This reconstructs the dropdowns based on what's in character.proficiencies.tools
	 * with sources like "Class Instrument Choice".
	 * @private
	 */
	_rehydrateInstrumentChoices() {
		if (!this._character) return;

		// First, rebuild instrumentChoices from saved proficiencies
		const instrumentProficiencies = this._extractInstrumentProficiencies();

		// If we found instrument proficiencies but instrumentChoices is empty, reconstruct it
		if (instrumentProficiencies.length > 0 && (!this._character.instrumentChoices || this._character.instrumentChoices.length === 0)) {
			this._character.instrumentChoices = instrumentProficiencies;
		}

		// Rehydrate proficiencies from stored slots
		if (!Array.isArray(this._character?.instrumentChoices)) return;

		for (const slot of this._character.instrumentChoices) {
			if (!slot?.selection) continue;

			// Check if proficiency already exists to avoid duplicates
			const alreadyHas = this._character.proficiencies?.tools?.some(
				(p) =>
					DataNormalizer.normalizeForLookup(p.name || p) ===
					DataNormalizer.normalizeForLookup(slot.selection) &&
					(p.source || '') === `${slot.sourceLabel} Instrument Choice`,
			);

			if (!alreadyHas) {
				ProficiencyCore.addProficiency(
					this._character,
					'tools',
					slot.selection,
					`${slot.sourceLabel} Instrument Choice`,
				);
			}
		}
	}

	_extractInstrumentProficiencies() {
		const slots = [];
		const proficiencies = this._character?.proficiencies?.tools || [];
		const profSources = this._character?.proficiencySources?.tools || new Map();

		// Find all proficiencies with "Instrument Choice" sources
		for (const prof of proficiencies) {
			// Proficiency is stored as a string
			const profName = prof;
			const sources = profSources.get(profName) || new Set();

			// Look for sources ending in "Instrument Choice"
			for (const source of sources) {
				if (source.includes('Instrument Choice')) {
					// Extract source label (e.g., "Class" from "Class Instrument Choice")
					const sourceLabel = source.replace(' Instrument Choice', '');
					// Extract key (race/class/background) from sourceLabel
					const key = sourceLabel.toLowerCase();

					slots.push({
						key,
						sourceLabel,
						selection: profName,
						isDefault: false,
					});
				}
			}
		}

		return slots;
	}

	_handleInstrumentChoiceChange(event) {
		const select = event.target;
		const slotIndex = Number.parseInt(select.dataset.slotIndex, 10);
		if (Number.isNaN(slotIndex)) return;

		const key = select.dataset.key;
		const sourceLabel = select.dataset.sourceLabel || 'Instrument Choice';
		const newSelection = select.value || '';

		const slot = this._character.instrumentChoices?.[slotIndex];
		if (!slot || slot.key !== key || slot.sourceLabel !== sourceLabel) return;

		const previousSelection = slot.selection;
		if (previousSelection === newSelection) return; // No change

		// Remove old instrument proficiency if one was selected
		if (previousSelection) {
			ProficiencyCore._removeProficiencyFromSource(
				this._character,
				'tools',
				previousSelection,
				`${sourceLabel} Instrument Choice`,
			);
		}

		// Update slot selection
		slot.selection = newSelection || null;

		// Add new instrument proficiency if a new one was selected
		if (newSelection) {
			ProficiencyCore.addProficiency(
				this._character,
				'tools',
				newSelection,
				`${sourceLabel} Instrument Choice`,
			);
		}

		// Re-render to update mutual exclusion
		this._renderInstrumentChoices();

		// Notify of change
		this._updateProficiencyNotes();
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	_isProficiencyAvailable(type, proficiency) {
		if (!this._character) return false;

		// Default proficiencies are always selected but not selectable
		if (this._defaultProficiencies[type]?.includes(proficiency)) return false;

		// If proficiency is granted by class/race/background, it's not selectable
		if (this._isGrantedBySource(type, proficiency)) return false;

		// Get the total optional allowed for this type
		const primaryOptionalAllowed =
			this._character.optionalProficiencies[type]?.allowed || 0;
		const totalOptionalAllowedFromSources =
			this._getTotalOptionalAllowedFromSources(type);

		if (primaryOptionalAllowed <= 0 && totalOptionalAllowedFromSources <= 0)
			return false;

		// Normalize proficiency for comparison
		const normalizedProf = DataNormalizer.normalizeString(proficiency);

		// Handle languages
		if (type === 'languages') {
			const raceOptions =
				this._character.optionalProficiencies[type].race?.options || [];
			const classOptions =
				this._character.optionalProficiencies[type].class?.options || [];
			const backgroundOptions =
				this._character.optionalProficiencies[type].background?.options || [];

			const raceAllowed =
				this._character.optionalProficiencies[type].race?.allowed || 0;
			const classAllowed =
				this._character.optionalProficiencies[type].class?.allowed || 0;
			const backgroundAllowed =
				this._character.optionalProficiencies[type].background?.allowed || 0;

			const raceSelected =
				this._character.optionalProficiencies[type].race?.selected || [];
			const classSelected =
				this._character.optionalProficiencies[type].class?.selected || [];
			const backgroundSelected =
				this._character.optionalProficiencies[type].background?.selected || [];

			const raceAllowsAny = raceOptions
				.map((o) => DataNormalizer.normalizeString(o))
				.includes('any');
			const classAllowsAny = classOptions
				.map((o) => DataNormalizer.normalizeString(o))
				.includes('any');
			const backgroundAllowsAny = backgroundOptions
				.map((o) => DataNormalizer.normalizeString(o))
				.includes('any');

			const isRaceOption =
				raceAllowsAny ||
				raceOptions
					.map((o) => DataNormalizer.normalizeString(o))
					.includes(normalizedProf);
			const isClassOption =
				classAllowsAny ||
				classOptions
					.map((o) => DataNormalizer.normalizeString(o))
					.includes(normalizedProf);
			const isBackgroundOption =
				backgroundAllowsAny ||
				backgroundOptions
					.map((o) => DataNormalizer.normalizeString(o))
					.includes(normalizedProf);

			if (isRaceOption && raceSelected.length < raceAllowed) return true;
			if (isClassOption && classSelected.length < classAllowed) return true;
			if (isBackgroundOption && backgroundSelected.length < backgroundAllowed)
				return true;

			return false;
		}

		// For skills
		if (type === 'skills') {
			const raceOptions =
				this._character.optionalProficiencies[type].race?.options?.map((o) =>
					DataNormalizer.normalizeString(o),
				) || [];
			const classOptions =
				this._character.optionalProficiencies[type].class?.options?.map((o) =>
					DataNormalizer.normalizeString(o),
				) || [];
			const backgroundOptions =
				this._character.optionalProficiencies[type].background?.options?.map(
					(o) => DataNormalizer.normalizeString(o),
				) || [];
			const raceSelected =
				this._character.optionalProficiencies[type].race?.selected || [];
			const classSelected =
				this._character.optionalProficiencies[type].class?.selected || [];
			const backgroundSelected =
				this._character.optionalProficiencies[type].background?.selected || [];

			const raceAllowed =
				this._character.optionalProficiencies[type].race?.allowed || 0;
			const classAllowed =
				this._character.optionalProficiencies[type].class?.allowed || 0;
			const backgroundAllowed =
				this._character.optionalProficiencies[type].background?.allowed || 0;

			const raceAllowsAny = raceOptions.includes('any');
			const classAllowsAny = classOptions.includes('any');
			const backgroundAllowsAny = backgroundOptions.includes('any');

			const isRaceOption =
				raceAllowsAny || raceOptions.includes(normalizedProf);
			const isClassOption =
				classAllowsAny || classOptions.includes(normalizedProf);
			const isBackgroundOption =
				backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

			const raceSlotsAvailable = raceSelected.length < raceAllowed;
			const classSlotsAvailable = classSelected.length < classAllowed;
			const backgroundSlotsAvailable =
				backgroundSelected.length < backgroundAllowed;

			if (isRaceOption && raceSlotsAvailable) return true;
			if (isClassOption && classSlotsAvailable) return true;
			if (isBackgroundOption && backgroundSlotsAvailable) return true;

			return false;
		}

		// For tools
		if (type === 'tools') {
			const raceOptions =
				this._character.optionalProficiencies[type].race?.options?.map((o) =>
					DataNormalizer.normalizeString(o),
				) || [];
			const classOptions =
				this._character.optionalProficiencies[type].class?.options?.map((o) =>
					DataNormalizer.normalizeString(o),
				) || [];
			const backgroundOptions =
				this._character.optionalProficiencies[type].background?.options?.map(
					(o) => DataNormalizer.normalizeString(o),
				) || [];
			const raceSelected =
				this._character.optionalProficiencies[type].race?.selected || [];
			const classSelected =
				this._character.optionalProficiencies[type].class?.selected || [];
			const backgroundSelected =
				this._character.optionalProficiencies[type].background?.selected || [];

			const raceAllowed =
				this._character.optionalProficiencies[type].race?.allowed || 0;
			const classAllowed =
				this._character.optionalProficiencies[type].class?.allowed || 0;
			const backgroundAllowed =
				this._character.optionalProficiencies[type].background?.allowed || 0;

			const raceAllowsAny = raceOptions.includes('any');
			const classAllowsAny = classOptions.includes('any');
			const backgroundAllowsAny = backgroundOptions.includes('any');

			const isRaceOption =
				raceAllowsAny || raceOptions.includes(normalizedProf);
			const isClassOption =
				classAllowsAny || classOptions.includes(normalizedProf);
			const isBackgroundOption =
				backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

			const raceSlotsAvailable = raceSelected.length < raceAllowed;
			const classSlotsAvailable = classSelected.length < classAllowed;
			const backgroundSlotsAvailable =
				backgroundSelected.length < backgroundAllowed;

			if (isRaceOption && raceSlotsAvailable) return true;
			if (isClassOption && classSlotsAvailable) return true;
			if (isBackgroundOption && backgroundSlotsAvailable) return true;

			return false;
		}

		// For other types (Armor, Weapons)
		const otherTypeAllowed =
			this._character.optionalProficiencies?.[type]?.allowed > 0;
		if (otherTypeAllowed) {
			const raceOptions =
				this._character.optionalProficiencies?.[type]?.race?.options?.map((o) =>
					DataNormalizer.normalizeString(o),
				) || [];
			const classOptions =
				this._character.optionalProficiencies?.[type]?.class?.options?.map(
					(o) => DataNormalizer.normalizeString(o),
				) || [];
			const backgroundOptions =
				this._character.optionalProficiencies?.[type]?.background?.options?.map(
					(o) => DataNormalizer.normalizeString(o),
				) || [];
			const hasAnySourceOptions =
				raceOptions.length > 0 ||
				classOptions.length > 0 ||
				backgroundOptions.length > 0;

			if (hasAnySourceOptions) {
				const normalizedItem = DataNormalizer.normalizeString(proficiency);
				return (
					raceOptions.includes(normalizedItem) ||
					classOptions.includes(normalizedItem) ||
					backgroundOptions.includes(normalizedItem)
				);
			}
			return true;
		}
		return false;
	}

	_updateProficiencyNotes() {
		this._notesView.updateProficiencyNotes(
			this._proficiencyNotesContainer,
			this._character,
			this._displayView.getTypeLabel.bind(this._displayView),
		);
	}

	_isGrantedBySource(type, proficiency) {
		// For tools, first check if this is an auto-granted item in optional selections
		// (e.g., Bard's auto-selected "Musical instrument")
		if (type === 'tools') {
			const normalizedProf = DataNormalizer.normalizeForLookup(proficiency);
			const sources = ['race', 'class', 'background'];
			for (const source of sources) {
				const config = this._character?.optionalProficiencies?.tools?.[source];
				if (!config) continue;

				// If this source only offers one option and it's the proficiency we're checking,
				// and it's in the selected array, it's auto-granted
				if (
					config.options?.length === 1 &&
					DataNormalizer.normalizeForLookup(config.options[0]) ===
					normalizedProf &&
					config.selected?.includes(proficiency)
				) {
					return true;
				}
			}
		}

		if (!this._character?.proficiencySources?.[type]) {
			return false;
		}

		// Safety check - ensure proficiency is a string
		let profString = proficiency;
		if (typeof proficiency !== 'string') {
			if (proficiency && typeof proficiency === 'object' && proficiency.name) {
				profString = proficiency.name;
			} else if (proficiency && typeof proficiency.toString === 'function') {
				profString = proficiency.toString();
			} else {
				return false;
			}
		}

		// Normalize the proficiency name for case-insensitive comparison
		const normalizedProf = DataNormalizer.normalizeForLookup(profString);

		// Find the matching proficiency by case-insensitive comparison
		let matchingProf = null;
		for (const [prof, _] of this._character.proficiencySources[
			type
		].entries()) {
			if (
				prof.toLowerCase?.() !== undefined &&
				DataNormalizer.normalizeForLookup(prof) === normalizedProf
			) {
				matchingProf = prof;
				break;
			}
		}

		if (!matchingProf) {
			return false;
		}

		const sources = this._character.proficiencySources[type].get(matchingProf);

		if (!sources || sources.size === 0) {
			return false;
		}

		// Check if any of the sources are fixed sources
		const fixedSources = Array.from(sources).filter(
			(source) =>
				source !== 'Race Choice' &&
				source !== 'Class Choice' &&
				source !== 'Background Choice' &&
				!source.includes('Choice'),
		);

		return fixedSources.length > 0;
	}

	_cleanupOptionalProficiencies() {
		console.log('[ProficiencyCard] _cleanupOptionalProficiencies() called');
		console.log('[ProficiencyCard] tools.class BEFORE cleanup:',
			JSON.stringify(this._character?.optionalProficiencies?.tools?.class || {}));

		if (!this._character || !this._character.optionalProficiencies) return;

		let changesDetected = false;

		for (const type of this._proficiencyTypes) {
			if (!this._character.optionalProficiencies[type]?.selected) continue;

			// Special handling for skills to manage race, class, and background sources separately
			if (type === 'skills' || type === 'languages' || type === 'tools') {
				changesDetected =
					this._cleanupSourceSpecificProficiencies(type) || changesDetected;
			}
			// Regular cleanup for non-source-tracked proficiencies
			else {
				changesDetected =
					this._cleanupSimpleProficiencies(type) || changesDetected;
			}
		}

		if (changesDetected) {
			this._populateProficiencyContainers();
			// Emit CHARACTER_UPDATED when proficiencies are cleaned up
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		}

		console.log('[ProficiencyCard] tools.class AFTER cleanup:',
			JSON.stringify(this._character?.optionalProficiencies?.tools?.class || {}));

		return changesDetected;
	}

	_cleanupSourceSpecificProficiencies(type) {
		let changesDetected = false;
		const fixedProficiencies = this._character.proficiencies[type] || [];
		const sources = ['race', 'class', 'background'];

		for (const source of sources) {
			if (!this._character.optionalProficiencies[type][source]?.selected)
				continue;

			const selected = [
				...this._character.optionalProficiencies[type][source].selected,
			];
			for (const prof of selected) {
				if (fixedProficiencies.includes(prof)) {
					const profSources =
						this._character.proficiencySources?.[type]?.get(prof);
					if (
						profSources &&
						Array.from(profSources).some(
							(s) =>
								s !== 'Race Choice' &&
								s !== 'Class Choice' &&
								s !== 'Background Choice',
						)
					) {
						this._character.optionalProficiencies[type][source].selected =
							this._character.optionalProficiencies[type][
								source
							].selected.filter((s) => s !== prof);
						changesDetected = true;
					}
				}
			}

			// Ensure source doesn't have more selections than allowed
			const allowed =
				this._character.optionalProficiencies[type][source].allowed || 0;
			if (
				this._character.optionalProficiencies[type][source].selected.length >
				allowed
			) {
				this._character.optionalProficiencies[type][source].selected =
					this._character.optionalProficiencies[type][source].selected.slice(
						0,
						allowed,
					);
				changesDetected = true;
			}
		}

		// Update combined selected list
		if (changesDetected) {
			const raceSelected =
				this._character.optionalProficiencies[type].race.selected || [];
			const classSelected =
				this._character.optionalProficiencies[type].class.selected || [];
			const backgroundSelected =
				this._character.optionalProficiencies[type].background.selected || [];
			this._character.optionalProficiencies[type].selected = [
				...raceSelected,
				...classSelected,
				...backgroundSelected,
			];
		}

		return changesDetected;
	}

	_cleanupSimpleProficiencies(type) {
		let changesDetected = false;
		const selectedOptional = [
			...this._character.optionalProficiencies[type].selected,
		];

		for (const prof of selectedOptional) {
			if (!this._character.proficiencies[type].includes(prof)) continue;

			if (this._isGrantedBySource(type, prof)) {
				this._character.optionalProficiencies[type].selected =
					this._character.optionalProficiencies[type].selected.filter(
						(p) => p !== prof,
					);
				changesDetected = true;
			}
		}

		// Ensure we don't have more selections than allowed
		const allowed = this._character.optionalProficiencies[type].allowed || 0;
		const selected = this._character.optionalProficiencies[type].selected || [];

		if (selected.length > allowed) {
			this._character.optionalProficiencies[type].selected = selected.slice(
				0,
				allowed,
			);
			changesDetected = true;
		}

		return changesDetected;
	}

	_getTotalOptionalAllowedFromSources(type) {
		if (
			!this._character ||
			!this._character.optionalProficiencies ||
			!this._character.optionalProficiencies[type]
		) {
			return 0;
		}

		const raceAllowed =
			this._character.optionalProficiencies[type]?.race?.allowed || 0;
		const classAllowed =
			this._character.optionalProficiencies[type]?.class?.allowed || 0;
		const backgroundAllowed =
			this._character.optionalProficiencies[type]?.background?.allowed || 0;

		return raceAllowed + classAllowed + backgroundAllowed;
	}
}
