/** Proficiency business logic with source tracking for adds/removals. */
// biome-ignore-all lint/complexity/noStaticOnlyClass: false positive

import { eventBus, EVENTS } from '../infrastructure/EventBus.js';


/**
 * @typedef {Object} ProficiencyWithSources
 * @property {string} name - The name of the proficiency
 * @property {Set<string>} sources - Set of sources that grant this proficiency
 */

/**
 * @typedef {Object} OptionalProficiencyConfig
 * @property {number} allowed - Number of proficiencies allowed to be selected
 * @property {string[]} options - Available proficiency options
 * @property {string[]} selected - Currently selected proficiencies
 */

/**
 * Core proficiency logic handler
 */
export class ProficiencyCore {
	/**
	 * Adds a proficiency to a character with source tracking
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type (skills, languages, tools, armor, weapons, savingThrows)
	 * @param {string} proficiency - The proficiency name
	 * @param {string} source - The source granting this proficiency (e.g., 'Race', 'Class', 'Background')
	 * @returns {boolean} True if added, false if it was already present
	 */
	static addProficiency(character, type, proficiency, source) {
		if (!character || !type || !proficiency || !source) {
			console.warn('Invalid parameters for addProficiency:', {
				type,
				proficiency,
				source,
			});
			return false;
		}

		// Ensure proficiencies structure exists
		if (!character.proficiencies) {
			character.proficiencies = {};
		}
		if (!character.proficiencies[type]) {
			character.proficiencies[type] = [];
		}

		// Ensure proficiency sources structure exists
		if (!character.proficiencySources) {
			character.proficiencySources = {};
		}
		if (!character.proficiencySources[type]) {
			character.proficiencySources[type] = new Map();
		}

		// Add to proficiencies array if not already present
		const wasNew = !character.proficiencies[type].includes(proficiency);
		if (wasNew) {
			character.proficiencies[type].push(proficiency);
		}

		// Track source
		if (!character.proficiencySources[type].has(proficiency)) {
			character.proficiencySources[type].set(proficiency, new Set());
		}
		character.proficiencySources[type].get(proficiency).add(source);

		// Handle skill auto-refund if this is a fixed proficiency
		if (type === 'skills' && !source.includes('Choice')) {
			ProficiencyCore._refundOptionalSkill(character, proficiency, source);
		}

		// Emit event
		eventBus.emit(EVENTS.PROFICIENCY_ADDED, {
			type,
			proficiency,
			source,
			character,
		});

		return wasNew;
	}

	/**
	 * Removes proficiencies from a specific source
	 * @param {Object} character - The character object
	 * @param {string} source - The source to remove proficiencies from
	 * @returns {Object} Object with arrays of removed proficiencies by type
	 */
	static removeProficienciesBySource(character, source) {
		if (!character || !source) {
			console.warn('Invalid parameters for removeProficienciesBySource');
			return {};
		}

		const removed = {};

		if (!character.proficiencySources) {
			return removed;
		}

		// Iterate through each proficiency type
		for (const type in character.proficiencySources) {
			removed[type] = [];

			// Iterate through proficiencies of this type
			for (const [proficiency, sources] of character.proficiencySources[
				type
			].entries()) {
				// Remove this source
				if (sources.has(source)) {
					sources.delete(source);
					removed[type].push(proficiency);

					// If no sources remain, remove the proficiency entirely
					if (sources.size === 0) {
						character.proficiencySources[type].delete(proficiency);

						// Remove from proficiencies array
						if (character.proficiencies[type]) {
							const index = character.proficiencies[type].indexOf(proficiency);
							if (index > -1) {
								character.proficiencies[type].splice(index, 1);
							}
						}
					}
				}
			}
		}

		// Emit event
		eventBus.emit(EVENTS.PROFICIENCY_REMOVED_BY_SOURCE, {
			source,
			removed,
			character,
		});

		return removed;
	}

	/**
	 * Checks if a character has a proficiency (from any source)
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} proficiency - The proficiency name
	 * @returns {boolean} True if the character has this proficiency
	 */
	static hasProficiency(character, type, proficiency) {
		return character?.proficiencies?.[type]?.includes(proficiency) || false;
	}

	/**
	 * Gets all sources for a specific proficiency
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} proficiency - The proficiency name
	 * @returns {Set<string>} Set of sources granting this proficiency
	 */
	static getProficiencySources(character, type, proficiency) {
		return character?.proficiencySources?.[type]?.get(proficiency) || new Set();
	}

	/**
	 * Gets all proficiencies of a type with their sources
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @returns {ProficiencyWithSources[]} Array of proficiencies with their sources
	 */
	static getProficienciesWithSources(character, type) {
		if (!character?.proficiencies?.[type]) {
			return [];
		}

		return character.proficiencies[type].map((proficiency) => ({
			name: proficiency,
			sources: ProficiencyCore.getProficiencySources(
				character,
				type,
				proficiency,
			),
		}));
	}

	/**
	 * Sets up optional proficiency configuration for a source
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type (skills, languages, tools)
	 * @param {string} source - Source identifier ('race', 'class', 'background')
	 * @param {number} allowed - Number of proficiencies allowed to be selected
	 * @param {string[]} options - Available proficiency options
	 */
	static setOptionalProficiencies(character, type, source, allowed, options) {
		if (!character || !type || !source) {
			console.warn('Invalid parameters for setOptionalProficiencies');
			return;
		}

		// Ensure optional proficiencies structure exists
		if (!character.optionalProficiencies) {
			character.optionalProficiencies = {};
		}
		if (!character.optionalProficiencies[type]) {
			character.optionalProficiencies[type] = {
				allowed: 0,
				options: [],
				selected: [],
				race: { allowed: 0, options: [], selected: [] },
				class: { allowed: 0, options: [], selected: [] },
				background: { allowed: 0, options: [], selected: [] },
			};
		}

		// Set configuration for this source
		const sourceLower = source.toLowerCase();
		if (!character.optionalProficiencies[type][sourceLower]) {
			character.optionalProficiencies[type][sourceLower] = {
				allowed: 0,
				options: [],
				selected: [],
			};
		}

		character.optionalProficiencies[type][sourceLower].allowed = allowed;
		character.optionalProficiencies[type][sourceLower].options = [...options];

		// Recalculate combined options and allowed count
		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		// Emit event
		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CONFIGURED, {
			type,
			source: sourceLower,
			allowed,
			options,
			character,
		});
	}

	/**
	 * Clears optional proficiency configuration for a source
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier ('race', 'class', 'background')
	 */
	static clearOptionalProficiencies(character, type, source) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const sourceLower = source.toLowerCase();
		if (character.optionalProficiencies[type][sourceLower]) {
			// Clear selections and remove from character
			const selected =
				character.optionalProficiencies[type][sourceLower].selected || [];
			for (const _proficiency of selected) {
				ProficiencyCore.removeProficienciesBySource(
					character,
					`${source} Choice`,
				);
			}

			// Clear the configuration
			character.optionalProficiencies[type][sourceLower] = {
				allowed: 0,
				options: [],
				selected: [],
			};

			// Recalculate combined
			ProficiencyCore._recalculateOptionalProficiencies(character, type);
		}

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CLEARED, {
			type,
			source: sourceLower,
			character,
		});
	}

	/**
	 * Selects an optional proficiency for a character
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier ('race', 'class', 'background')
	 * @param {string} proficiency - The proficiency to select
	 * @returns {boolean} True if selection was successful
	 */
	static selectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			console.warn('Optional proficiencies not initialized for type:', type);
			return false;
		}

		const sourceLower = source.toLowerCase();
		const config = character.optionalProficiencies[type][sourceLower];

		if (!config) {
			console.warn('No optional proficiency configuration for source:', source);
			return false;
		}

		// Check if already selected
		if (config.selected.includes(proficiency)) {
			return false;
		}

		// Check if there's room for more selections
		if (config.selected.length >= config.allowed) {
			console.warn(
				'Maximum optional proficiencies already selected for',
				source,
			);
			return false;
		}

		// Verify proficiency is in options
		if (!config.options.includes(proficiency)) {
			console.warn('Proficiency not in available options:', proficiency);
			return false;
		}

		// Add to selected
		config.selected.push(proficiency);

		// Add the proficiency with source tracking
		ProficiencyCore.addProficiency(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		// Recalculate combined
		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_SELECTED, {
			type,
			source: sourceLower,
			proficiency,
			character,
		});

		return true;
	}

	/**
	 * Deselects an optional proficiency
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier ('race', 'class', 'background')
	 * @param {string} proficiency - The proficiency to deselect
	 * @returns {boolean} True if deselection was successful
	 */
	static deselectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			return false;
		}

		const sourceLower = source.toLowerCase();
		const config = character.optionalProficiencies[type][sourceLower];

		if (!config) {
			return false;
		}

		// Remove from selected
		const index = config.selected.indexOf(proficiency);
		if (index === -1) {
			return false;
		}

		config.selected.splice(index, 1);

		// Remove the proficiency (only the specific source)
		ProficiencyCore._removeProficiencyFromSource(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		// Recalculate combined
		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_DESELECTED, {
			type,
			source: sourceLower,
			proficiency,
			character,
		});

		return true;
	}

	/**
	 * Gets available options for optional proficiency selection
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier
	 * @returns {string[]} Array of available proficiency names
	 */
	static getAvailableOptionalProficiencies(character, type, source) {
		const sourceLower = source.toLowerCase();
		const config = character?.optionalProficiencies?.[type]?.[sourceLower];

		if (!config) {
			return [];
		}

		// Return options that haven't been selected yet and aren't already granted as fixed proficiencies
		return config.options.filter((option) => {
			// Don't show if already selected for this source
			if (config.selected.includes(option)) {
				return false;
			}

			// Don't show if it's a fixed proficiency from any source
			const sources = ProficiencyCore.getProficiencySources(
				character,
				type,
				option,
			);
			const hasNonChoiceSources = Array.from(sources).some(
				(s) => !s.includes('Choice'),
			);

			return !hasNonChoiceSources;
		});
	}

	/**
	 * Recalculates combined optional proficiency data
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @private
	 */
	static _recalculateOptionalProficiencies(character, type) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const config = character.optionalProficiencies[type];
		const sources = ['race', 'class', 'background'];

		// Combine allowed counts
		config.allowed = sources.reduce((sum, source) => {
			return sum + (config[source]?.allowed || 0);
		}, 0);

		// Combine options (unique values)
		const allOptions = new Set();
		for (const source of sources) {
			if (config[source]?.options) {
				for (const opt of config[source].options) {
					allOptions.add(opt);
				}
			}
		}
		config.options = Array.from(allOptions);

		// Combine selected (unique values)
		const allSelected = new Set();
		for (const source of sources) {
			if (config[source]?.selected) {
				for (const sel of config[source].selected) {
					allSelected.add(sel);
				}
			}
		}
		config.selected = Array.from(allSelected);
	}

	/**
	 * Automatically refund a skill selection if it's now granted as a fixed proficiency
	 * @param {Object} character - The character object
	 * @param {string} proficiency - The proficiency being added as fixed
	 * @param {string} newSource - The source adding the fixed proficiency
	 * @private
	 */
	static _refundOptionalSkill(character, proficiency, newSource) {
		if (!character?.optionalProficiencies?.skills) {
			return;
		}

		const normalizedProf = proficiency.toLowerCase().trim();
		const sources = ['race', 'class', 'background'];
		let refunded = false;

		for (const source of sources) {
			// Skip the source that's adding the fixed proficiency
			if (
				(source === 'race' && newSource === 'Race') ||
				(source === 'class' && newSource === 'Class') ||
				(source === 'background' && newSource === 'Background')
			) {
				continue;
			}

			const config = character.optionalProficiencies.skills[source];
			if (!config?.selected) {
				continue;
			}

			// Check if this proficiency is in the selected list (case-insensitive)
			const matchingProf = config.selected.find(
				(s) => s.toLowerCase().trim() === normalizedProf,
			);

			if (matchingProf) {
				// Remove from selected list
				const index = config.selected.indexOf(matchingProf);
				config.selected.splice(index, 1);

				// Remove the choice source
				ProficiencyCore._removeProficiencyFromSource(
					character,
					'skills',
					matchingProf,
					`${source.charAt(0).toUpperCase() + source.slice(1)} Choice`,
				);

				refunded = true;
			}
		}

		if (refunded) {
			// Recalculate combined
			ProficiencyCore._recalculateOptionalProficiencies(character, 'skills');

			// Emit event for UI update
			eventBus.emit(EVENTS.PROFICIENCY_REFUNDED, {
				type: 'skills',
				proficiency,
				character,
			});
		}
	}

	/**
	 * Removes a proficiency from a specific source only
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} proficiency - The proficiency name
	 * @param {string} source - The specific source to remove
	 * @private
	 */
	static _removeProficiencyFromSource(character, type, proficiency, source) {
		if (!character?.proficiencySources?.[type]) {
			return;
		}

		const sources = character.proficiencySources[type].get(proficiency);
		if (!sources) {
			return;
		}

		sources.delete(source);

		// If no sources remain, remove the proficiency entirely
		if (sources.size === 0) {
			character.proficiencySources[type].delete(proficiency);

			if (character.proficiencies[type]) {
				const index = character.proficiencies[type].indexOf(proficiency);
				if (index > -1) {
					character.proficiencies[type].splice(index, 1);
				}
			}
		}
	}

	/**
	 * Initializes proficiency structures on a character if they don't exist
	 * @param {Object} character - The character object
	 */
	static initializeProficiencyStructures(character) {
		if (!character) {
			return;
		}

		const types = [
			'skills',
			'savingThrows',
			'languages',
			'tools',
			'armor',
			'weapons',
		];

		// Initialize proficiencies
		if (!character.proficiencies) {
			character.proficiencies = {};
		}
		for (const type of types) {
			if (!character.proficiencies[type]) {
				character.proficiencies[type] = [];
			}
		}

		// Initialize proficiency sources
		if (!character.proficiencySources) {
			character.proficiencySources = {};
		}
		for (const type of types) {
			if (!character.proficiencySources[type]) {
				character.proficiencySources[type] = new Map();
			}
		}

		// Initialize optional proficiencies for applicable types
		if (!character.optionalProficiencies) {
			character.optionalProficiencies = {};
		}

		const optionalTypes = ['skills', 'languages', 'tools'];
		for (const type of optionalTypes) {
			if (!character.optionalProficiencies[type]) {
				character.optionalProficiencies[type] = {
					allowed: 0,
					options: [],
					selected: [],
					race: { allowed: 0, options: [], selected: [] },
					class: { allowed: 0, options: [], selected: [] },
					background: { allowed: 0, options: [], selected: [] },
				};
			}
		}

		// Add Common language as default if none exist
		if (character.proficiencies.languages.length === 0) {
			ProficiencyCore.addProficiency(
				character,
				'languages',
				'Common',
				'Default',
			);
		}
	}
}

export default ProficiencyCore;
