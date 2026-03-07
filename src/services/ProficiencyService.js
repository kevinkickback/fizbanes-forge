import { toSentenceCase } from '../lib/5eToolsParser.js';
import { ValidationError } from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import TextProcessor from '../lib/TextProcessor.js';
import {
	addProficiencyArgsSchema,
	removeProficienciesBySourceArgsSchema,
	validateInput
} from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

export class ProficiencyService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'ProficiencyService' });
	}

	dispose() {
		super.dispose();
	}

	resetData() {
		super.resetData();
	}



	/**
	 * Adds a proficiency to a character
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type (armor, weapons, tools, skills, languages, savingThrows)
	 * @param {string} proficiency - The proficiency name
	 * @param {string} source - The source of the proficiency
	 * @returns {boolean} Whether the proficiency was newly added
	 */
	addProficiency(character, type, proficiency, source) {
		const validated = validateInput(
			addProficiencyArgsSchema,
			{ character, type, proficiency, source },
			'Invalid parameters for addProficiency'
		);

		const { character: char, type: profType, proficiency: profName, source: profSource } = validated;

		if (!char.proficiencies) char.proficiencies = {};
		if (!char.proficiencies[profType]) char.proficiencies[profType] = [];
		if (!char.proficiencySources) char.proficiencySources = {};
		if (!char.proficiencySources[profType])
			char.proficiencySources[profType] = new Map();

		const normalizedTarget = TextProcessor.normalizeForLookup(profName);
		const existingProf = char.proficiencies[profType].find(
			(p) => TextProcessor.normalizeForLookup(p) === normalizedTarget,
		);

		const wasNew = !existingProf;
		if (wasNew) {
			char.proficiencies[profType].push(profName);
		}

		const trackKey = existingProf || profName;
		if (!char.proficiencySources[profType].has(trackKey)) {
			char.proficiencySources[profType].set(trackKey, new Set());
		}
		char.proficiencySources[profType].get(trackKey).add(profSource);

		if (profType === 'skills' && !profSource.includes('Choice')) {
			this._refundOptionalSkill(char, profName, profSource);
		}

		eventBus.emit(EVENTS.PROFICIENCY_ADDED, {
			type: profType,
			proficiency: profName,
			source: profSource,
			character: char,
		});

		return wasNew;
	}

	/**
	 * Removes all proficiencies from a character that came from a specific source
	 * @param {Object} character - The character object
	 * @param {string} source - The source to remove proficiencies from
	 * @returns {Object} Object with arrays of removed proficiencies by type
	 */
	removeProficienciesBySource(character, source) {
		const validated = validateInput(
			removeProficienciesBySourceArgsSchema,
			{ character, source },
			'Invalid parameters for removeProficienciesBySource'
		);

		const { character: char, source: profSource } = validated;
		const removed = {};

		if (!char.proficiencySources) {
			return removed;
		}

		for (const type in char.proficiencySources) {
			removed[type] = [];

			for (const [proficiency, sources] of char.proficiencySources[
				type
			].entries()) {
				if (sources.has(profSource)) {
					sources.delete(profSource);
					removed[type].push(proficiency);

					if (sources.size === 0) {
						char.proficiencySources[type].delete(proficiency);

						if (char.proficiencies[type]) {
							const index = char.proficiencies[type].indexOf(proficiency);
							if (index !== -1) {
								char.proficiencies[type].splice(index, 1);
							}
						}
					}
				}
			}
		}

		eventBus.emit(EVENTS.PROFICIENCY_REMOVED_BY_SOURCE, {
			source: profSource,
			removed,
			character: char,
		});

		return removed;
	}

	getProficiencySources(character, type, proficiency) {
		return character?.proficiencySources?.[type]?.get(proficiency) || new Set();
	}

	setOptionalProficiencies(character, type, source, allowed, options) {
		if (!character || !type || !source) {
			throw new ValidationError('Invalid parameters for setOptionalProficiencies: character, type, and source are required');
		}

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

		const sourceKey = TextProcessor.normalizeForLookup(source);
		if (!character.optionalProficiencies[type][sourceKey]) {
			character.optionalProficiencies[type][sourceKey] = {
				allowed: 0,
				options: [],
				selected: [],
			};
		}

		character.optionalProficiencies[type][sourceKey].allowed = allowed;
		character.optionalProficiencies[type][sourceKey].options = [...options];

		this._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CONFIGURED, {
			type,
			source: sourceKey,
			allowed,
			options,
			character,
		});
	}

	initializeProficiencyStructures(character) {
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

		if (character.proficiencies.languages.length === 0) {
			this.addProficiency(
				character,
				'languages',
				'Common',
				'Default',
			);
		}
	}

	_recalculateOptionalProficiencies(character, type) {
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

	_refundOptionalSkill(character, proficiency, newSource) {
		if (!character?.optionalProficiencies?.skills) {
			return;
		}

		const normalizedProf = TextProcessor.normalizeForLookup(proficiency);
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
				(s) => TextProcessor.normalizeForLookup(s) === normalizedProf,
			);

			if (matchingProf) {
				const index = config.selected.indexOf(matchingProf);
				config.selected.splice(index, 1);

				this._removeProficiencyFromSource(
					character,
					'skills',
					matchingProf,
					`${toSentenceCase(source)} Choice`,
				);

				refunded = true;
			}
		}

		if (refunded) {
			this._recalculateOptionalProficiencies(character, 'skills');

			eventBus.emit(EVENTS.PROFICIENCY_REFUNDED, {
				type: 'skills',
				proficiency,
				character,
			});
		}
	}

	_removeProficiencyFromSource(character, type, proficiency, source) {
		if (!character?.proficiencySources?.[type]) {
			return;
		}

		const targetLower = TextProcessor.normalizeForLookup(proficiency);
		let foundProf = null;

		for (const [key] of character.proficiencySources[type]) {
			if (TextProcessor.normalizeForLookup(key) === targetLower) {
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
					(p) => TextProcessor.normalizeForLookup(p) === targetLower,
				);
				if (index > -1) {
					character.proficiencies[type].splice(index, 1);
				}
			}
		}
	}
}

export const proficiencyService = new ProficiencyService();
