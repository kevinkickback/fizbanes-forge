/**
 * SpellService module
 *
 * Provides methods to load, access, and query spell data for the character builder.
 * Handles spell data initialization, lookup, and filtering by name, level, and class.
 *
 * @module SpellService
 */

import { DataLoader } from '../utils/DataLoader.js';
import DataNormalizer from '../utils/DataNormalizer.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';

/**
 * Manages spell data and provides access to spells.
 * @class
 */
class SpellService {
	/**
	 * Create a new SpellService.
	 */
	constructor() {
		this._spellData = null;
		this._spellLookupMap = null; // Map for O(1) lookups by name
	}

	/**
	 * Initialize spell data by loading from DataLoader.
	 * Loads all spell files and builds a lookup map for fast access.
	 * Emits SPELLS_LOADED event on success.
	 * @returns {Promise<boolean>} True if initialization succeeded
	 */
	async initialize() {
		// Skip if already initialized
		if (this._spellData) {
			return true;
		}

		try {
			// Load the index to get all spell files
			const index = await DataLoader.loadJSON('spells/index.json');

			// Load all spell files with individual error handling
			const spellFiles = Object.values(index);
			const allSpells = await Promise.allSettled(
				spellFiles.map((file) => DataLoader.loadJSON(`spells/${file}`)),
			);

			// Aggregate all spells into single object, handling failures gracefully
			const aggregated = { spell: [] };
			for (const result of allSpells) {
				if (result.status === 'fulfilled') {
					const spellData = result.value;
					if (spellData.spell && Array.isArray(spellData.spell)) {
						aggregated.spell.push(...spellData.spell);
					}
				} else {
					// Log individual file failures but continue loading others
					console.warn(
						'SpellService',
						'Failed to load spell file:',
						result.reason?.message,
					);
				}
			}

			this._spellData = aggregated;

			// Build lookup map for O(1) access by name (case-insensitive)
			this._spellLookupMap = new Map();
			for (const spell of aggregated.spell) {
				// Skip spells with missing names
				if (!spell.name) continue;
				const key = DataNormalizer.normalizeForLookup(spell.name);
				this._spellLookupMap.set(key, spell);
			}

			eventBus.emit(EVENTS.SPELLS_LOADED, this._spellData.spell);
			return true;
		} catch (error) {
			console.error('SpellService', 'Failed to initialize spell data:', error);
			this._spellData = { spell: [] };
			return false;
		}
	}

	/**
	 * Get all available spells.
	 * @returns {Array<Object>} Array of spell objects
	 */
	getAllSpells() {
		return this._spellData?.spell || [];
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
		if (spell && spell.source !== source && this._spellData?.spell) {
			return (
				this._spellData.spell.find(
					(s) => s.name === name && s.source === source,
				) || spell
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
		if (!this._spellData?.spell) return [];

		return this._spellData.spell.filter((s) => s.level === level);
	}

	/**
	 * Get spells by class.
	 * @param {string} className - Class name
	 * @returns {Array<Object>} Array of spell objects
	 */
	getSpellsByClass(className) {
		if (!this._spellData?.spell) return [];

		return this._spellData.spell.filter((s) => {
			if (!s.classes || !s.classes.fromClassList) return false;
			const target = DataNormalizer.normalizeForLookup(className);
			return s.classes.fromClassList.some(
				(c) => DataNormalizer.normalizeForLookup(c.name) === target,
			);
		});
	}
}

/**
 * Global SpellService instance
 * @type {SpellService}
 */
export const spellService = new SpellService();
