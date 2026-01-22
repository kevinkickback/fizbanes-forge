/** ReferenceResolver.js - Generic reference resolver via service dispatcher. */

import { actionService } from '../services/ActionService.js';
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { conditionService } from '../services/ConditionService.js';
import { featService } from '../services/FeatService.js';
import { itemService } from '../services/ItemService.js';
import { monsterService } from '../services/MonsterService.js';
import { optionalFeatureService } from '../services/OptionalFeatureService.js';
import { raceService } from '../services/RaceService.js';
import { skillService } from '../services/SkillService.js';
import { spellService } from '../services/SpellService.js';
import { variantRuleService } from '../services/VariantRuleService.js';

const typeServiceMap = {
	action: { service: actionService, method: 'getAction' },
	background: { service: backgroundService, method: 'getBackground' },
	class: { service: classService, method: 'getClass' },
	condition: { service: conditionService, method: 'getCondition' },
	feat: { service: featService, method: 'getFeat' },
	feature: { service: optionalFeatureService, method: 'getFeatureByName' },
	item: { service: itemService, method: 'getItem' },
	creature: { service: monsterService, method: 'getMonster' },
	monster: { service: monsterService, method: 'getMonster' },
	race: { service: raceService, method: 'getRace' },
	skill: { service: skillService, method: 'getSkill' },
	spell: { service: spellService, method: 'getSpell' },
	variantrule: { service: variantRuleService, method: 'getVariantRule' },
};

export async function resolve(type, name, source = 'PHB') {
	const config = typeServiceMap[type];

	if (!config) {
		console.warn('[ReferenceResolver]', `Unknown reference type: ${type}`);
		return { name, error: `Unknown reference type: ${type}` };
	}

	try {
		const { service, method } = config;
		const getter = service[method];

		if (!getter || typeof getter !== 'function') {
			console.warn(
				'[ReferenceResolver]',
				`Service for ${type} does not have ${method} method`,
			);
			return { name, error: `Cannot resolve ${type}` };
		}

		// Call the getter method
		const data = getter.call(service, name, source);

		if (!data) {
			return { name, error: `${type} not found` };
		}

		return data;
	} catch (error) {
		console.error(
			'[ReferenceResolver]',
			`Error resolving ${type} "${name}":`,
			error,
		);
		return { name, error: error.message };
	}
}

async function resolveWithoutSource(type, name) {
	return resolve(type, name, null);
}

export const referenceResolver = {
	resolve,
	resolveSpell: (name, source) => resolve('spell', name, source),
	resolveItem: (name, source) => resolve('item', name, source),
	resolveCondition: (name) => resolveWithoutSource('condition', name),
	resolveMonster: (name, source) => resolve('monster', name, source),
	resolveClass: (name, source) => resolve('class', name, source),
	resolveRace: (name, source) => resolve('race', name, source),
	resolveFeat: (name, source) => resolve('feat', name, source),
	resolveBackground: (name, source) => resolve('background', name, source),
	resolveSkill: (name) => resolveWithoutSource('skill', name),
	resolveAction: (name, source) => resolve('action', name, source),
	resolveOptionalFeature: (name) =>
		resolveWithoutSource('optionalfeature', name),
	resolveReward: (name) => resolveWithoutSource('reward', name),
	resolveTrap: (name) => resolveWithoutSource('trap', name),
	resolveVehicle: (name) => resolveWithoutSource('vehicle', name),
	resolveObject: (name) => resolveWithoutSource('object', name),
	resolveVariantRule: (name) => resolveWithoutSource('variantrule', name),
};

export function getReferenceResolver() {
	return referenceResolver;
}

// Proxy exports for backward compatibility
export const resolveAction = (name, source) =>
	referenceResolver.resolveAction(name, source);
export const resolveBackground = (name, source) =>
	referenceResolver.resolveBackground(name, source);
export const resolveClass = (name, source) =>
	referenceResolver.resolveClass(name, source);
export const resolveCondition = (name) =>
	referenceResolver.resolveCondition(name);
export const resolveFeat = (name, source) =>
	referenceResolver.resolveFeat(name, source);
export const resolveItem = (name, source) =>
	referenceResolver.resolveItem(name, source);
export const resolveMonster = (name, source) =>
	referenceResolver.resolveMonster(name, source);
export const resolveObject = (name) => referenceResolver.resolveObject(name);
export const resolveOptionalFeature = (name) =>
	referenceResolver.resolveOptionalFeature(name);
export const resolveRace = (name, source) =>
	referenceResolver.resolveRace(name, source);
export const resolveReward = (name) => referenceResolver.resolveReward(name);
export const resolveSkill = (name) => referenceResolver.resolveSkill(name);
export const resolveSpell = (name, source) =>
	referenceResolver.resolveSpell(name, source);
export const resolveTrap = (name) => referenceResolver.resolveTrap(name);
export const resolveVariantRule = (name) =>
	referenceResolver.resolveVariantRule(name);
export const resolveVehicle = (name) => referenceResolver.resolveVehicle(name);
