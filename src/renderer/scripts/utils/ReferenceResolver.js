/**
 * ReferenceResolver.js
 * Resolves tag references to actual D&D game data
 * Uses managers for all entity types
 */

import { Logger } from '../infrastructure/Logger.js';
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { itemService } from '../services/ItemService.js';
import { raceService } from '../services/RaceService.js';
import { spellService } from '../services/SpellService.js';
import { DataLoader } from './DataLoader.js';

/**
 * Reference resolver - resolves tags to actual content
 */
export class ReferenceResolver {
	constructor() {
		this._dataUtil = DataLoader.getInstance();
		this._classManager = classService;
		this._raceManager = raceService;
		this._backgroundManager = backgroundService;
		this._spellManager = spellService;
		this._itemManager = itemService;
	}

	/**
	 * Resolve a spell reference
	 * @param {string} spellName Spell name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Spell data
	 */
	async resolveSpell(spellName, _source = 'PHB') {
		try {
			const allSpells = this._spellManager.getAllSpells();
			const spell = allSpells?.find(
				(s) => s.name.toLowerCase() === spellName.toLowerCase(),
			);

			if (!spell) {
				return {
					name: spellName,
					error: 'Spell not found',
				};
			}

			return spell;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving spell "${spellName}":`,
				error,
			);
			return { name: spellName, error: error.message };
		}
	}

	/**
	 * Resolve an item reference
	 * @param {string} itemName Item name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Item data
	 */
	async resolveItem(itemName, _source = 'PHB') {
		try {
			const allItems = this._itemManager.getAllItems();
			const allBaseItems = this._itemManager.getAllBaseItems();

			// Try regular items first
			let item = allItems?.find(
				(i) => i.name.toLowerCase() === itemName.toLowerCase(),
			);

			// If not found, try base items (weapons, armor, etc)
			if (!item && allBaseItems) {
				item = allBaseItems.find(
					(i) => i.name.toLowerCase() === itemName.toLowerCase(),
				);
			}

			if (!item) {
				return {
					name: itemName,
					error: 'Item not found',
				};
			}

			return item;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving item "${itemName}":`,
				error,
			);
			return { name: itemName, error: error.message };
		}
	}

	/**
	 * Resolve a condition reference
	 * @param {string} conditionName Condition name
	 * @returns {Promise<Object>} Condition data
	 */
	async resolveCondition(conditionName) {
		try {
			const data = await this._dataUtil.loadConditions();
			const condition = data.condition?.find(
				(c) => c.name.toLowerCase() === conditionName.toLowerCase(),
			);

			if (!condition) {
				return {
					name: conditionName,
					error: 'Condition not found',
				};
			}

			return condition;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving condition "${conditionName}":`,
				error,
			);
			return { name: conditionName, error: error.message };
		}
	}

	/**
	 * Resolve a monster reference
	 * @param {string} monsterName Monster name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Monster data
	 */
	async resolveMonster(monsterName, _source = 'MM') {
		try {
			const data = await this._dataUtil.loadMonsters();
			const monster = data.monster?.find(
				(m) => m.name.toLowerCase() === monsterName.toLowerCase(),
			);

			if (!monster) {
				return {
					name: monsterName,
					error: 'Monster not found',
				};
			}

			return monster;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving monster "${monsterName}":`,
				error,
			);
			return { name: monsterName, error: error.message };
		}
	}

	/**
	 * Resolve a class reference
	 * @param {string} className Class name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Class data
	 */
	async resolveClass(className, _source = 'PHB') {
		try {
			const allClasses = this._classManager.getAllClasses();
			const classData = allClasses?.find(
				(c) => c.name.toLowerCase() === className.toLowerCase(),
			);

			if (!classData) {
				return {
					name: className,
					error: 'Class not found',
				};
			}

			return classData;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving class "${className}":`,
				error,
			);
			return { name: className, error: error.message };
		}
	}

	/**
	 * Resolve a race reference
	 * @param {string} raceName Race name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Race data
	 */
	async resolveRace(raceName, _source = 'PHB') {
		try {
			const allRaces = this._raceManager.getAllRaces();
			const race = allRaces?.find(
				(r) => r.name.toLowerCase() === raceName.toLowerCase(),
			);

			if (!race) {
				return {
					name: raceName,
					error: 'Race not found',
				};
			}

			return race;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving race "${raceName}":`,
				error,
			);
			return { name: raceName, error: error.message };
		}
	}

	/**
	 * Resolve a feat reference
	 * @param {string} featName Feat name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Feat data
	 */
	async resolveFeat(featName, _source = 'PHB') {
		try {
			const data = await this._dataUtil.loadFeats();
			const feat = data.feat?.find(
				(f) => f.name.toLowerCase() === featName.toLowerCase(),
			);

			if (!feat) {
				return {
					name: featName,
					error: 'Feat not found',
				};
			}

			return feat;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving feat "${featName}":`,
				error,
			);
			return { name: featName, error: error.message };
		}
	}

	/**
	 * Resolve a background reference
	 * @param {string} backgroundName Background name
	 * @param {string} _source Source abbreviation
	 * @returns {Promise<Object>} Background data
	 */
	async resolveBackground(backgroundName, _source = 'PHB') {
		try {
			const allBackgrounds = this._backgroundManager.getAllBackgrounds();
			const background = allBackgrounds?.find(
				(b) => b.name.toLowerCase() === backgroundName.toLowerCase(),
			);

			if (!background) {
				return {
					name: backgroundName,
					error: 'Background not found',
				};
			}

			return background;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving background "${backgroundName}":`,
				error,
			);
			return { name: backgroundName, error: error.message };
		}
	}

	/**
	 * Resolve a skill reference
	 * @param {string} skillName Skill name
	 * @returns {Promise<Object>} Skill data
	 */
	async resolveSkill(skillName) {
		try {
			const data = await this._dataUtil.loadSkills();
			const skill = data.skill?.find(
				(s) => s.name.toLowerCase() === skillName.toLowerCase(),
			);

			if (!skill) {
				return {
					name: skillName,
					error: 'Skill not found',
				};
			}

			return skill;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving skill "${skillName}":`,
				error,
			);
			return { name: skillName, error: error.message };
		}
	}

	/**
	 * Resolve an action reference
	 * @param {string} actionName Action name
	 * @returns {Promise<Object>} Action data
	 */
	async resolveAction(actionName) {
		try {
			const data = await this._dataUtil.loadActions();
			const action = data.action?.find(
				(a) => a.name.toLowerCase() === actionName.toLowerCase(),
			);

			if (!action) {
				return {
					name: actionName,
					error: 'Action not found',
				};
			}

			return action;
		} catch (error) {
			Logger.error(
				'ReferenceResolver',
				`Error resolving action "${actionName}":`,
				error,
			);
			return { name: actionName, error: error.message };
		}
	}
}

// Singleton instance
let _referenceResolverInstance = null;

export function getReferenceResolver() {
	if (!_referenceResolverInstance) {
		_referenceResolverInstance = new ReferenceResolver();
	}
	return _referenceResolverInstance;
}
