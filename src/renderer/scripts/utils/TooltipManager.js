
/** TooltipManager.js - Manages displaying and hiding D&D reference tooltips as a plain module. */


import { getReferenceResolver } from './ReferenceResolver.js';
import {
	renderAction,
	renderBackground,
	renderClass,
	renderCondition,
	renderFeat,
	renderItem,
	renderObject,
	renderOptionalFeature,
	renderRace,
	renderReward,
	renderSkill,
	renderSpell,
	renderTrap,
	renderVariantRule,
	renderVehicle,
} from './StatBlockRenderer.js';
import { abbreviateAbility } from './TextFormatter.js';


// Internal state
let tooltips = [];
const referenceResolver = getReferenceResolver();

// Module initialization
_initTooltipManager();

function _initTooltipManager() {
	_setupKeyboardShortcuts();
}


function _createTooltip() {
	const container = document.createElement('div');
	container.className = 'tooltip-container';
	container.style.display = 'block';
	container.style.zIndex = 10000 + tooltips.length;
	container.style.pointerEvents = 'auto';

	const tooltip = document.createElement('div');
	tooltip.className = 'tooltip';

	// Add action buttons
	const actions = document.createElement('div');
	actions.className = 'tooltip-actions';
	actions.innerHTML = `
		<div class="tooltip-drag-handle" title="Drag tooltip" style="display: none">
		    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="8" cy="6" r="1.5" />
			<circle cx="16" cy="6" r="1.5" />
			<circle cx="8" cy="12" r="1.5" />
			<circle cx="16" cy="12" r="1.5" />
			<circle cx="8" cy="18" r="1.5" />
			<circle cx="16" cy="18" r="1.5" />
		    </svg>
		</div>
		<button class="tooltip-action-btn tooltip-pin-btn" title="Pin tooltip (Ctrl+P)">
		    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 16v5M17 9v-2a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2M9 9l-4 4 4 4M15 9l4 4-4 4"/>
		    </svg>
		</button>
		<button class="tooltip-action-btn tooltip-close-btn" title="Close (Esc)">
		    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="18" y1="6" x2="6" y2="18"/>
			<line x1="6" y1="6" x2="18" y2="18"/>
		    </svg>
		</button>
	    `;

	tooltip.appendChild(actions);
	container.appendChild(tooltip);
	document.body.appendChild(container);

	const tooltipObj = { container, tooltip, isPinned: false };

	// Add event listeners to action buttons
	actions.querySelector('.tooltip-pin-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		_togglePin(tooltipObj);
	});
	actions.querySelector('.tooltip-close-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		_closeTooltip(tooltipObj);
	});

	// Allow pinned tooltips to be dragged via the drag handle
	const dragHandle = actions.querySelector('.tooltip-drag-handle');
	if (dragHandle) {
		tooltipObj.dragHandle = dragHandle;
		_makeDraggable(tooltipObj, dragHandle);
	}

	return tooltipObj;
}

/**
 * Enable dragging a tooltip when it is pinned.
 * @param {Object} tooltipObj
 * @param {HTMLElement} handleElement
 * @private
 */
function _makeDraggable(tooltipObj, handleElement) {
	let isDragging = false;
	let offsetX = 0;
	let offsetY = 0;

	const onMouseMove = (event) => {
		if (!isDragging) return;
		const rect = tooltipObj.container.getBoundingClientRect();
		const newLeft = event.clientX - offsetX;
		const newTop = event.clientY - offsetY;
		const maxLeft = Math.max(0, window.innerWidth - rect.width);
		const maxTop = Math.max(0, window.innerHeight - rect.height);
		tooltipObj.container.style.left = `${Math.min(Math.max(0, newLeft), maxLeft)}px`;
		tooltipObj.container.style.top = `${Math.min(Math.max(0, newTop), maxTop)}px`;
	};

	const onMouseUp = () => {
		if (!isDragging) return;
		isDragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	handleElement.addEventListener('mousedown', (event) => {
		// Only left-click drag on pinned tooltips; ignore clicks on interactive elements
		if (event.button !== 0) return;
		if (!tooltipObj.isPinned) return;
		if (event.target.closest('button, a')) return;

		isDragging = true;
		const rect = tooltipObj.container.getBoundingClientRect();
		offsetX = event.clientX - rect.left;
		offsetY = event.clientY - rect.top;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
		event.preventDefault();
	});
}

/**
 * Toggle pin state of tooltip
 * @param {Object} tooltipObj Tooltip object
 * @private
 */
function _togglePin(tooltipObj) {
	tooltipObj.isPinned = !tooltipObj.isPinned;
	const pinBtn = tooltipObj.tooltip.querySelector('.tooltip-pin-btn');
	const dragHandle = tooltipObj.dragHandle;

	if (tooltipObj.isPinned) {
		tooltipObj.tooltip.classList.add('pinned');
		pinBtn.classList.add('active');
		pinBtn.title = 'Unpin tooltip';
		if (dragHandle) dragHandle.style.display = 'flex';
		tooltipObj.container.style.pointerEvents = 'auto';
	} else {
		tooltipObj.tooltip.classList.remove('pinned');
		pinBtn.classList.remove('active');
		pinBtn.title = 'Pin tooltip (Ctrl+P)';
		if (dragHandle) dragHandle.style.display = 'none';
	}
}

/**
 * Copy tooltip content to clipboard
 * @param {Object} tooltipObj Tooltip object
 * @private
 */
// Copy tooltip content is disabled (button removed)
async function _copyTooltipContent() { }

/**
 * Close specific tooltip
 * @param {Object} tooltipObj Tooltip object
 * @private
 */
function _closeTooltip(tooltipObj) {
	const index = tooltips.indexOf(tooltipObj);
	if (index !== -1) {
		tooltips.splice(index, 1);
	}
	tooltipObj.tooltip.classList.remove('show');
	tooltipObj.tooltip.classList.add('hide');
	setTimeout(() => {
		if (tooltipObj.container.parentNode) {
			tooltipObj.container.parentNode.removeChild(tooltipObj.container);
		}
	}, 200);
}

/**
 * Show tooltip at position with data
 * @param {number} x X coordinate
 * @param {number} y Y coordinate
 * @param {string} content Content to display
 * @param {Object} options Additional options
 */
function showTooltip(x, y, content, options = {}) {
	const tooltipObj = _createTooltip();
	const contentWrapper = document.createElement('div');
	contentWrapper.innerHTML = content;
	tooltipObj.tooltip.appendChild(contentWrapper);
	tooltipObj.tooltip.classList.add('show');
	if (options.referenceKey && !options.isCircular) {
		tooltipObj.referenceKey = options.referenceKey;
	}
	tooltips.push(tooltipObj);
	requestAnimationFrame(() => {
		const tooltipRect = tooltipObj.tooltip.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		let left = x + 10;
		let top = y + 10;
		if (left + tooltipRect.width > viewportWidth) {
			left = x - tooltipRect.width - 10;
			if (left < 0) {
				left = viewportWidth - tooltipRect.width - 10;
			}
		}
		if (top + tooltipRect.height > viewportHeight) {
			top = y - tooltipRect.height - 10;
			if (top < 0) {
				top = viewportHeight - tooltipRect.height - 10;
			}
		}
		left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
		top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
		tooltipObj.container.style.left = `${left}px`;
		tooltipObj.container.style.top = `${top}px`;
	});
}

/**
 * Hide the most recent tooltip (unless pinned)
 */
function hideTooltip() {
	if (tooltips.length === 0) return;
	for (let i = tooltips.length - 1; i >= 0; i--) {
		const tooltipObj = tooltips[i];
		if (!tooltipObj.isPinned) {
			_closeTooltip(tooltipObj);
			return;
		}
	}
}

/**
 * Hide all tooltips (including pinned)
 */
function hideAllTooltips() {
	const tooltipsToClose = [...tooltips];
	tooltips = [];
	tooltipsToClose.forEach((tooltipObj) => {
		tooltipObj.tooltip.classList.remove('show');
		tooltipObj.tooltip.classList.add('hide');
		setTimeout(() => {
			if (tooltipObj.container.parentNode) {
				tooltipObj.container.parentNode.removeChild(tooltipObj.container);
			}
		}, 200);
	});
}

/**
 * Setup keyboard shortcuts for tooltips
 * @private
 */
function _setupKeyboardShortcuts() {
	document.addEventListener('keydown', (e) => {
		const activeTooltip = tooltips[tooltips.length - 1];
		if (!activeTooltip) return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
			e.preventDefault();
			_togglePin(activeTooltip);
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('input, textarea')) {
			const selection = window.getSelection();
			if (!selection || selection.toString().length === 0) {
				e.preventDefault();
				_copyTooltipContent(activeTooltip);
			}
		}
		if (e.key === 'Escape') {
			if (activeTooltip.isPinned) {
				_closeTooltip(activeTooltip);
			} else {
				hideTooltip();
			}
		}
	});
}

/**
 * Load and display tooltip for a reference
 * @param {string} type Reference type (spell, item, etc)
 * @param {string} name Reference name
 * @param {string} source Source abbreviation
 * @param {number} x X coordinate
 * @param {number} y Y coordinate
 */
async function showReferenceTooltip(type, name, source, x, y) {
	if (!referenceResolver) {
		showTooltip(x, y, `<strong>${name}</strong>`);
		return;
	}
	console.info('TooltipSystem', `[showReferenceTooltip] type:`, type, 'name:', name, 'source:', source);
	// Normalize name for reference lookup: lowercase and standardize apostrophes
	// This is used for case-insensitive lookups in the reference resolver
	const normalizedName = name.toLowerCase().replace(/['']/g, "'").trim();
	const referenceKey = `${type}:${normalizedName}`;
	const isAlreadyOpen = tooltips.some((t) => {
		if (!t.referenceKey) return false;
		const existingKey = t.referenceKey.split(':').slice(0, 2).join(':');
		console.info('TooltipSystem', `Comparing "${referenceKey}" with "${existingKey}"`);
		return existingKey === referenceKey;
	});
	if (isAlreadyOpen) {
		console.info('TooltipSystem', `Circular reference detected: ${type} - ${name} is already open in the chain, ignoring hover`);
		return;
	}
	try {
		console.info('TooltipSystem', `[Loading ${type}: ${name} (${source})]`);
		let data = null;
		switch (type) {
			case 'spell': data = await referenceResolver.resolveSpell(name, source); break;
			case 'item': data = await referenceResolver.resolveItem(name, source); break;
			case 'condition': data = await referenceResolver.resolveCondition(name); break;
			case 'monster': data = await referenceResolver.resolveMonster(name, source); break;
			case 'class': data = await referenceResolver.resolveClass(name, source); break;
			case 'race': data = await referenceResolver.resolveRace(name, source); break;
			case 'feat': data = await referenceResolver.resolveFeat(name, source); break;
			case 'background': data = await referenceResolver.resolveBackground(name, source); break;
			case 'skill': data = await referenceResolver.resolveSkill(name); break;
			case 'action': data = await referenceResolver.resolveAction(name); break;
			case 'creature': data = await referenceResolver.resolveMonster(name, source); break;
			case 'optionalfeature': data = await referenceResolver.resolveOptionalFeature(name); break;
			case 'reward': data = await referenceResolver.resolveReward(name); break;
			case 'trap': case 'hazard': data = await referenceResolver.resolveTrap(name); break;
			case 'vehicle': data = await referenceResolver.resolveVehicle(name); break;
			case 'object': data = await referenceResolver.resolveObject(name); break;
			case 'variantrule': data = await referenceResolver.resolveVariantRule(name); break;
			default: data = { name, type };
		}
		console.info('TooltipSystem', `[showReferenceTooltip] resolver result:`, data);
		const content = _formatTooltip(data);
		console.info('TooltipSystem', `Resolved ${type}: ${name}`, data);
		showTooltip(x, y, content, { referenceKey });
	} catch (error) {
		console.error(`[TooltipSystem] Error showing tooltip for ${type}:`, error);
		showTooltip(x, y, `<strong>${name}</strong><br><small>Error loading details</small>`);
	}
}

/**
 * Format tooltip content from data
 */
function _formatTooltip(data) {
	if (!data) {
		return '<em>No data available</em>';
	}
	if (data.error) {
		return `<strong>${data.name}</strong><br><small>${data.error}</small>`;
	}
	if (data.level !== undefined) {
		return renderSpell(data);
	}
	if (data.type || data.weapon || data.armor || data.rarity) {
		return renderItem(data);
	}
	if ((data.size || data.speed) && !data.weapon && !data.hd) {
		return renderRace(data);
	}
	if (data.hd) {
		return renderClass(data);
	}
	if (data.prerequisite) {
		return renderFeat(data);
	}
	if (data.skillProficiencies) {
		return renderBackground(data);
	}
	if (
		data.ability &&
		typeof data.ability === 'string' &&
		!data.hd &&
		data.level === undefined
	) {
		return renderSkill(data);
	}
	if (data.time && Array.isArray(data.time)) {
		return renderAction(data);
	}
	if (data.featureType) {
		return renderOptionalFeature(data);
	}
	if (
		data.type &&
		(data.type.includes('Charm') ||
			data.type.includes('Piety') ||
			data.type.includes('Blessing'))
	) {
		return renderReward(data);
	}
	if (data.trapHazType) {
		return renderTrap(data);
	}
	if (data.vehicleType) {
		return renderVehicle(data);
	}
	if (data.ac && data.hp && !data.cr) {
		return renderObject(data);
	}
	if (data.ruleType || (data.type === 'variantrule' && data.entries)) {
		return renderVariantRule(data);
	}
	if (data.entries) {
		return renderCondition(data);
	}
	let html = '';
	html += `<div class="tooltip-title">${data.name || 'Unknown'}</div>`;
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
							return `${abbreviateAbility(key)} ${val > 0 ? '+' : ''}${val}`;
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
	return html;
}


/**
 * Initialize tooltip event listeners for all hover links
 */
export function initializeTooltipListeners() {
	console.info('TooltipSystem', 'Initializing event listeners');
	const activeElements = new Map();
	let currentHoverLink = null;
	const HOVER_SELECTOR = '.rd__hover-link, .reference-link';
	function getHoverMeta(link) {
		if (!link) return null;
		const hoverType = link.dataset.hoverType || link.dataset.tooltipType;
		const hoverName = link.dataset.hoverName || link.dataset.tooltipName || link.textContent?.trim();
		const hoverSource = link.dataset.hoverSource || link.dataset.tooltipSource || 'PHB';
		if (!hoverType || !hoverName) return null;
		return { hoverType, hoverName, hoverSource };
	}
	function isInTooltipSystem(element) {
		if (!element) return false;
		const inTooltip = element.classList?.contains('tooltip-container') || element.classList?.contains('tooltip') || element.closest('.tooltip-container') !== null;
		const inLink = element.classList?.contains('rd__hover-link') || element.classList?.contains('reference-link') || element.closest('.rd__hover-link') !== null || element.closest('.reference-link') !== null;
		return inTooltip || inLink;
	}
	document.addEventListener('mouseover', (event) => {
		const link = event.target.closest(HOVER_SELECTOR);
		const hoverMeta = getHoverMeta(link);
		if (!hoverMeta) return;
		const { hoverType, hoverName, hoverSource } = hoverMeta;
		const parentTooltip = link.closest('.tooltip-container');
		let linkTooltipIndex = -1;
		if (parentTooltip) {
			linkTooltipIndex = tooltips.findIndex((t) => t.container === parentTooltip);
		}
		const keepUpToIndex = linkTooltipIndex + 1;
		const newTooltipDepth = keepUpToIndex;
		const existingTooltipAtDepth = tooltips[newTooltipDepth];
		if (link === currentHoverLink && existingTooltipAtDepth) {
			return;
		}
		currentHoverLink = link;
		console.info('TooltipSystem', `Hovering over: ${hoverType} - ${hoverName}`);
		if (parentTooltip) {
			console.info('TooltipSystem', `Link is in tooltip at index: ${linkTooltipIndex}`);
		} else {
			console.info('TooltipSystem', 'Link is not in a tooltip (base level)');
		}
		console.info('TooltipSystem', `Current stack size: ${tooltips.length}, keeping up to index: ${keepUpToIndex}`);
		while (tooltips.length > keepUpToIndex) {
			const lastTooltip = tooltips[tooltips.length - 1];
			if (lastTooltip.isPinned) {
				console.info('TooltipSystem', `Stopped removing at pinned tooltip index ${tooltips.length - 1}`);
				break;
			}
			const removed = tooltips.pop();
			console.info('TooltipSystem', `Removing tooltip at index ${tooltips.length}`);
			if (removed.container.parentNode) {
				removed.container.parentNode.removeChild(removed.container);
			}
		}
		activeElements.forEach((value, depth) => {
			if (depth >= newTooltipDepth && value.timeout) {
				clearTimeout(value.timeout);
			}
		});
		if (hoverType && hoverName) {
			const startCount = tooltips.length;
			const inlineContent = link.dataset.hoverContent;
			if (inlineContent && (hoverType === 'trait' || hoverType === 'feature')) {
				const typeLabel = hoverType === 'trait' ? 'Racial Trait' : 'Feature';
				const html = `
					<div class="tooltip-content" data-type="${hoverType}">
						<div class="tooltip-title">${hoverName}</div>
						<div class="tooltip-metadata">${typeLabel}</div>
						<div class="tooltip-description">
							<p>${inlineContent}</p>
						</div>
					</div>
				`;
				showTooltip(event.clientX, event.clientY, html);
			} else {
				showReferenceTooltip(hoverType, hoverName, hoverSource, event.clientX, event.clientY);
			}
			if (tooltips.length > startCount) {
				const newTooltip = tooltips[tooltips.length - 1].container;
				activeElements.set(newTooltipDepth, { link, tooltip: newTooltip, timeout: null });
				console.info('TooltipSystem', `Added tooltip at depth ${newTooltipDepth}, stack size now: ${tooltips.length}`);
			}
		}
	});

	let globalHideTimeout = null;
	document.addEventListener('mouseout', (event) => {
		const fromElement = event.target;
		const toElement = event.relatedTarget;
		if (isInTooltipSystem(fromElement) && isInTooltipSystem(toElement)) {
			const fromTooltip = fromElement.closest('.tooltip-container');
			const toTooltip = toElement.closest('.tooltip-container');
			if (fromTooltip && fromTooltip !== toTooltip) {
				const fromIndex = tooltips.findIndex((t) => t.container === fromTooltip);
				const toIndex = toTooltip ? tooltips.findIndex((t) => t.container === toTooltip) : -1;
				if (fromIndex > toIndex) {
					console.info('TooltipSystem', `Moving from tooltip ${fromIndex} to ${toIndex}, removing deeper tooltips`);
					const keepUpToIndex = toIndex + 1;
					setTimeout(() => {
						while (tooltips.length > keepUpToIndex) {
							const lastTooltip = tooltips[tooltips.length - 1];
							if (lastTooltip.isPinned) {
								break;
							}
							const removed = tooltips.pop();
							removed.tooltip.classList.remove('show');
							removed.tooltip.classList.add('hide');
							setTimeout(() => {
								if (removed.container.parentNode) {
									removed.container.parentNode.removeChild(removed.container);
								}
							}, 200);
						}
					}, 150);
				}
			}
			return;
		}
		if (isInTooltipSystem(fromElement) && !isInTooltipSystem(toElement)) {
			console.info('TooltipSystem', 'Left tooltip system, hiding unpinned tooltips');
			globalHideTimeout = setTimeout(() => {
				currentHoverLink = null;
				activeElements.clear();
				for (let i = tooltips.length - 1; i >= 0; i--) {
					const tooltip = tooltips[i];
					if (!tooltip.isPinned) {
						tooltips.splice(i, 1);
						tooltip.tooltip.classList.remove('show');
						tooltip.tooltip.classList.add('hide');
						setTimeout(() => {
							if (tooltip.container.parentNode) {
								tooltip.container.parentNode.removeChild(tooltip.container);
							}
						}, 200);
					}
				}
				globalHideTimeout = null;
			}, 300);
		}
	});
	document.addEventListener('mouseover', (event) => {
		const enteringElement = event.target;
		if (isInTooltipSystem(enteringElement)) {
			if (globalHideTimeout) {
				console.info('TooltipSystem', 'Canceling hide timer');
				clearTimeout(globalHideTimeout);
				globalHideTimeout = null;
			}
		}
	});
}

/**
 * Convenience initializer for pages that use either @tags (rd__hover-link)
 * or legacy `.reference-link` spans with data-tooltip-* attributes.
 * Adds the necessary listeners and upgrades spans to behave like hover links.
 * @param {ParentNode} [root=document]
 * @returns {{tooltipManager: TooltipManager, upgraded: Element[]}}
 */
export function initializeTooltips(root = document) {
	initializeTooltipListeners();
	const upgraded = [];
	if (root?.querySelectorAll) {
		root.querySelectorAll('.reference-link').forEach((link) => {
			// Add rd__hover-link class for styling/compatibility
			if (!link.classList.contains('rd__hover-link')) {
				link.classList.add('rd__hover-link');
			}
			// Copy data-tooltip-type/name to data-hover-type/name if not present
			if (!link.hasAttribute('data-hover-type') && link.hasAttribute('data-tooltip-type')) {
				link.setAttribute('data-hover-type', link.getAttribute('data-tooltip-type'));
			}
			if (!link.hasAttribute('data-hover-name') && link.hasAttribute('data-tooltip-name')) {
				link.setAttribute('data-hover-name', link.getAttribute('data-tooltip-name'));
			}
			if (!link.hasAttribute('data-hover-source') && link.hasAttribute('data-tooltip-source')) {
				link.setAttribute('data-hover-source', link.getAttribute('data-tooltip-source'));
			}
			upgraded.push(link);
		});
	}
	return { upgraded };
}


// Exported API (functional, no singleton)
export { getReferenceResolver } from './ReferenceResolver.js';
export { getStringRenderer } from './TagProcessor.js';
export { hideAllTooltips, hideTooltip, showReferenceTooltip, showTooltip };
