/**
 * Renderer5etools.js
 * Unified tag and text rendering based on 5etools architecture patterns.
 * Consolidates TextProcessor and TagProcessor functionality into a single, focused utility.
 */

import { DEFAULT_SOURCE } from './5eToolsParser.js';

/**
 * Escape HTML special characters in attribute values
 * @param {string} text Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
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
function splitTagByPipe(text) {
	return text.split('|').map((s) => s.trim());
}

/**
 * Tag handler registry - maps tag type to render function
 * @private
 */
const tagHandlers = {};

/**
 * Register a tag handler function
 * @param {string} tag Tag name (e.g., "spell", "item", "class")
 * @param {Function} handler Handler function(content) => html
 */
export function registerTagHandler(tag, handler) {
	tagHandlers[tag] = handler;
}

/**
 * Render a single tag reference
 * @param {string} tag Tag type (e.g., "spell", "class")
 * @param {string} content Tag content (e.g., "Fireball|PHB")
 * @returns {string} HTML link element
 */
export function renderTag(tag, content) {
	const handler = tagHandlers[tag];
	if (!handler) {
		console.warn('[Renderer5etools] Unknown tag:', tag);
		return escapeHtml(content.split('|')[0]);
	}
	return handler(content);
}

/**
 * Render a string with embedded tags
 * Converts {@tag content} syntax to HTML links
 * @param {string} text Input text with embedded tags
 * @returns {string} HTML with rendered tags
 */
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

/**
 * Initialize default tag handlers for D&D content types
 * Called automatically on module load
 */
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
}

/**
 * Process a text string and render all embedded tags
 * This is the primary entry point for text processing
 * @param {string} text Text with embedded tags
 * @returns {string} HTML with rendered tags
 */
export function processString(text) {
	if (!text) return '';
	return renderStringWithTags(text);
}

/**
 * Process an array of text entries
 * @param {Array<string|Object>} entries Array of strings or entry objects
 * @returns {string} Concatenated HTML
 */
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
