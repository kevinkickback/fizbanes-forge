import { Logger } from '../infrastructure/Logger.js';
/**
 * TagProcessor.js
 * Handles processing of inline D&D reference tags ({@spell ...}, {@item ...}, etc.)
 * Part of the rendering system for D&D content
 */

/**
 * Tag processor for handling inline references
 */
export class TagProcessor {
	constructor() {
		this._handlers = {};
		this._registerDefaultHandlers();
	}

	/**
	 * Escape HTML special characters in attribute values
	 * @param {string} text Text to escape
	 * @returns {string} Escaped text
	 * @static
	 */
	static escapeHtml(text) {
		if (!text) return '';
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#x27;');
	}

	/**
	 * Register a tag handler
	 * @param {string} tag Tag name (e.g., "spell", "item")
	 * @param {Function} handler Handler function
	 */
	registerHandler(tag, handler) {
		this._handlers[tag] = handler;
	}

	/**
	 * Process a tag reference
	 * @param {string} tag Tag type
	 * @param {string} text Tag content
	 * @returns {string} HTML
	 */
	processTag(tag, text) {
		const handler = this._handlers[tag];
		if (!handler) {
			Logger.warn('TagProcessor', `Unknown tag: ${tag}`);
			return text;
		}
		return handler(text);
	}

	/**
	 * Split tag by pipe character
	 * @param {string} text Text to split
	 * @returns {Array<string>} Parts
	 */
	static splitTagByPipe(text) {
		return text.split('|').map((s) => s.trim());
	}

	/**
	 * Register default tag handlers
	 * @private
	 */
	_registerDefaultHandlers() {
		// Class handler
		this.registerHandler('class', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const className = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__class-link rd__hover-link" data-hover-type="class" data-hover-name="${className}" data-hover-source="${source}">${className}</a>`;
		});

		// Race handler
		this.registerHandler('race', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const raceName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__race-link rd__hover-link" data-hover-type="race" data-hover-name="${raceName}" data-hover-source="${source}">${raceName}</a>`;
		});

		// Background handler
		this.registerHandler('background', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const bgName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__background-link rd__hover-link" data-hover-type="background" data-hover-name="${bgName}" data-hover-source="${source}">${bgName}</a>`;
		});

		// Feat handler
		this.registerHandler('feat', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const featName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__feat-link rd__hover-link" data-hover-type="feat" data-hover-name="${featName}" data-hover-source="${source}">${featName}</a>`;
		});

		// Feature handler
		this.registerHandler('feature', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const featureName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__feature-link rd__hover-link" data-hover-type="feature" data-hover-name="${featureName}" data-hover-source="${source}">${featureName}</a>`;
		});

		// Spell handler
		this.registerHandler('spell', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const spellName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__spell-link rd__hover-link" data-hover-type="spell" data-hover-name="${spellName}" data-hover-source="${source}">${spellName}</a>`;
		});

		// Item handler
		this.registerHandler('item', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const itemName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__item-link rd__hover-link" data-hover-type="item" data-hover-name="${itemName}" data-hover-source="${source}">${itemName}</a>`;
		});

		// Condition handler
		this.registerHandler('condition', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const condName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__condition-link rd__hover-link" data-hover-type="condition" data-hover-name="${condName}" data-hover-source="${source}">${condName}</a>`;
		});

		// Monster handler
		this.registerHandler('monster', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const monsterName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'MM');

			return `<a class="rd__monster-link rd__hover-link" data-hover-type="monster" data-hover-name="${monsterName}" data-hover-source="${source}">${monsterName}</a>`;
		});

		// Action handler
		this.registerHandler('action', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const actionName = TagProcessor.escapeHtml(parts[0]);

			return `<a class="rd__action-link rd__hover-link" data-hover-type="action" data-hover-name="${actionName}">${actionName}</a>`;
		});

		// Skill handler
		this.registerHandler('skill', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const skillName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__skill-link rd__hover-link" data-hover-type="skill" data-hover-name="${skillName}" data-hover-source="${source}">${skillName}</a>`;
		});

		// Language handler
		this.registerHandler('language', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const langName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__language-link rd__hover-link" data-hover-type="language" data-hover-name="${langName}" data-hover-source="${source}">${langName}</a>`;
		});

		// Proficiency handler
		this.registerHandler('proficiency', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const profName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__proficiency-link rd__hover-link" data-hover-type="proficiency" data-hover-name="${profName}" data-hover-source="${source}">${profName}</a>`;
		});

		// Source handler
		this.registerHandler('source', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const sourceName = TagProcessor.escapeHtml(parts[0]);

			return `<span class="rd__source" data-source="${sourceName}" title="Source: ${sourceName}">${sourceName}</span>`;
		});

		// Filter handler - renders as plain text, links to search results (no hover tooltip)
		this.registerHandler('filter', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const displayName = TagProcessor.escapeHtml(parts[0]);
			// Parts[1] would be the category (e.g., "spells")
			// Remaining parts are filter parameters which we ignore for tooltip display

			return `<span class="rd__filter-link">${displayName}</span>`;
		});

		// Book handler
		this.registerHandler('book', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const bookName = TagProcessor.escapeHtml(parts[0]);
			const source = TagProcessor.escapeHtml(parts[1] || 'PHB');

			return `<a class="rd__book-link rd__hover-link" data-hover-type="book" data-hover-name="${bookName}" data-hover-source="${source}">${bookName}</a>`;
		});

		// Weapon proficiency handler
		this.registerHandler('weaponprof', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const displayName =
				parts.length > 1
					? TagProcessor.escapeHtml(parts[1])
					: TagProcessor.escapeHtml(parts[0]);

			return `<span class="rd__weapon-prof">${displayName}</span>`;
		});

		// Armor proficiency handler
		this.registerHandler('armorprof', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const displayName =
				parts.length > 1
					? TagProcessor.escapeHtml(parts[1])
					: TagProcessor.escapeHtml(parts[0]);

			return `<span class="rd__armor-prof">${displayName}</span>`;
		});

		// DC (Difficulty Class) handler
		this.registerHandler('dc', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const dcValue = TagProcessor.escapeHtml(parts[0]);
			return `<span class="rd__dc">DC ${dcValue}</span>`;
		});

		// 5etools link handler
		this.registerHandler('5etools', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const displayText =
				parts.length > 1
					? TagProcessor.escapeHtml(parts[1])
					: TagProcessor.escapeHtml(parts[0]);
			return `<span class="rd__5etools-link">${displayText}</span>`;
		});

		// Status/condition handler
		this.registerHandler('status', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const statusName = TagProcessor.escapeHtml(parts[0]);
			return `<span class="rd__status">${statusName}</span>`;
		});

		// Sense handler
		this.registerHandler('sense', (text) => {
			const parts = TagProcessor.splitTagByPipe(text);
			const senseName = TagProcessor.escapeHtml(parts[0]);
			return `<span class="rd__sense">${senseName}</span>`;
		});

		// Bold
		this.registerHandler('b', (text) => `<strong>${text}</strong>`);

		// Italic
		this.registerHandler('i', (text) => `<em>${text}</em>`);

		// Underline
		this.registerHandler('u', (text) => `<u>${text}</u>`);
	}
}

/**
 * String renderer with tag processing
 */
export class StringRenderer {
	constructor(tagProcessor = null, tooltipManager = null) {
		this.tagProcessor = tagProcessor || getTagProcessor();
		this.tooltipManager = tooltipManager;
	}

	/**
	 * Render a string with inline tags
	 * @param {string} str String to render
	 * @returns {string} HTML
	 */
	render(str) {
		if (!str) return '';

		// Find all tags in format {@tag content}
		const tagRegex = /\{@(\w+)\s+([^}]+)\}/g;

		return str.replace(tagRegex, (match, tag, content) => {
			try {
				return this.tagProcessor.processTag(tag, content);
			} catch (e) {
				Logger.error('TagProcessor', `Error processing tag @${tag}:`, e);
				return match;
			}
		});
	}
}

// Singleton instances
let _tagProcessorInstance = null;
let _stringRendererInstance = null;

export function getTagProcessor() {
	if (!_tagProcessorInstance) {
		_tagProcessorInstance = new TagProcessor();
	}
	return _tagProcessorInstance;
}

export function getStringRenderer() {
	if (!_stringRendererInstance) {
		_stringRendererInstance = new StringRenderer(getTagProcessor());
	}
	return _stringRendererInstance;
}
