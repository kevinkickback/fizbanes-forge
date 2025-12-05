/**
 * Tooltips.js
 * Handles displaying and hiding D&D reference tooltips
 */

import { Logger } from '../infrastructure/Logger.js';
import { getReferenceResolver } from './ReferenceResolver.js';
import { getStringRenderer } from './TagProcessor.js';

/**
 * Tooltip manager - handles displaying and hiding tooltips
 */
export class TooltipManager {
	constructor() {
		this._tooltips = []; // Stack of active tooltips
		this._referenceResolver = getReferenceResolver();
		this._init();
	}

	_init() {
		// Container for all tooltips will be body
		// Individual tooltips will be created on demand
	}

	/**
	 * Create a new tooltip element
	 * @returns {Object} Tooltip object with container and element
	 * @private
	 */
	_createTooltip() {
		const container = document.createElement('div');
		container.className = 'tooltip-container';
		container.style.display = 'block';
		container.style.zIndex = 10000 + this._tooltips.length;
		container.style.pointerEvents = 'auto'; // Ensure container can receive mouse events

		const tooltip = document.createElement('div');
		tooltip.className = 'tooltip';

		container.appendChild(tooltip);
		document.body.appendChild(container);

		return { container, tooltip };
	}

	/**
	 * Show tooltip at position with data
	 * @param {number} x X coordinate
	 * @param {number} y Y coordinate
	 * @param {string} content Content to display
	 * @param {Object} options Additional options
	 */
	show(x, y, content, options = {}) {
		// Create new tooltip
		const tooltipObj = this._createTooltip();
		tooltipObj.tooltip.innerHTML = content;
		tooltipObj.tooltip.classList.add('show');

		// Store reference key for circular reference detection (but not for circular warning tooltips)
		if (options.referenceKey && !options.isCircular) {
			tooltipObj.referenceKey = options.referenceKey;
		}

		// Add to stack
		this._tooltips.push(tooltipObj);

		// Wait for next frame to get accurate dimensions
		requestAnimationFrame(() => {
			const tooltipRect = tooltipObj.tooltip.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			let left = x + 10;
			let top = y + 10;

			// Check right boundary
			if (left + tooltipRect.width > viewportWidth) {
				left = x - tooltipRect.width - 10;
				// If still off-screen on left, align to right edge
				if (left < 0) {
					left = viewportWidth - tooltipRect.width - 10;
				}
			}

			// Check bottom boundary
			if (top + tooltipRect.height > viewportHeight) {
				top = y - tooltipRect.height - 10;
				// If still off-screen on top, align to bottom edge
				if (top < 0) {
					top = viewportHeight - tooltipRect.height - 10;
				}
			}

			// Ensure minimum margins
			left = Math.max(
				10,
				Math.min(left, viewportWidth - tooltipRect.width - 10),
			);
			top = Math.max(
				10,
				Math.min(top, viewportHeight - tooltipRect.height - 10),
			);

			tooltipObj.container.style.left = `${left}px`;
			tooltipObj.container.style.top = `${top}px`;
		});
	}

	/**
	 * Hide the most recent tooltip
	 */
	hide() {
		if (this._tooltips.length === 0) return;

		const tooltipObj = this._tooltips.pop();
		tooltipObj.tooltip.classList.remove('show');
		tooltipObj.tooltip.classList.add('hide');

		setTimeout(() => {
			if (tooltipObj.container.parentNode) {
				tooltipObj.container.parentNode.removeChild(tooltipObj.container);
			}
		}, 200);
	}

	/**
	 * Hide all tooltips
	 */
	hideAll() {
		while (this._tooltips.length > 0) {
			this.hide();
		}
	}

	/**
	 * Load and display tooltip for a reference
	 * @param {string} type Reference type (spell, item, etc)
	 * @param {string} name Reference name
	 * @param {string} source Source abbreviation
	 * @param {number} x X coordinate
	 * @param {number} y Y coordinate
	 */
	async showReference(type, name, source, x, y) {
		if (!this._referenceResolver) {
			this.show(x, y, `<strong>${name}</strong>`);
			return;
		}

		// Check if this reference is already open in the tooltip stack (prevent circular references)
		// Normalize name for comparison (lowercase, remove special chars)
		const normalizedName = name.toLowerCase().replace(/['']/g, "'").trim();
		const referenceKey = `${type}:${normalizedName}`;

		const isAlreadyOpen = this._tooltips.some((t) => {
			if (!t.referenceKey) return false;
			// Compare type and name only, ignore source as it might differ
			const existingKey = t.referenceKey.split(':').slice(0, 2).join(':');
			Logger.info(
				'TooltipSystem',
				`Comparing "${referenceKey}" with "${existingKey}"`,
			);
			return existingKey === referenceKey;
		});

		if (isAlreadyOpen) {
			Logger.info(
				'TooltipSystem',
				`Circular reference detected: ${type} - ${name} is already open in the chain, ignoring hover`,
			);
			return;
		}

		try {
			Logger.info('TooltipSystem', `[Loading ${type}: ${name} (${source})]`);
			let data = null;

			switch (type) {
				case 'spell':
					data = await this._referenceResolver.resolveSpell(name, source);
					break;
				case 'item':
					data = await this._referenceResolver.resolveItem(name, source);
					break;
				case 'condition':
					data = await this._referenceResolver.resolveCondition(name);
					break;
				case 'monster':
					data = await this._referenceResolver.resolveMonster(name, source);
					break;
				case 'class':
					data = await this._referenceResolver.resolveClass(name, source);
					break;
				case 'race':
					data = await this._referenceResolver.resolveRace(name, source);
					break;
				case 'feat':
					data = await this._referenceResolver.resolveFeat(name, source);
					break;
				case 'background':
					data = await this._referenceResolver.resolveBackground(name, source);
					break;
				case 'skill':
					data = await this._referenceResolver.resolveSkill(name);
					break;
				case 'action':
					data = await this._referenceResolver.resolveAction(name);
					break;
				default:
					data = { name, type };
			}

			const content = this._formatTooltip(data);
			Logger.info('TooltipSystem', `Resolved ${type}: ${name}`, data);
			this.show(x, y, content, { referenceKey });
		} catch (error) {
			Logger.error(`[TooltipSystem] Error showing tooltip for ${type}:`, error);
			this.show(
				x,
				y,
				`<strong>${name}</strong><br><small>Error loading details</small>`,
			);
		}
	}

	/**
	 * Format tooltip content from data
	 * @param {Object} data Data object
	 * @returns {string} HTML content
	 */
	_formatTooltip(data) {
		if (!data) {
			return '<em>No data available</em>';
		}

		if (data.error) {
			return `<strong>${data.name}</strong><br><small>${data.error}</small>`;
		}

		let html = '';

		// Title
		html += `<div class="tooltip-title">${data.name || 'Unknown'}</div>`;

		// Spell-specific formatting
		if (data.level !== undefined) {
			const levelName = data.level === 0 ? 'Cantrip' : `Level ${data.level}`;
			const school = data.school ? ` ${data.school}` : '';
			html += `<div class="tooltip-metadata">${levelName}${school}</div>`;

			if (data.time || data.range || data.components || data.duration) {
				html += '<div class="tooltip-casting-details">';
				if (data.time?.[0]) {
					html += `<strong>Casting Time:</strong><span>${data.time[0].number || 1} ${data.time[0].unit || 'action'}</span>`;
				}
				if (data.range?.distance) {
					const range = data.range.distance.amount
						? `${data.range.distance.amount} ${data.range.distance.type}`
						: data.range.distance.type;
					html += `<strong>Range:</strong><span>${range}</span>`;
				}
				if (data.components) {
					const comp = [];
					if (data.components.v) comp.push('V');
					if (data.components.s) comp.push('S');
					if (data.components.m)
						comp.push(`M (${data.components.m.text || data.components.m})`);
					html += `<strong>Components:</strong><span>${comp.join(', ')}</span>`;
				}
				if (data.duration?.[0]) {
					const dur = data.duration[0];
					const durText =
						dur.type === 'instant'
							? 'Instantaneous'
							: dur.concentration
								? `Concentration, ${dur.duration?.amount || ''} ${dur.duration?.type || ''}`
								: `${dur.duration?.amount || ''} ${dur.duration?.type || dur.type}`;
					html += `<strong>Duration:</strong><span>${durText}</span>`;
				}
				html += '</div>';
			}
		}

		// Race-specific formatting
		if (data.ability || data.size || data.speed) {
			html += '<div class="tooltip-metadata">';
			if (data.size && Array.isArray(data.size)) {
				html += `<strong>Size:</strong> ${data.size.join(', ')}<br>`;
			} else if (data.size) {
				html += `<strong>Size:</strong> ${data.size}<br>`;
			}
			if (data.speed?.walk) {
				html += `<strong>Speed:</strong> ${data.speed.walk} ft.<br>`;
			}
			if (data.ability && Array.isArray(data.ability)) {
				const abilities = data.ability
					.map((ab) => {
						const abilityStr = Object.entries(ab)
							.map(([key, val]) => {
								if (key === 'choose') return '';
								return `${key.toUpperCase()} ${val > 0 ? '+' : ''}${val}`;
							})
							.filter((s) => s)
							.join(', ');
						return abilityStr;
					})
					.filter((s) => s);
				if (abilities.length > 0) {
					html += `<strong>Ability Score Increase:</strong> ${abilities.join(', ')}<br>`;
				}
			}
			html += '</div>';
		}

		// Item-specific formatting
		if (data.type || data.rarity || data.weight || data.weapon) {
			html += '<div class="tooltip-metadata">';

			// Weapon-specific
			if (data.weapon) {
				if (data.weaponCategory) {
					html += `<strong>Type:</strong> ${data.weaponCategory} weapon<br>`;
				}
				if (data.dmg1) {
					html += `<strong>Damage:</strong> ${data.dmg1}`;
					if (data.dmgType) {
						html += ` ${data.dmgType}`;
					}
					if (data.dmg2) {
						html += ` (${data.dmg2} versatile)`;
					}
					html += '<br>';
				}
				if (data.property && data.property.length > 0) {
					html += `<strong>Properties:</strong> ${data.property.join(', ')}<br>`;
				}
			} else {
				if (data.type) {
					html += `<strong>Type:</strong> ${data.type}<br>`;
				}
			}

			if (data.rarity && data.rarity !== 'none') {
				html += `<strong>Rarity:</strong> ${data.rarity}<br>`;
			}
			if (data.weight) {
				html += `<strong>Weight:</strong> ${data.weight} lb.<br>`;
			}
			if (data.value) {
				html += `<strong>Value:</strong> ${data.value / 100} gp<br>`;
			}
			html += '</div>';
		}

		// Class-specific formatting
		if (data.hd) {
			html += '<div class="tooltip-metadata">';
			html += `<strong>Hit Die:</strong> d${data.hd.faces}<br>`;

			// Saving throws
			if (data.proficiency && Array.isArray(data.proficiency)) {
				const saves = data.proficiency.map((p) => p.toUpperCase()).join(', ');
				html += `<strong>Saving Throws:</strong> ${saves}<br>`;
			}

			// Starting proficiencies
			if (data.startingProficiencies) {
				if (data.startingProficiencies.armor) {
					// Render armor proficiencies (may contain tags)
					const armorStr = data.startingProficiencies.armor.join(', ');
					const renderedArmor = getStringRenderer().render(armorStr);
					html += `<strong>Armor:</strong> ${renderedArmor}<br>`;
				}
				if (data.startingProficiencies.weapons) {
					// Render weapon proficiencies (may contain tags or objects)
					const weaponsParts = data.startingProficiencies.weapons
						.map((w) => {
							if (typeof w === 'string') {
								return w;
							} else if (typeof w === 'object' && w.proficiency) {
								// Handle objects like {proficiency: "firearms", optional: true}
								return w.optional
									? `${w.proficiency} (optional)`
									: w.proficiency;
							}
							return '';
						})
						.filter(Boolean);
					const weaponsStr = weaponsParts.join(', ');
					const renderedWeapons = getStringRenderer().render(weaponsStr);
					html += `<strong>Weapons:</strong> ${renderedWeapons}<br>`;
				}
			}

			// Spellcasting
			if (data.spellcastingAbility) {
				html += `<strong>Spellcasting Ability:</strong> ${data.spellcastingAbility.toUpperCase()}<br>`;
			}

			html += '</div>';
		}

		// Skill-specific formatting
		if (
			data.ability &&
			typeof data.ability === 'string' &&
			!data.hd &&
			!data.level
		) {
			// Check it's a skill (has ability string but not a spell/class)
			html += '<div class="tooltip-metadata">';
			html += `<strong>Ability:</strong> ${data.ability.toUpperCase()}<br>`;
			html += '</div>';
		}

		// Action-specific formatting
		if (data.time && Array.isArray(data.time)) {
			html += '<div class="tooltip-metadata">';
			const timeStr = data.time.map((t) => `${t.number} ${t.unit}`).join(', ');
			html += `<strong>Time:</strong> ${timeStr}<br>`;
			html += '</div>';
		}

		// Condition/Feat-specific
		if (data.prerequisite) {
			html += `<div class="tooltip-metadata"><strong>Prerequisite:</strong> ${JSON.stringify(data.prerequisite)}</div>`;
		}

		// Description/Entries
		if (data.entries && Array.isArray(data.entries)) {
			html += '<div class="tooltip-description">';
			for (let i = 0; i < Math.min(data.entries.length, 5); i++) {
				const entry = data.entries[i];
				if (typeof entry === 'string') {
					const text =
						entry.length > 200 ? `${entry.substring(0, 200)}...` : entry;
					// Render tags in the entry text
					const renderedText = getStringRenderer().render(text);
					html += `<p>${renderedText}</p>`;
				} else if (entry.type === 'list' && entry.items) {
					// Handle list entries (common in conditions and backgrounds)
					// Don't render list-hang-notitle style (used for proficiency lists at top of backgrounds)
					if (entry.style === 'list-hang-notitle') {
						// Skip these - they're formatting lists that shouldn't appear in tooltips
						continue;
					}
					html += '<ul style="margin: 4px 0; padding-left: 20px;">';
					for (let j = 0; j < Math.min(entry.items.length, 5); j++) {
						const item = entry.items[j];
						let itemText = '';
						if (typeof item === 'string') {
							itemText = item;
						} else if (item.type === 'item' && item.entry) {
							// Handle {type: "item", name: "...", entry: "..."} format
							itemText = item.entry;
						}
						const renderedItem = getStringRenderer().render(itemText);
						html += `<li>${renderedItem}</li>`;
					}
					html += '</ul>';
				} else if (entry.type === 'entries') {
					// Handle nested entries
					if (entry.name) {
						html += `<p><strong>${entry.name}:</strong> `;
					}
					if (entry.entries && Array.isArray(entry.entries)) {
						for (let j = 0; j < Math.min(entry.entries.length, 3); j++) {
							const subEntry = entry.entries[j];
							if (typeof subEntry === 'string') {
								const renderedText = getStringRenderer().render(subEntry);
								html += `${renderedText} `;
							}
						}
					}
					if (entry.name) {
						html += `</p>`;
					}
				}
			}
			html += '</div>';
		}

		// Source
		if (data.source) {
			const page = data.page ? ` p. ${data.page}` : '';
			html += `<div class="tooltip-source">${data.source}${page}</div>`;
		}

		return html;
	}
}

/**
 * Initialize tooltip event listeners for all hover links
 */
export function initializeTooltipListeners(tooltipManager) {
	Logger.info('TooltipSystem', 'Initializing event listeners');

	// Track active link and tooltip for each depth level
	const activeElements = new Map(); // depth -> {link, tooltip, timeout}
	let currentHoverLink = null;

	// Helper to check if mouse is in tooltip system
	function isInTooltipSystem(element) {
		if (!element) return false;
		// Check if element itself or any parent is part of tooltip system
		const inTooltip =
			element.classList?.contains('tooltip-container') ||
			element.classList?.contains('tooltip') ||
			element.closest('.tooltip-container') !== null;
		const inLink =
			element.classList?.contains('rd__hover-link') ||
			element.closest('.rd__hover-link') !== null;
		return inTooltip || inLink;
	}

	// Use event delegation for hover links
	document.addEventListener('mouseover', (event) => {
		const link = event.target.closest('.rd__hover-link');
		if (!link) return;

		const hoverType = link.dataset.hoverType;
		const hoverName = link.dataset.hoverName;
		const hoverSource = link.dataset.hoverSource || 'PHB';

		// Find which tooltip contains this link (if any)
		const parentTooltip = link.closest('.tooltip-container');
		let linkTooltipIndex = -1;

		if (parentTooltip) {
			// Find the index of the tooltip containing this link
			linkTooltipIndex = tooltipManager._tooltips.findIndex(
				(t) => t.container === parentTooltip,
			);
		}

		// The new tooltip will be added after the one containing the link
		const keepUpToIndex = linkTooltipIndex + 1;
		const newTooltipDepth = keepUpToIndex;

		// Check if tooltip already exists at this depth for this link
		const existingTooltipAtDepth = tooltipManager._tooltips[newTooltipDepth];
		const _shouldCreateTooltip =
			!existingTooltipAtDepth || link !== currentHoverLink;

		// If hovering same link AND tooltip still exists, do nothing
		if (link === currentHoverLink && existingTooltipAtDepth) {
			return;
		}

		currentHoverLink = link;
		Logger.info('TooltipSystem', `Hovering over: ${hoverType} - ${hoverName}`);

		if (parentTooltip) {
			Logger.info(
				'TooltipSystem',
				`Link is in tooltip at index: ${linkTooltipIndex}`,
			);
		} else {
			Logger.info('TooltipSystem', 'Link is not in a tooltip (base level)');
		}

		Logger.info(
			'TooltipSystem',
			`Current stack size: ${tooltipManager._tooltips.length}, keeping up to index: ${keepUpToIndex}`,
		);

		// Remove tooltips after the one containing the link
		while (tooltipManager._tooltips.length > keepUpToIndex) {
			const removed = tooltipManager._tooltips.pop();
			Logger.info(
				'TooltipSystem',
				`Removing tooltip at index ${tooltipManager._tooltips.length}`,
			);
			if (removed.container.parentNode) {
				removed.container.parentNode.removeChild(removed.container);
			}
		}

		// Clear any pending timeouts for this depth and deeper
		activeElements.forEach((value, depth) => {
			if (depth >= newTooltipDepth && value.timeout) {
				clearTimeout(value.timeout);
			}
		});

		if (hoverType && hoverName) {
			const startCount = tooltipManager._tooltips.length;

			// Check if inline content is provided (e.g., for traits and features)
			const inlineContent = link.dataset.hoverContent;
			if (inlineContent && (hoverType === 'trait' || hoverType === 'feature')) {
				// Show tooltip with inline content
				const html = `<div class="tooltip-content"><strong>${hoverName}</strong><p>${inlineContent}</p></div>`;
				tooltipManager.show(event.clientX, event.clientY, html);
			} else {
				// Show tooltip by resolving reference
				tooltipManager.showReference(
					hoverType,
					hoverName,
					hoverSource,
					event.clientX,
					event.clientY,
				);
			}

			// Track the newly created tooltip
			if (tooltipManager._tooltips.length > startCount) {
				const newTooltip =
					tooltipManager._tooltips[tooltipManager._tooltips.length - 1]
						.container;
				activeElements.set(newTooltipDepth, {
					link,
					tooltip: newTooltip,
					timeout: null,
				});
				Logger.info(
					'TooltipSystem',
					`Added tooltip at depth ${newTooltipDepth}, stack size now: ${tooltipManager._tooltips.length}`,
				);
			}
		}
	});

	// Track global hide timeout
	let globalHideTimeout = null;

	// Global mouseout handler
	document.addEventListener('mouseout', (event) => {
		const fromElement = event.target;
		const toElement = event.relatedTarget;

		// If moving within tooltip system, check if we need to remove deeper tooltips
		if (isInTooltipSystem(fromElement) && isInTooltipSystem(toElement)) {
			// Find which tooltip we're moving FROM and TO
			const fromTooltip = fromElement.closest('.tooltip-container');
			const toTooltip = toElement.closest('.tooltip-container');

			// If moving from a deeper tooltip to a shallower one (or to a link in a shallower tooltip)
			if (fromTooltip && fromTooltip !== toTooltip) {
				const fromIndex = tooltipManager._tooltips.findIndex(
					(t) => t.container === fromTooltip,
				);
				const toIndex = toTooltip
					? tooltipManager._tooltips.findIndex((t) => t.container === toTooltip)
					: -1;

				// If we're moving to a shallower tooltip (or out of nested tooltip entirely)
				if (fromIndex > toIndex) {
					Logger.info(
						'TooltipSystem',
						`Moving from tooltip ${fromIndex} to ${toIndex}, removing deeper tooltips`,
					);

					// Remove tooltips deeper than where we're going
					const keepUpToIndex = toIndex + 1;
					setTimeout(() => {
						while (tooltipManager._tooltips.length > keepUpToIndex) {
							const removed = tooltipManager._tooltips.pop();
							removed.tooltip.classList.remove('show');
							removed.tooltip.classList.add('hide');
							setTimeout(() => {
								if (removed.container.parentNode) {
									removed.container.parentNode.removeChild(removed.container);
								}
							}, 200);
						}
					}, 150); // Small delay to prevent flickering
				}
			}
			return;
		}

		// If leaving tooltip system entirely
		if (isInTooltipSystem(fromElement) && !isInTooltipSystem(toElement)) {
			Logger.info('TooltipSystem', 'Left tooltip system, hiding all');

			// Clear all active tooltips after delay
			globalHideTimeout = setTimeout(() => {
				currentHoverLink = null;
				activeElements.clear();
				while (tooltipManager._tooltips.length > 0) {
					const removed = tooltipManager._tooltips.pop();
					removed.tooltip.classList.remove('show');
					removed.tooltip.classList.add('hide');
					setTimeout(() => {
						if (removed.container.parentNode) {
							removed.container.parentNode.removeChild(removed.container);
						}
					}, 200);
				}
				globalHideTimeout = null;
			}, 300);
		}
	});

	// Cancel hide when entering tooltip system
	document.addEventListener('mouseover', (event) => {
		const enteringElement = event.target;

		if (isInTooltipSystem(enteringElement)) {
			// Cancel pending hide timeout
			if (globalHideTimeout) {
				Logger.info('TooltipSystem', 'Canceling hide timer');
				clearTimeout(globalHideTimeout);
				globalHideTimeout = null;
			}
		}
	});
}

// Singleton instance
let _tooltipManagerInstance = null;

export function getTooltipManager() {
	if (!_tooltipManagerInstance) {
		_tooltipManagerInstance = new TooltipManager();
	}
	return _tooltipManagerInstance;
}

// Re-export rendering components for convenience
export { getReferenceResolver } from './ReferenceResolver.js';
export { getStringRenderer, getTagProcessor } from './TagProcessor.js';
