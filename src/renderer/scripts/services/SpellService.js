/**
 * SpellService module
 *
 * Provides methods to load, access, and query spell data for the character builder.
 * Handles spell data initialization, lookup, and filtering by name, level, and class.
 */

import { DataLoader } from '../utils/DataLoader.js';
import DataNormalizer from '../utils/DataNormalizer.js';
import { EVENTS } from '../utils/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

/**
 * Manages spell data and provides access to spells.
 * @class
 */
class SpellService extends BaseDataService {
	/**
	 * Create a new SpellService.
	 */
	constructor() {
		super({ loadEvent: EVENTS.SPELLS_LOADED, loggerScope: 'SpellService' });
		this._spellLookupMap = null; // Map for O(1) lookups by name
		this._spellClassLookup = null; // Lookup for spell-to-class associations
	}

	/**
	 * Initialize spell data by loading from DataLoader.
	 * Loads all spell files and builds a lookup map for fast access.
	 * Emits SPELLS_LOADED event on success.
	 * @returns {Promise<boolean>} True if initialization succeeded
	 */
	async initialize() {
		await this.initWithLoader(
			async () => {
				const [index, classLookup] = await Promise.all([
					DataLoader.loadJSON('spells/index.json'),
					DataLoader.loadJSON('generated/gendata-spell-source-lookup.json'),
				]);

				const spellFiles = Object.values(index);
				const allSpells = await Promise.allSettled(
					spellFiles.map((file) => DataLoader.loadJSON(`spells/${file}`)),
				);

				const aggregated = { spell: [] };
				for (const result of allSpells) {
					if (result.status === 'fulfilled') {
						const spellData = result.value;
						if (spellData.spell && Array.isArray(spellData.spell)) {
							aggregated.spell.push(...spellData.spell);
						}
					} else {
						console.warn(
							'SpellService',
							'Failed to load spell file:',
							result.reason?.message,
						);
					}
				}

				aggregated.classLookup = classLookup;
				return aggregated;
			},
			{
				onLoaded: (data) => {
					this._spellLookupMap = this._buildLookupMap(data?.spell);
					this._spellClassLookup = data?.classLookup || {};
				},
				emitPayload: (data) => data?.spell || [],
				onError: () => {
					this._spellLookupMap = new Map();
					this._spellClassLookup = {};
					return { spell: [] };
				},
			},
		);

		return true;
	}

	_buildLookupMap(spells = []) {
		const map = new Map();
		for (const spell of spells) {
			if (!spell?.name) continue;
			const key = DataNormalizer.normalizeForLookup(spell.name);
			map.set(key, spell);
		}
		return map;
	}

	/**
	 * Get all available spells.
	 * @returns {Array<Object>} Array of spell objects
	 */
	getAllSpells() {
		return this._data?.spell || [];
	}

	/**
	 * Get a specific spell by name and source.
	 * Performs O(1) lookup by name, then checks source.
	 * @param {string} name - Spell name
	 * @param {string} [source='PHB'] - Source book
	 * @returns {Object|null} Spell object or null if not found
	 */
	getSpell(name, source = 'PHB') {
		if (!this._spellLookupMap) return null;

		// O(1) lookup by name (case-insensitive)
		const spell = this._spellLookupMap.get(
			DataNormalizer.normalizeForLookup(name),
		);

		// If source matters, verify it matches
		if (spell && spell.source === source) {
			return spell;
		}

		// If source doesn't match, fall back to linear search for source-specific spell
		if (spell && spell.source !== source && this._data?.spell) {
			return (
				this._data.spell.find((s) => s.name === name && s.source === source) ||
				spell
			); // Return any match if exact source not found
		}

		return spell || null;
	}

	/**
	 * Get spells by level.
	 * @param {number} level - Spell level (0-9)
	 * @returns {Array<Object>} Array of spell objects
	 */
	getSpellsByLevel(level) {
		if (!this._data?.spell) return [];

		return this._data.spell.filter((s) => s.level === level);
	}

	/**
	 * Check if a spell is available for a specific class.
	 * Uses the generated spell-class lookup data.
	 * @param {Object} spell - Spell object with name and source
	 * @param {string} className - Class name (e.g., "Wizard", "Cleric")
	 * @returns {boolean} True if spell is available for the class
	 */
	isSpellAvailableForClass(spell, className) {
		if (!this._spellClassLookup || !spell?.name || !spell?.source) {
			return false;
		}

		const spellSource = spell.source.toLowerCase();
		const spellName = spell.name.toLowerCase();

		// Check if source exists in lookup
		if (!this._spellClassLookup[spellSource]) {
			return false;
		}

		// Check if spell exists in that source
		const spellEntry = this._spellClassLookup[spellSource][spellName];
		if (!spellEntry?.class) {
			return false;
		}

		// Check if className appears in any of the class sources
		for (const classSource of Object.keys(spellEntry.class)) {
			if (spellEntry.class[classSource][className]) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get spells by class.
	 * @param {string} className - Class name
	 * @returns {Array<Object>} Array of spell objects
	 */
	getSpellsByClass(className) {
		if (!this._data?.spell) return [];

		return this._data.spell.filter((s) => this.isSpellAvailableForClass(s, className));
	}
}

/**
 * Global SpellService instance
 * @type {SpellService}
 */
export const spellService = new SpellService();
