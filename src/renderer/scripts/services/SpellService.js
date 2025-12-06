/**
 * SpellManager.js
 * Manages spell data and operations for the character builder
 */

import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/**
 * Manages spell data and provides access to spells
 */
class SpellService {
	/**
	 * Initialize a new SpellManager
	 */
	constructor() {
		this._spellData = null;
	}

	/**
	 * Initialize spell data by loading from DataLoader
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
				spellFiles.map((file) =>
					DataLoader.loadJSON(`spells/${file}`),
				),
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
					Logger.warn('SpellService', 'Failed to load spell file:', result.reason?.message);
				}
			}

			this._spellData = aggregated;
			eventBus.emit(EVENTS.SPELLS_LOADED, this._spellData.spell);
			return true;
		} catch (error) {
			Logger.error('SpellService', 'Failed to initialize spell data:', error);
			this._spellData = { spell: [] };
			return false;
		}
	}

	/**
	 * Get all available spells
	 * @returns {Array<Object>} Array of spell objects
	 */
	getAllSpells() {
		return this._spellData?.spell || [];
	}

	/**
	 * Get a specific spell by name and source
	 * @param {string} name - Spell name
	 * @param {string} source - Source book
	 * @returns {Object|null} Spell object or null if not found
	 */
	getSpell(name, source = 'PHB') {
		if (!this._spellData?.spell) return null;

		return (
			this._spellData.spell.find(
				(s) => s.name === name && s.source === source,
			) || null
		);
	}

	/**
	 * Get spells by level
	 * @param {number} level - Spell level (0-9)
	 * @returns {Array<Object>} Array of spell objects
	 */
	getSpellsByLevel(level) {
		if (!this._spellData?.spell) return [];

		return this._spellData.spell.filter((s) => s.level === level);
	}

	/**
	 * Get spells by class
	 * @param {string} className - Class name
	 * @returns {Array<Object>} Array of spell objects
	 */
	getSpellsByClass(className) {
		if (!this._spellData?.spell) return [];

		return this._spellData.spell.filter((s) => {
			if (!s.classes || !s.classes.fromClassList) return false;
			return s.classes.fromClassList.some(
				(c) => c.name.toLowerCase() === className.toLowerCase(),
			);
		});
	}
}

/**
 * Global SpellManager instance
 */
export const spellService = new SpellService();
