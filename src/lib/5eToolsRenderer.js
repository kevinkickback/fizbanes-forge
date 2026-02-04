import { DEFAULT_SOURCE } from './5eToolsParser.js';

function escapeHtml(text) {
	if (!text) return '';
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

function splitTagByPipe(text) {
	return text.split('|').map((s) => s.trim());
}

const tagHandlers = {};

export function registerTagHandler(tag, handler) {
	tagHandlers[tag] = handler;
}

export function renderTag(tag, content) {
	const handler = tagHandlers[tag];
	if (!handler) {
		console.warn('[Renderer5etools Unknown tag:]', tag);
		return escapeHtml(content.split('|')[0]);
	}
	return handler(content);
}

export function renderStringWithTags(text) {
	if (!text) return '';

	// Match {@tagType content} patterns
	const tagPattern = /{@(\w+)\s+([^}]+)}/g;
	let result = text;

	const matches = Array.from(text.matchAll(tagPattern));
	for (const match of matches) {
		const tagType = match[1];
		const tagContent = match[2];
		const rendered = renderTag(tagType, tagContent);
		result = result.replace(match[0], rendered);
	}

	return result;
}

function initializeDefaultHandlers() {
	// Class reference
	registerTagHandler('class', (text) => {
		const parts = splitTagByPipe(text);
		const className = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__class-link rd__hover-link" data-hover-type="class" data-hover-name="${className}" data-hover-source="${source}">${className}</a>`;
	});

	// Race reference
	registerTagHandler('race', (text) => {
		const parts = splitTagByPipe(text);
		const raceName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__race-link rd__hover-link" data-hover-type="race" data-hover-name="${raceName}" data-hover-source="${source}">${raceName}</a>`;
	});

	// Background reference
	registerTagHandler('background', (text) => {
		const parts = splitTagByPipe(text);
		const bgName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__background-link rd__hover-link" data-hover-type="background" data-hover-name="${bgName}" data-hover-source="${source}">${bgName}</a>`;
	});

	// Feat reference
	registerTagHandler('feat', (text) => {
		const parts = splitTagByPipe(text);
		const featName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__feat-link rd__hover-link" data-hover-type="feat" data-hover-name="${featName}" data-hover-source="${source}">${featName}</a>`;
	});

	// Feature reference
	registerTagHandler('feature', (text) => {
		const parts = splitTagByPipe(text);
		const featureName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__feature-link rd__hover-link" data-hover-type="feature" data-hover-name="${featureName}" data-hover-source="${source}">${featureName}</a>`;
	});

	// Spell reference
	registerTagHandler('spell', (text) => {
		const parts = splitTagByPipe(text);
		const spellName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__spell-link rd__hover-link" data-hover-type="spell" data-hover-name="${spellName}" data-hover-source="${source}">${spellName}</a>`;
	});

	// Item reference
	registerTagHandler('item', (text) => {
		const parts = splitTagByPipe(text);
		const itemName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__item-link rd__hover-link" data-hover-type="item" data-hover-name="${itemName}" data-hover-source="${source}">${itemName}</a>`;
	});

	// Optional Feature reference
	registerTagHandler('optfeature', (text) => {
		const parts = splitTagByPipe(text);
		const featName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__optfeature-link rd__hover-link" data-hover-type="optfeature" data-hover-name="${featName}" data-hover-source="${source}">${featName}</a>`;
	});

	// Condition reference
	registerTagHandler('condition', (text) => {
		const parts = splitTagByPipe(text);
		const condName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__condition-link rd__hover-link" data-hover-type="condition" data-hover-name="${condName}" data-hover-source="${source}">${condName}</a>`;
	});

	// Skill reference (usually not a link, just formatted text)
	registerTagHandler('skill', (text) => {
		const parts = splitTagByPipe(text);
		const skillName = escapeHtml(parts[0]);
		return `<span class="rd__skill">${skillName}</span>`;
	});

	// Action reference
	registerTagHandler('action', (text) => {
		const parts = splitTagByPipe(text);
		const actionName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');
		return `<a class="rd__action-link rd__hover-link" data-hover-type="action" data-hover-name="${actionName}" data-hover-source="${source}">${actionName}</a>`;
	});

	// Note/emphasis tag
	registerTagHandler('note', (text) => {
		return `<span class="rd__note">${escapeHtml(text)}</span>`;
	});

	// Bold tag
	registerTagHandler('bold', (text) => {
		return `<strong>${escapeHtml(text)}</strong>`;
	});

	// Italic tag
	registerTagHandler('italic', (text) => {
		return `<em>${escapeHtml(text)}</em>`;
	});

	// Shorthand bold tag (same as 'bold')
	registerTagHandler('b', (text) => {
		return `<strong>${escapeHtml(text)}</strong>`;
	});

	// Shorthand italic tag (same as 'italic')
	registerTagHandler('i', (text) => {
		return `<em>${escapeHtml(text)}</em>`;
	});

	// Damage type reference
	registerTagHandler('damage', (text) => {
		const parts = splitTagByPipe(text);
		const damageType = escapeHtml(parts[0]);
		return `<span class="rd__damage-type">${damageType}</span>`;
	});

	// Dice roll notation
	registerTagHandler('dice', (text) => {
		const parts = splitTagByPipe(text);
		const diceNotation = escapeHtml(parts[0]);
		return `<span class="rd__dice" data-roll="${diceNotation}">${diceNotation}</span>`;
	});

	// Difficulty Class reference
	registerTagHandler('dc', (text) => {
		const parts = splitTagByPipe(text);
		const dcValue = escapeHtml(parts[0]);
		return `<span class="rd__dc">DC ${dcValue}</span>`;
	});

	// Creature reference
	registerTagHandler('creature', (text) => {
		const parts = splitTagByPipe(text);
		const creatureName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__creature-link rd__hover-link" data-hover-type="creature" data-hover-name="${creatureName}" data-hover-source="${source}">${creatureName}</a>`;
	});

	// Book reference
	registerTagHandler('book', (text) => {
		const parts = splitTagByPipe(text);
		const displayText = escapeHtml(parts[0]);
		const bookCode = escapeHtml(parts[1] || parts[0]);
		return `<span class="rd__book-ref" data-book="${bookCode}">${displayText}</span>`;
	});

	// Variant rule reference
	registerTagHandler('variantrule', (text) => {
		const parts = splitTagByPipe(text);
		const ruleName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__variantrule-link rd__hover-link" data-hover-type="variantrule" data-hover-name="${ruleName}" data-hover-source="${source}">${ruleName}</a>`;
	});

	// Quick reference (rules)
	registerTagHandler('quickref', (text) => {
		const parts = splitTagByPipe(text);
		const refName = escapeHtml(parts[0]);
		return `<span class="rd__quickref">${refName}</span>`;
	});

	// Item property reference
	registerTagHandler('itemProperty', (text) => {
		const parts = splitTagByPipe(text);
		const propName = escapeHtml(parts[0]);
		return `<span class="rd__item-property">${propName}</span>`;
	});

	// Sense reference
	registerTagHandler('sense', (text) => {
		const parts = splitTagByPipe(text);
		const senseName = escapeHtml(parts[0]);
		return `<span class="rd__sense">${senseName}</span>`;
	});

	// Attack type reference (for creature statblocks)
	registerTagHandler('atk', (text) => {
		const parts = splitTagByPipe(text);
		const attackType = escapeHtml(parts[0]);
		return `<span class="rd__atk">${attackType}</span>`;
	});

	// Hit/Miss labels (for creature attacks)
	registerTagHandler('h', (_text) => {
		return `<span class="rd__hit"><em>Hit:</em> </span>`;
	});

	registerTagHandler('m', (_text) => {
		return `<span class="rd__miss"><em>Miss:</em> </span>`;
	});

	registerTagHandler('hom', (_text) => {
		return `<span class="rd__hit-or-miss"><em>Hit or Miss:</em> </span>`;
	});

	// Recharge notation (e.g., "Recharge 5-6")
	registerTagHandler('recharge', (text) => {
		const parts = splitTagByPipe(text);
		const rechargeValue = escapeHtml(parts[0]);
		return `<span class="rd__recharge">(Recharge ${rechargeValue})</span>`;
	});

	// Ability score reference
	registerTagHandler('ability', (text) => {
		const parts = splitTagByPipe(text);
		const abilityScore = escapeHtml(parts[0]);
		return `<span class="rd__ability">${abilityScore}</span>`;
	});

	// Area of effect reference
	registerTagHandler('area', (text) => {
		const parts = splitTagByPipe(text);
		const areaName = escapeHtml(parts[0]);
		return `<span class="rd__area">${areaName}</span>`;
	});

	// Chance/probability notation
	registerTagHandler('chance', (text) => {
		const parts = splitTagByPipe(text);
		const chanceValue = escapeHtml(parts[0]);
		return `<span class="rd__chance">${chanceValue}%</span>`;
	});

	// Scaled dice notation (for leveled effects)
	registerTagHandler('scaledice', (text) => {
		const parts = splitTagByPipe(text);
		const scaledDice = escapeHtml(parts[0]);
		return `<span class="rd__scaledice">${scaledDice}</span>`;
	});

	// Scaled damage notation
	registerTagHandler('scaledamage', (text) => {
		const parts = splitTagByPipe(text);
		const scaledDamage = escapeHtml(parts[0]);
		return `<span class="rd__scaledamage">${scaledDamage}</span>`;
	});

	// D20 roll notation (for advantage/disadvantage rolls)
	registerTagHandler('d20', (text) => {
		const parts = splitTagByPipe(text);
		const d20Text = escapeHtml(parts[0]);
		return `<span class="rd__d20">${d20Text}</span>`;
	});

	// Hit bonus notation (for attack rolls)
	registerTagHandler('hit', (text) => {
		const parts = splitTagByPipe(text);
		const hitBonus = escapeHtml(parts[0]);
		return `<span class="rd__hit-bonus">${hitBonus}</span>`;
	});

	// Filter link (for homebrew/advanced features)
	registerTagHandler('filter', (text) => {
		const parts = splitTagByPipe(text);
		const filterText = escapeHtml(parts[0]);
		return `<span class="rd__filter">${filterText}</span>`;
	});

	// Status/condition inflicted
	registerTagHandler('status', (text) => {
		const parts = splitTagByPipe(text);
		const statusName = escapeHtml(parts[0]);
		return `<span class="rd__status">${statusName}</span>`;
	});

	// Adventure reference
	registerTagHandler('adventure', (text) => {
		const parts = splitTagByPipe(text);
		const adventureName = escapeHtml(parts[0]);
		const adventureSource = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__adventure-link" data-adventure="${adventureSource}">${adventureName}</a>`;
	});

	// Trap/Hazard reference
	registerTagHandler('trap', (text) => {
		const parts = splitTagByPipe(text);
		const trapName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__trap-link rd__hover-link" data-hover-type="trap" data-hover-name="${trapName}" data-hover-source="${source}">${trapName}</a>`;
	});

	registerTagHandler('hazard', (text) => {
		const parts = splitTagByPipe(text);
		const hazardName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__hazard-link rd__hover-link" data-hover-type="hazard" data-hover-name="${hazardName}" data-hover-source="${source}">${hazardName}</a>`;
	});

	// Vehicle reference
	registerTagHandler('vehicle', (text) => {
		const parts = splitTagByPipe(text);
		const vehicleName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__vehicle-link rd__hover-link" data-hover-type="vehicle" data-hover-name="${vehicleName}" data-hover-source="${source}">${vehicleName}</a>`;
	});

	// Object reference
	registerTagHandler('object', (text) => {
		const parts = splitTagByPipe(text);
		const objectName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__object-link rd__hover-link" data-hover-type="object" data-hover-name="${objectName}" data-hover-source="${source}">${objectName}</a>`;
	});

	// Deity reference
	registerTagHandler('deity', (text) => {
		const parts = splitTagByPipe(text);
		const deityName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__deity-link rd__hover-link" data-hover-type="deity" data-hover-name="${deityName}" data-hover-source="${source}">${deityName}</a>`;
	});

	// Reward reference (supernatural gifts, blessings, etc.)
	registerTagHandler('reward', (text) => {
		const parts = splitTagByPipe(text);
		const rewardName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__reward-link rd__hover-link" data-hover-type="reward" data-hover-name="${rewardName}" data-hover-source="${source}">${rewardName}</a>`;
	});

	// Language reference
	registerTagHandler('language', (text) => {
		const parts = splitTagByPipe(text);
		const languageName = escapeHtml(parts[0]);
		return `<span class="rd__language">${languageName}</span>`;
	});

	// Coinflip notation
	registerTagHandler('coinflip', (_text) => {
		return `<span class="rd__coinflip">flip a coin</span>`;
	});

	// Table reference
	registerTagHandler('table', (text) => {
		const parts = splitTagByPipe(text);
		const tableName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__table-link rd__hover-link" data-hover-type="table" data-hover-name="${tableName}" data-hover-source="${source}">${tableName}</a>`;
	});

	// Card reference (for decks of cards)
	registerTagHandler('card', (text) => {
		const parts = splitTagByPipe(text);
		const cardName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__card-link rd__hover-link" data-hover-type="card" data-hover-name="${cardName}" data-hover-source="${source}">${cardName}</a>`;
	});

	// Deck reference (for decks of cards)
	registerTagHandler('deck', (text) => {
		const parts = splitTagByPipe(text);
		const deckName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || DEFAULT_SOURCE);
		return `<a class="rd__deck-link rd__hover-link" data-hover-type="deck" data-hover-name="${deckName}" data-hover-source="${source}">${deckName}</a>`;
	});

	// Generic link (external or internal)
	registerTagHandler('link', (text) => {
		const parts = splitTagByPipe(text);
		const linkText = escapeHtml(parts[0]);
		const url = parts[1] || '#';
		return `<a class="rd__link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
	});

	// 5etools branding tag (treat as simple text/link to avoid warnings)
	registerTagHandler('5etools', (text) => {
		const parts = splitTagByPipe(text || '5etools|https://5e.tools');
		const label = escapeHtml(parts[0] || '5etools');
		const url = parts[1] || 'https://5e.tools';
		return `<a class="rd__link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
	});
}

export function processString(text) {
	if (!text) return '';
	return renderStringWithTags(text);
}

export function processEntries(entries) {
	if (!Array.isArray(entries)) {
		return processString(String(entries));
	}

	return entries
		.map((entry) => {
			if (typeof entry === 'string') {
				return processString(entry);
			} else if (typeof entry === 'object' && entry.entries) {
				return processEntries(entry.entries);
			}
			return '';
		})
		.join(' ');
}

// Initialize default handlers on module load
initializeDefaultHandlers();

// Export all public functions
export const Renderer5etools = {
	registerTagHandler,
	renderTag,
	renderStringWithTags,
	processString,
	processEntries,
	escapeHtml,
};
