/** Manages spell data and provides access to spells. */
import { DataLoader } from '../lib/DataLoader.js';
import { EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

class SpellService extends BaseDataService {
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
					DataLoader.loadJSON('spells/index.json', { ttl: 24 * 60 * 60 * 1000 }),
					DataLoader.loadJSON('generated/gendata-spell-source-lookup.json', { ttl: 24 * 60 * 60 * 1000 }),
				]);

				const spellFiles = Object.values(index);
				const allSpells = await Promise.allSettled(
					spellFiles.map((file) => DataLoader.loadJSON(`spells/${file}`, { ttl: 24 * 60 * 60 * 1000 })),
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
					// Preserve multi-source variants under the same spell name
					this._spellLookupMap = this.buildLookupMap(data?.spell, { allowMultiple: true });
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
		return this.lookupByNameAndSource(this._spellLookupMap, name, source);
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
