/** TagProcessor.js - Processes inline D&D reference tags for rendering. */

/**
 * Escape HTML special characters in attribute values
 * @param {string} text Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
	if (!text) return '';
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

/**
 * Split tag by pipe character
 * @param {string} text Text to split
 * @returns {Array<string>} Parts
 */
export function splitTagByPipe(text) {
	return text.split('|').map((s) => s.trim());
}

/** Module-level tag handlers registry */
const _handlers = {};

/**
 * Register a tag handler
 * @param {string} tag Tag name (e.g., "spell", "item")
 * @param {Function} handler Handler function
 */
export function registerHandler(tag, handler) {
	_handlers[tag] = handler;
}

/**
 * Process a tag reference
 * @param {string} tag Tag type
 * @param {string} text Tag content
 * @returns {string} HTML
 */
export function processTag(tag, text) {
	const handler = _handlers[tag];
	if (!handler) {
		console.warn('[TagProcessor]', `Unknown tag: ${tag}`);
		return text;
	}
	return handler(text);
}

/**
 * Initialize default tag handlers
 * @private
 */
function _registerDefaultHandlers() {
	// Class handler
	registerHandler('class', (text) => {
		const parts = splitTagByPipe(text);
		const className = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__class-link rd__hover-link" data-hover-type="class" data-hover-name="${className}" data-hover-source="${source}">${className}</a>`;
	});

	// Race handler
	registerHandler('race', (text) => {
		const parts = splitTagByPipe(text);
		const raceName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__race-link rd__hover-link" data-hover-type="race" data-hover-name="${raceName}" data-hover-source="${source}">${raceName}</a>`;
	});

	// Background handler
	registerHandler('background', (text) => {
		const parts = splitTagByPipe(text);
		const bgName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__background-link rd__hover-link" data-hover-type="background" data-hover-name="${bgName}" data-hover-source="${source}">${bgName}</a>`;
	});

	// Feat handler
	registerHandler('feat', (text) => {
		const parts = splitTagByPipe(text);
		const featName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__feat-link rd__hover-link" data-hover-type="feat" data-hover-name="${featName}" data-hover-source="${source}">${featName}</a>`;
	});

	// Feature handler
	registerHandler('feature', (text) => {
		const parts = splitTagByPipe(text);
		const featureName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__feature-link rd__hover-link" data-hover-type="feature" data-hover-name="${featureName}" data-hover-source="${source}">${featureName}</a>`;
	});

	// Spell handler
	registerHandler('spell', (text) => {
		const parts = splitTagByPipe(text);
		const spellName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__spell-link rd__hover-link" data-hover-type="spell" data-hover-name="${spellName}" data-hover-source="${source}">${spellName}</a>`;
	});

	// Item handler
	registerHandler('item', (text) => {
		const parts = splitTagByPipe(text);
		const itemName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__item-link rd__hover-link" data-hover-type="item" data-hover-name="${itemName}" data-hover-source="${source}">${itemName}</a>`;
	});

	// Condition handler
	registerHandler('condition', (text) => {
		const parts = splitTagByPipe(text);
		const condName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__condition-link rd__hover-link" data-hover-type="condition" data-hover-name="${condName}" data-hover-source="${source}">${condName}</a>`;
	});

	// Monster handler
	registerHandler('monster', (text) => {
		const parts = splitTagByPipe(text);
		const monsterName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'MM');

		return `<a class="rd__monster-link rd__hover-link" data-hover-type="monster" data-hover-name="${monsterName}" data-hover-source="${source}">${monsterName}</a>`;
	});

	// Action handler
	registerHandler('action', (text) => {
		const parts = splitTagByPipe(text);
		const actionName = escapeHtml(parts[0]);

		return `<a class="rd__action-link rd__hover-link" data-hover-type="action" data-hover-name="${actionName}">${actionName}</a>`;
	});

	// Skill handler
	registerHandler('skill', (text) => {
		const parts = splitTagByPipe(text);
		const skillName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__skill-link rd__hover-link" data-hover-type="skill" data-hover-name="${skillName}" data-hover-source="${source}">${skillName}</a>`;
	});

	// Language handler
	registerHandler('language', (text) => {
		const parts = splitTagByPipe(text);
		const langName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__language-link rd__hover-link" data-hover-type="language" data-hover-name="${langName}" data-hover-source="${source}">${langName}</a>`;
	});

	// Proficiency handler
	registerHandler('proficiency', (text) => {
		const parts = splitTagByPipe(text);
		const profName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__proficiency-link rd__hover-link" data-hover-type="proficiency" data-hover-name="${profName}" data-hover-source="${source}">${profName}</a>`;
	});

	// Source handler
	registerHandler('source', (text) => {
		const parts = splitTagByPipe(text);
		const sourceName = escapeHtml(parts[0]);

		return `<span class="rd__source" data-source="${sourceName}" title="Source: ${sourceName}">${sourceName}</span>`;
	});

	// Filter handler - renders as plain text, links to search results (no hover tooltip)
	registerHandler('filter', (text) => {
		const parts = splitTagByPipe(text);
		const displayName = escapeHtml(parts[0]);
		// Parts[1] would be the category (e.g., "spells")
		// Remaining parts are filter parameters which we ignore for tooltip display

		return `<span class="rd__filter-link">${displayName}</span>`;
	});

	// Book handler
	registerHandler('book', (text) => {
		const parts = splitTagByPipe(text);
		const bookName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');

		return `<a class="rd__book-link rd__hover-link" data-hover-type="book" data-hover-name="${bookName}" data-hover-source="${source}">${bookName}</a>`;
	});

	// Weapon proficiency handler
	registerHandler('weaponprof', (text) => {
		const parts = splitTagByPipe(text);
		const displayName =
			parts.length > 1
				? escapeHtml(parts[1])
				: escapeHtml(parts[0]);

		return `<span class="rd__weapon-prof">${displayName}</span>`;
	});

	// Armor proficiency handler
	registerHandler('armorprof', (text) => {
		const parts = splitTagByPipe(text);
		const displayName =
			parts.length > 1
				? escapeHtml(parts[1])
				: escapeHtml(parts[0]);

		return `<span class="rd__armor-prof">${displayName}</span>`;
	});

	// DC (Difficulty Class) handler
	registerHandler('dc', (text) => {
		const parts = splitTagByPipe(text);
		const dcValue = escapeHtml(parts[0]);
		return `<span class="rd__dc">DC ${dcValue}</span>`;
	});

	// 5etools link handler
	registerHandler('5etools', (text) => {
		const parts = splitTagByPipe(text);
		const displayText =
			parts.length > 1
				? escapeHtml(parts[1])
				: escapeHtml(parts[0]);
		return `<span class="rd__5etools-link">${displayText}</span>`;
	});

	// Status/condition handler
	registerHandler('status', (text) => {
		const parts = splitTagByPipe(text);
		const statusName = escapeHtml(parts[0]);
		return `<span class="rd__status">${statusName}</span>`;
	});

	// Sense handler
	registerHandler('sense', (text) => {
		const parts = splitTagByPipe(text);
		const senseName = escapeHtml(parts[0]);
		return `<span class="rd__sense">${senseName}</span>`;
	});

	// Damage handler
	registerHandler('damage', (text) => {
		const parts = splitTagByPipe(text);
		const damageType = escapeHtml(parts[0]);
		return `<span class="rd__damage">${damageType}</span>`;
	});

	// Scaled damage handler
	registerHandler('scaledamage', (text) => {
		const parts = splitTagByPipe(text);
		const scaledDamage = escapeHtml(parts[0]);
		return `<span class="rd__scaled-damage">${scaledDamage}</span>`;
	});

	// Item property handler
	registerHandler('itemProperty', (text) => {
		const parts = splitTagByPipe(text);
		const propertyName = escapeHtml(parts[0]);
		return `<span class="rd__item-property">${propertyName}</span>`;
	});

	// Variant rule handler
	registerHandler('variantrule', (text) => {
		const parts = splitTagByPipe(text);
		const ruleName = escapeHtml(parts[0]);
		const source = escapeHtml(parts[1] || 'PHB');
		return `<a class="rd__variantrule-link rd__hover-link" data-hover-type="variantrule" data-hover-name="${ruleName}" data-hover-source="${source}">${ruleName}</a>`;
	});

	// Dice handler
	registerHandler('dice', (text) => {
		const parts = splitTagByPipe(text);
		const diceExpression = escapeHtml(parts[0]);
		return `<span class="rd__dice">${diceExpression}</span>`;
	});

	// Scaled dice handler
	registerHandler('scaledice', (text) => {
		const parts = splitTagByPipe(text);
		const scaledDiceExpression = escapeHtml(parts[0]);
		return `<span class="rd__scaled-dice">${scaledDiceExpression}</span>`;
	});

	// Bold
	registerHandler('b', (text) => `<strong>${text}</strong>`);

	// Italic
	registerHandler('i', (text) => `<em>${text}</em>`);

	// Underline
	registerHandler('u', (text) => `<u>${text}</u>`);
}

// Initialize handlers on module load
_registerDefaultHandlers();


/**
 * Render a string with inline tags
 * @param {string} str String to render
 * @returns {string} HTML
 */
export function renderString(str) {
	if (!str) return '';

	// Find all tags in format {@tag content}
	const tagRegex = /\{@(\w+)\s+([^}]+)\}/g;

	return str.replace(tagRegex, (match, tag, content) => {
		try {
			return processTag(tag, content);
		} catch (e) {
			console.error('[TagProcessor]', `Error processing tag @${tag}:`, e);
			return match;
		}
	});
}

/**
 * Get a string renderer object (for backward compatibility)
 * @returns {Object} Object with render method
 */
export function getStringRenderer() {
	return { render: renderString };
}
