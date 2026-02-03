// biome-ignore-all lint/complexity/noStaticOnlyClass: false positive

import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';

export class ProficiencyCore {
	static addProficiency(character, type, proficiency, source) {
		if (!character || !type || !proficiency || !source) {
			console.warn('ProficiencyCore', 'Invalid parameters for addProficiency:', {
				type,
				proficiency,
				source,
			});
			return false;
		}

		if (!character.proficiencies) character.proficiencies = {};
		if (!character.proficiencies[type]) character.proficiencies[type] = [];
		if (!character.proficiencySources) character.proficiencySources = {};
		if (!character.proficiencySources[type])
			character.proficiencySources[type] = new Map();

		const normalizedTarget = DataNormalizer.normalizeForLookup(proficiency);
		const existingProf = character.proficiencies[type].find(
			(p) => DataNormalizer.normalizeForLookup(p) === normalizedTarget,
		);

		const wasNew = !existingProf;
		if (wasNew) {
			character.proficiencies[type].push(proficiency);
		}

		const trackKey = existingProf || proficiency;
		if (!character.proficiencySources[type].has(trackKey)) {
			character.proficiencySources[type].set(trackKey, new Set());
		}
		character.proficiencySources[type].get(trackKey).add(source);

		if (type === 'skills' && !source.includes('Choice')) {
			ProficiencyCore._refundOptionalSkill(character, proficiency, source);
		}

		eventBus.emit(EVENTS.PROFICIENCY_ADDED, {
			type,
			proficiency,
			source,
			character,
		});

		return wasNew;
	}

	static removeProficienciesBySource(character, source) {
		if (!character || !source) {
			console.warn('ProficiencyCore', 'Invalid parameters for removeProficienciesBySource');
			return {};
		}

		const removed = {};

		if (!character.proficiencySources) {
			return removed;
		}

		for (const type in character.proficiencySources) {
			removed[type] = [];

			for (const [proficiency, sources] of character.proficiencySources[
				type
			].entries()) {
				if (sources.has(source)) {
					sources.delete(source);
					removed[type].push(proficiency);

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
			}
		}

		eventBus.emit(EVENTS.PROFICIENCY_REMOVED_BY_SOURCE, {
			source,
			removed,
			character,
		});

		return removed;
	}

	static hasProficiency(character, type, proficiency) {
		if (!character?.proficiencies?.[type]) return false;

		const normalizedTarget = DataNormalizer.normalizeForLookup(proficiency);
		return character.proficiencies[type].some(
			(p) => DataNormalizer.normalizeForLookup(p) === normalizedTarget,
		);
	}

	static getProficiencySources(character, type, proficiency) {
		return character?.proficiencySources?.[type]?.get(proficiency) || new Set();
	}

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

	static setOptionalProficiencies(character, type, source, allowed, options) {
		if (!character || !type || !source) {
			console.warn('ProficiencyCore', 'Invalid parameters for setOptionalProficiencies');
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

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		if (!character.optionalProficiencies[type][sourceKey]) {
			character.optionalProficiencies[type][sourceKey] = {
				allowed: 0,
				options: [],
				selected: [],
			};
		}

		character.optionalProficiencies[type][sourceKey].allowed = allowed;
		character.optionalProficiencies[type][sourceKey].options = [...options];

		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CONFIGURED, {
			type,
			source: sourceKey,
			allowed,
			options,
			character,
		});
	}

	static clearOptionalProficiencies(character, type, source) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		if (character.optionalProficiencies[type][sourceKey]) {
			const selected =
				character.optionalProficiencies[type][sourceKey].selected || [];
			for (const _proficiency of selected) {
				ProficiencyCore.removeProficienciesBySource(
					character,
					`${source} Choice`,
				);
			}

			character.optionalProficiencies[type][sourceKey] = {
				allowed: 0,
				options: [],
				selected: [],
			};

			ProficiencyCore._recalculateOptionalProficiencies(character, type);
		}

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CLEARED, {
			type,
			source: sourceKey,
			character,
		});
	}

	static selectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			console.warn('ProficiencyCore', 'Optional proficiencies not initialized for type:', type);
			return false;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character.optionalProficiencies[type][sourceKey];

		if (!config) {
			console.warn('ProficiencyCore', 'No optional proficiency configuration for source:', source);
			return false;
		}

		if (config.selected.includes(proficiency)) {
			return false;
		}

		if (config.selected.length >= config.allowed) {
			console.warn(
				'[ProficiencyCore]',
				'Maximum optional proficiencies already selected for',
				source,
			);
			return false;
		}

		if (!config.options.includes(proficiency)) {
			console.warn('ProficiencyCore', 'Proficiency not in available options:', proficiency);
			return false;
		}

		config.selected.push(proficiency);

		ProficiencyCore.addProficiency(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_SELECTED, {
			type,
			source: sourceKey,
			proficiency,
			character,
		});

		return true;
	}

	static deselectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			return false;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character.optionalProficiencies[type][sourceKey];

		if (!config) {
			return false;
		}

		const index = config.selected.indexOf(proficiency);
		if (index === -1) {
			return false;
		}

		config.selected.splice(index, 1);

		ProficiencyCore._removeProficiencyFromSource(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		ProficiencyCore._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_DESELECTED, {
			type,
			source: sourceKey,
			proficiency,
			character,
		});

		return true;
	}

	static getAvailableOptionalProficiencies(character, type, source) {
		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character?.optionalProficiencies?.[type]?.[sourceKey];

		if (!config) {
			return [];
		}

		return config.options.filter((option) => {
			if (config.selected.includes(option)) {
				return false;
			}

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

	static _recalculateOptionalProficiencies(character, type) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const config = character.optionalProficiencies[type];
		const sources = ['race', 'class', 'background'];

		config.allowed = sources.reduce((sum, source) => {
			return sum + (config[source]?.allowed || 0);
		}, 0);

		const allOptions = new Set();
		for (const source of sources) {
			if (config[source]?.options) {
				for (const opt of config[source].options) {
					allOptions.add(opt);
				}
			}
		}
		config.options = Array.from(allOptions);

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

	static _refundOptionalSkill(character, proficiency, newSource) {
		if (!character?.optionalProficiencies?.skills) {
			return;
		}

		const normalizedProf = DataNormalizer.normalizeForLookup(proficiency);
		const sources = ['race', 'class', 'background'];
		let refunded = false;

		for (const source of sources) {
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

			const matchingProf = config.selected.find(
				(s) => DataNormalizer.normalizeForLookup(s) === normalizedProf,
			);

			if (matchingProf) {
				const index = config.selected.indexOf(matchingProf);
				config.selected.splice(index, 1);

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
			ProficiencyCore._recalculateOptionalProficiencies(character, 'skills');

			eventBus.emit(EVENTS.PROFICIENCY_REFUNDED, {
				type: 'skills',
				proficiency,
				character,
			});
		}
	}

	static _removeProficiencyFromSource(character, type, proficiency, source) {
		if (!character?.proficiencySources?.[type]) {
			return;
		}

		const targetLower = DataNormalizer.normalizeForLookup(proficiency);
		let foundProf = null;

		for (const [key] of character.proficiencySources[type]) {
			if (DataNormalizer.normalizeForLookup(key) === targetLower) {
				foundProf = key;
				break;
			}
		}

		if (!foundProf) {
			return;
		}

		const sources = character.proficiencySources[type].get(foundProf);
		if (!sources) {
			return;
		}

		sources.delete(source);

		if (sources.size === 0) {
			character.proficiencySources[type].delete(foundProf);

			if (character.proficiencies[type]) {
				const index = character.proficiencies[type].findIndex(
					(p) => DataNormalizer.normalizeForLookup(p) === targetLower,
				);
				if (index > -1) {
					character.proficiencies[type].splice(index, 1);
				}
			}
		}
	}

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

		if (!character.proficiencies) {
			character.proficiencies = {};
		}
		for (const type of types) {
			if (!character.proficiencies[type]) {
				character.proficiencies[type] = [];
			}
		}

		if (!character.proficiencySources) {
			character.proficiencySources = {};
		}
		for (const type of types) {
			if (!character.proficiencySources[type]) {
				character.proficiencySources[type] = new Map();
			}
		}

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
			} else {
				const prof = character.optionalProficiencies[type];
				if (prof.allowed === undefined) prof.allowed = 0;
				if (!prof.options) prof.options = [];
				if (!prof.selected) prof.selected = [];

				for (const source of ['race', 'class', 'background']) {
					if (!prof[source]) {
						prof[source] = { allowed: 0, options: [], selected: [] };
					} else {
						if (prof[source].allowed === undefined) prof[source].allowed = 0;
						if (!prof[source].options) prof[source].options = [];
						if (!prof[source].selected) prof[source].selected = [];
					}
				}
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
