/** ReferenceResolver.js - Resolves tag references to concrete D&D data via services (plain module). */

import { actionService } from '../services/ActionService.js';
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { conditionService } from '../services/ConditionService.js';
import { featService } from '../services/FeatService.js';
import { itemService } from '../services/ItemService.js';
import { monsterService } from '../services/MonsterService.js';
import { raceService } from '../services/RaceService.js';
import { skillService } from '../services/SkillService.js';
import { spellService } from '../services/SpellService.js';
import { variantRuleService } from '../services/VariantRuleService.js';
import { dataLoader } from './DataLoader.js';
import DataNormalizer from './DataNormalizer.js';

const resolverDeps = {
	data: dataLoader,
	classSvc: classService,
	raceSvc: raceService,
	backgroundSvc: backgroundService,
	spellSvc: spellService,
	itemSvc: itemService,
	conditionSvc: conditionService,
	monsterSvc: monsterService,
	featSvc: featService,
	skillSvc: skillService,
	actionSvc: actionService,
	variantRuleSvc: variantRuleService,
};

/** Core resolver implementations (exported for direct use). */
async function resolveSpell(spellName, source = 'PHB') {
	try {
		const spell = resolverDeps.spellSvc.getSpell(spellName, source);
		if (!spell) return { name: spellName, error: 'Spell not found' };
		return spell;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving spell "${spellName}":`, error);
		return { name: spellName, error: error.message };
	}
}

async function resolveItem(itemName, source = 'DMG') {
	try {
		let item = resolverDeps.itemSvc.getItem(itemName, source);
		if (!item) item = resolverDeps.itemSvc.getBaseItem(itemName, 'PHB');
		if (!item) return { name: itemName, error: 'Item not found' };
		return item;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving item "${itemName}":`, error);
		return { name: itemName, error: error.message };
	}
}

async function resolveCondition(conditionName) {
	try {
		const condition = resolverDeps.conditionSvc.getCondition(conditionName);
		if (!condition) return { name: conditionName, error: 'Condition not found' };
		return condition;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving condition "${conditionName}":`, error);
		return { name: conditionName, error: error.message };
	}
}

/**
 * Resolve a monster reference
 * @param {string} monsterName Monster name
 * @param {string} _source Source abbreviation
 * @returns {Promise<Object>} Monster data
 */
async function resolveMonster(monsterName, _source = 'MM') {
	try {
		const monster = resolverDeps.monsterSvc.getMonster(monsterName);
		if (!monster) return { name: monsterName, error: 'Monster not found' };
		return monster;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving monster "${monsterName}":`, error);
		return { name: monsterName, error: error.message };
	}
}

/**
 * Resolve a class reference
 * @param {string} className Class name
 * @param {string} _source Source abbreviation
 * @returns {Promise<Object>} Class data
 */
async function resolveClass(className, _source = 'PHB') {
	try {
		const allClasses = resolverDeps.classSvc.getAllClasses();
		const target = DataNormalizer.normalizeForLookup(className);
		const classData = allClasses?.find(
			(c) => DataNormalizer.normalizeForLookup(c.name) === target,
		);
		if (!classData) return { name: className, error: 'Class not found' };
		return classData;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving class "${className}":`, error);
		return { name: className, error: error.message };
	}
}

/**
 * Resolve a race reference
 * @param {string} raceName Race name
 * @param {string} source Source abbreviation
 * @returns {Promise<Object>} Race data
 */
async function resolveRace(raceName, source = 'PHB') {
	try {
		const race = resolverDeps.raceSvc.getRace(raceName, source);
		if (!race) return { name: raceName, error: 'Race not found' };
		return race;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving race "${raceName}":`, error);
		return { name: raceName, error: error.message };
	}
}

/**
 * Resolve a feat reference
 * @param {string} featName Feat name
 * @param {string} _source Source abbreviation
 * @returns {Promise<Object>} Feat data
 */
async function resolveFeat(featName, _source = 'PHB') {
	try {
		const feat = resolverDeps.featSvc.getFeat(featName);
		if (!feat) return { name: featName, error: 'Feat not found' };
		return feat;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving feat "${featName}":`, error);
		return { name: featName, error: error.message };
	}
}

/**
 * Resolve a background reference
 * @param {string} backgroundName Background name
 * @param {string} _source Source abbreviation
 * @returns {Promise<Object>} Background data
 */
async function resolveBackground(backgroundName, _source = 'PHB') {
	try {
		const allBackgrounds = resolverDeps.backgroundSvc.getAllBackgrounds();
		const target = DataNormalizer.normalizeForLookup(backgroundName);
		const background = allBackgrounds?.find(
			(b) => DataNormalizer.normalizeForLookup(b.name) === target,
		);
		if (!background) return { name: backgroundName, error: 'Background not found' };
		return background;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving background "${backgroundName}":`, error);
		return { name: backgroundName, error: error.message };
	}
}

/**
 * Resolve a skill reference
 * @param {string} skillName Skill name
 * @returns {Promise<Object>} Skill data
 */
async function resolveSkill(skillName) {
	try {
		const skill = resolverDeps.skillSvc.getSkill(skillName);
		if (!skill) return { name: skillName, error: 'Skill not found' };
		return skill;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving skill "${skillName}":`, error);
		return { name: skillName, error: error.message };
	}
}

/**
 * Resolve an action reference
 * @param {string} actionName Action name
 * @returns {Promise<Object>} Action data
 */
async function resolveAction(actionName) {
	try {
		const action = resolverDeps.actionSvc.getAction(actionName);
		if (!action) return { name: actionName, error: 'Action not found' };
		return action;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving action "${actionName}":`, error);
		return { name: actionName, error: error.message };
	}
}

/**
 * Resolve an optional feature reference
 * @param {string} featureName Feature name
 * @returns {Promise<Object>} Feature data
 */
async function resolveOptionalFeature(featureName) {
	try {
		const data = await resolverDeps.data.loadOptionalFeatures();
		const target = DataNormalizer.normalizeForLookup(featureName);
		const feature = data.optionalfeature?.find(
			(f) => DataNormalizer.normalizeForLookup(f.name) === target,
		);
		if (!feature) return { name: featureName, error: 'Optional feature not found' };
		return feature;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving optional feature "${featureName}":`, error);
		return { name: featureName, error: error.message };
	}
}

/**
 * Resolve a reward reference
 * @param {string} rewardName Reward name
 * @returns {Promise<Object>} Reward data
 */
async function resolveReward(rewardName) {
	try {
		const data = await resolverDeps.data.loadRewards();
		const target = DataNormalizer.normalizeForLookup(rewardName);
		const reward = data.reward?.find(
			(r) => DataNormalizer.normalizeForLookup(r.name) === target,
		);
		if (!reward) return { name: rewardName, error: 'Reward not found' };
		return reward;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving reward "${rewardName}":`, error);
		return { name: rewardName, error: error.message };
	}
}

/**
 * Resolve a trap/hazard reference
 * @param {string} trapName Trap/hazard name
 * @returns {Promise<Object>} Trap data
 */
async function resolveTrap(trapName) {
	try {
		const data = await resolverDeps.data.loadTrapsHazards();
		const target = DataNormalizer.normalizeForLookup(trapName);
		const trap = data.trap?.find(
			(t) => DataNormalizer.normalizeForLookup(t.name) === target,
		);
		if (!trap) return { name: trapName, error: 'Trap/hazard not found' };
		return trap;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving trap "${trapName}":`, error);
		return { name: trapName, error: error.message };
	}
}

/**
 * Resolve a vehicle reference
 * @param {string} vehicleName Vehicle name
 * @returns {Promise<Object>} Vehicle data
 */
async function resolveVehicle(vehicleName) {
	try {
		const data = await resolverDeps.data.loadVehicles();
		const target = DataNormalizer.normalizeForLookup(vehicleName);
		const vehicle = data.vehicle?.find(
			(v) => DataNormalizer.normalizeForLookup(v.name) === target,
		);
		if (!vehicle) return { name: vehicleName, error: 'Vehicle not found' };
		return vehicle;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving vehicle "${vehicleName}":`, error);
		return { name: vehicleName, error: error.message };
	}
}

/**
 * Resolve an object reference
 * @param {string} objectName Object name
 * @returns {Promise<Object>} Object data
 */
async function resolveObject(objectName) {
	try {
		const data = await resolverDeps.data.loadObjects();
		const target = DataNormalizer.normalizeForLookup(objectName);
		const obj = data.object?.find(
			(o) => DataNormalizer.normalizeForLookup(o.name) === target,
		);
		if (!obj) return { name: objectName, error: 'Object not found' };
		return obj;
	} catch (error) {
		console.error('[ReferenceResolver]', `Error resolving object "${objectName}":`, error);
		return { name: objectName, error: error.message };
	}
}

/**
 * Resolve a variant rule reference
 * @param {string} ruleName Variant rule name
 * @returns {Promise<Object>} Variant rule data
 */
async function resolveVariantRule(ruleName) {
	try {
		const rule = resolverDeps.variantRuleSvc.getVariantRule(ruleName);
		if (!rule) return { name: ruleName, error: 'Variant rule not found' };
		return rule;
	} catch (error) {
		console.error('ReferenceResolver', `Error resolving variant rule "${ruleName}":`, error);
		return { name: ruleName, error: error.message };
	}
}

// Functional API
export const referenceResolver = {
	resolveSpell,
	resolveItem,
	resolveCondition,
	resolveMonster,
	resolveClass,
	resolveRace,
	resolveFeat,
	resolveBackground,
	resolveSkill,
	resolveAction,
	resolveOptionalFeature,
	resolveReward,
	resolveTrap,
	resolveVehicle,
	resolveObject,
	resolveVariantRule,
};

// Backwards-compatible accessor
const _referenceResolverInstance = referenceResolver;
export function getReferenceResolver() {
	return _referenceResolverInstance;
}

export {
	resolveAction, resolveBackground, resolveClass, resolveCondition, resolveFeat, resolveItem, resolveMonster, resolveObject, resolveOptionalFeature, resolveRace, resolveReward, resolveSkill, resolveSpell, resolveTrap, resolveVariantRule,
	resolveVehicle
};
