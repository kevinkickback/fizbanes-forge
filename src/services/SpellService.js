import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { EVENTS } from '../lib/EventBus.js';
import { spellIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class SpellService extends BaseDataService {
	constructor() {
		super({ loadEvent: EVENTS.SPELLS_LOADED, loggerScope: 'SpellService' });
		this._spellLookupMap = null; // Map for O(1) lookups by name
		this._spellClassLookup = null; // Lookup for spell-to-class associations
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const [index, classLookup] = await Promise.all([
					DataLoader.loadJSON('spells/index.json'),
					DataLoader.loadJSON('generated/gendata-spell-source-lookup.json'),
				]);

				const spellFiles = Object.values(index);
				const allSpells = await Promise.allSettled(
					spellFiles.map((file) =>
						DataLoader.loadJSON(`spells/${file}`),
					),
				);

				const aggregated = { spell: [] };
				const failedFiles = [];
				for (const result of allSpells) {
					if (result.status === 'fulfilled') {
						const spellData = result.value;
						if (spellData.spell && Array.isArray(spellData.spell)) {
							aggregated.spell.push(...spellData.spell);
						}
					} else {
						failedFiles.push(spellFiles[allSpells.indexOf(result)]);
						console.warn(
							'SpellService',
							'Failed to load spell file:',
							result.reason?.message,
						);
					}
				}

				if (failedFiles.length > 0) {
					console.warn('[SpellService]', `${failedFiles.length}/${spellFiles.length} spell files failed to load:`, failedFiles);
				}

				aggregated.classLookup = classLookup;
				return aggregated;
			},
			{
				onLoaded: (data) => {
					// Preserve multi-source variants under the same spell name
					this._spellLookupMap = this.buildLookupMap(data?.spell, {
						allowMultiple: true,
					});
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

	resetData() {
		super.resetData();
		this._spellLookupMap = null;
		this._spellClassLookup = null;
	}

	getAllSpells() {
		return this._data?.spell || [];
	}

	/**
	 * Batch O(1) lookup by name array.
	 * Returns a Map of name → spell (or null if not found).
	 */
	getSpells(names, source = 'PHB') {
		const results = new Map();
		if (!Array.isArray(names)) return results;
		for (const name of names) {
			const spell = this.lookupByNameAndSource(
				this._spellLookupMap,
				name,
				source,
			);
			results.set(name, spell || null);
		}
		return results;
	}

	/** O(1) lookup by name, then checks source.
	 * @param {string} name - Spell name
	 * @param {string} [source='PHB'] - Source book
	 * @returns {Object} Spell object
	 * @throws {NotFoundError} If spell is not found
	 */
	getSpell(name, source = 'PHB') {
		const validated = validateInput(
			spellIdentifierSchema,
			{ name, source },
			'Invalid spell identifier',
		);

		const spell = this.lookupByNameAndSource(
			this._spellLookupMap,
			validated.name,
			validated.source,
		);

		if (!spell) {
			throw new NotFoundError(
				'Spell',
				`${validated.name} (${validated.source})`,
			);
		}

		return spell;
	}

	isSpellAvailableForClass(spell, className) {
		if (!this._spellClassLookup || !spell?.name || !spell?.source) {
			return false;
		}

		const spellSource = spell.source.toLowerCase();
		const spellName = spell.name.toLowerCase();

		if (!this._spellClassLookup[spellSource]) {
			return false;
		}

		const spellEntry = this._spellClassLookup[spellSource][spellName];
		if (!spellEntry?.class) {
			return false;
		}

		for (const classSource of Object.keys(spellEntry.class)) {
			if (spellEntry.class[classSource][className]) {
				return true;
			}
		}

		return false;
	}
}

export const spellService = new SpellService();
