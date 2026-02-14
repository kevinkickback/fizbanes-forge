// Manages displaying and hiding D&D reference tooltips.

import { DEFAULT_SOURCE } from '../../lib/5eToolsParser.js';
import TextProcessor from '../../lib/TextProcessor.js';
import { actionService } from '../../services/ActionService.js';
import { backgroundService } from '../../services/BackgroundService.js';
import { classService } from '../../services/ClassService.js';
import { conditionService } from '../../services/ConditionService.js';
import { featService } from '../../services/FeatService.js';
import { itemService } from '../../services/ItemService.js';
import { monsterService } from '../../services/MonsterService.js';
import { optionalFeatureService } from '../../services/OptionalFeatureService.js';
import { raceService } from '../../services/RaceService.js';
import { skillService } from '../../services/SkillService.js';
import { spellService } from '../../services/SpellService.js';
import { variantRuleService } from '../../services/VariantRuleService.js';
import {
	renderAction,
	renderBackground,
	renderClass,
	renderCondition,
	renderFeat,
	renderItem,
	renderMonster,
	renderObject,
	renderOptionalFeature,
	renderRace,
	renderReward,
	renderSkill,
	renderSpell,
	renderTable,
	renderTrap,
	renderVariantRule,
	renderVehicle,
} from './StatBlockRenderer.js';


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

function _resolveReference(type, name, source = 'PHB') {
	const config = typeServiceMap[type];

	if (!config) {
		console.warn('[TooltipManager]', `Unknown reference type: ${type}`);
		return { name, error: `Unknown reference type: ${type}` };
	}

	try {
		const { service, method } = config;
		const getter = service[method];

		if (!getter || typeof getter !== 'function') {
			console.warn(
				'[TooltipManager]',
				`Service for ${type} does not have ${method} method`,
			);
			return { name, error: `Cannot resolve ${type}` };
		}

		const data = getter.call(service, name, source);

		if (!data) {
			return { name, error: `${type} not found` };
		}

		return data;
	} catch (error) {
		console.error(
			'[TooltipManager]',
			`Error resolving ${type} "${name}":`,
			error,
		);
		return { name, error: error.message };
	}
}

let tooltips = [];

_initTooltipManager();

function _initTooltipManager() {
	_setupKeyboardShortcuts();
}

function _createTooltip() {
	const container = document.createElement('div');
	container.className = 'tooltip-container u-block';
	container.style.zIndex = 10000 + tooltips.length;

	const tooltip = document.createElement('div');
	tooltip.className = 'tooltip';

	const actions = document.createElement('div');
	actions.className = 'tooltip-actions';
	actions.innerHTML = `
		<div class="tooltip-drag-handle">
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

	const openModal = document.querySelector('.modal.show');
	const appendTarget = openModal || document.body;
	appendTarget.appendChild(container);

	const tooltipObj = { container, tooltip, isPinned: false };

	actions.querySelector('.tooltip-pin-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		_togglePin(tooltipObj);
	});
	actions.querySelector('.tooltip-close-btn').addEventListener('click', (e) => {
		e.stopPropagation();
		_closeTooltip(tooltipObj);
	});

	const dragHandle = actions.querySelector('.tooltip-drag-handle');
	if (dragHandle) {
		tooltipObj.dragHandle = dragHandle;
		_makeDraggable(tooltipObj, dragHandle);
	}

	return tooltipObj;
}

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

function _togglePin(tooltipObj) {
	tooltipObj.isPinned = !tooltipObj.isPinned;
	const pinBtn = tooltipObj.tooltip.querySelector('.tooltip-pin-btn');
	const dragHandle = tooltipObj.dragHandle;

	if (tooltipObj.isPinned) {
		tooltipObj.tooltip.classList.add('pinned');
		pinBtn.classList.add('active');
		pinBtn.title = 'Unpin tooltip';
		if (dragHandle) dragHandle.classList.add('show');
	} else {
		tooltipObj.tooltip.classList.remove('pinned');
		pinBtn.classList.remove('active');
		pinBtn.title = 'Pin tooltip (Ctrl+P)';
		if (dragHandle) dragHandle.classList.remove('show');
	}
}

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

function _copyTooltipContent(tooltipObj) {
	const content = tooltipObj.tooltip.querySelector('.tooltip-content');
	if (!content) return;
	const text = content.innerText || content.textContent || '';
	navigator.clipboard.writeText(text.trim()).catch((err) => {
		console.error('[TooltipManager]', 'Failed to copy tooltip content', err);
	});
}

function _setupKeyboardShortcuts() {
	document.addEventListener('keydown', (e) => {
		const activeTooltip = tooltips[tooltips.length - 1];
		if (!activeTooltip) return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
			e.preventDefault();
			_togglePin(activeTooltip);
		}
		if (
			(e.ctrlKey || e.metaKey) &&
			e.key === 'c' &&
			!e.target.matches('input, textarea')
		) {
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

async function showReferenceTooltip(type, name, source, x, y) {
	const normalizedName = TextProcessor.normalizeForLookup(name)
		.replace(/['']/g, "'")
		.trim();
	const referenceKey = `${type}:${normalizedName}`;
	const isAlreadyOpen = tooltips.some((t) => {
		if (!t.referenceKey) return false;
		const existingKey = t.referenceKey.split(':').slice(0, 2).join(':');
		return existingKey === referenceKey;
	});
	if (isAlreadyOpen) {
		return;
	}
	try {
		const data = await _resolveReference(type, name, source);
		const content = _formatTooltip(data);
		showTooltip(x, y, content, { referenceKey });
	} catch (error) {
		console.error('[TooltipManager]', `Error showing tooltip for ${type}:`, error);
		showTooltip(
			x,
			y,
			`<strong>${name}</strong><br><small>Error loading details</small>`,
		);
	}
}

function _formatTooltip(data) {
	if (!data) {
		return '<em>No data available</em>';
	}
	if (data.error) {
		return `<strong>${data.name}</strong><br><small>${data.error}</small>`;
	}

	const entityType = _detectEntityType(data);
	const renderer = _getRenderer(entityType);
	if (renderer) {
		return renderer(data);
	}

	return _renderGenericTooltip(data);
}

function _detectEntityType(data) {
	if (data.cr !== undefined) return 'monster';
	if (data.level !== undefined && !data.hd && !data.skillProficiencies) {
		return 'spell';
	}
	if (data.hd) return 'class';
	if (data.prerequisite && !data.skillProficiencies) return 'feat';
	if (data.skillProficiencies) return 'background';
	if ((data.size || data.speed) && !data.weapon && !data.hd) return 'race';
	if (data.type || data.weapon || data.armor || data.rarity) return 'item';
	if (data.ability && typeof data.ability === 'string' && !data.hd)
		return 'skill';
	if (data.time && Array.isArray(data.time)) return 'action';
	if (data.featureType) return 'optionalfeature';
	if (
		data.type &&
		(data.type.includes('Charm') ||
			data.type.includes('Piety') ||
			data.type.includes('Blessing'))
	) {
		return 'reward';
	}
	if (data.trapHazType) return 'trap';
	if (data.vehicleType) return 'vehicle';
	if (data.ac && data.hp && !data.cr) return 'object';
	if (data.ruleType || (data.type === 'variantrule' && data.entries)) {
		return 'variantrule';
	}
	if (data.colLabels && data.rows) return 'table';
	if (data.entries) return 'condition';

	return 'generic';
}

function _getRenderer(type) {
	const renderers = {
		monster: renderMonster,
		spell: renderSpell,
		item: renderItem,
		race: renderRace,
		class: renderClass,
		feat: renderFeat,
		feature: renderOptionalFeature,
		background: renderBackground,
		skill: renderSkill,
		action: renderAction,
		optionalfeature: renderOptionalFeature,
		reward: renderReward,
		trap: renderTrap,
		vehicle: renderVehicle,
		object: renderObject,
		variantrule: renderVariantRule,
		table: renderTable,
		condition: renderCondition,
	};
	return renderers[type] || null;
}

function _renderGenericTooltip(data) {
	let html = '';
	html += `<div class="tooltip-title">${data.name || 'Unknown'}</div>`;

	if (data.source) {
		html += `<div class="tooltip-source">${data.source}</div>`;
	}

	if (data.entries && Array.isArray(data.entries)) {
		html += '<div class="tooltip-entries">';
		data.entries.forEach((entry) => {
			if (typeof entry === 'string') {
				html += `<p>${entry}</p>`;
			}
		});
		html += '</div>';
	}

	return html || `<strong>${data.name || 'Unknown'}</strong>`;
}

export function initializeTooltipListeners() {
	const activeElements = new Map();
	let currentHoverLink = null;
	const HoverSelector = '.rd__hover-link, .reference-link';
	function getHoverMeta(link) {
		if (!link) return null;
		const hoverType = link.dataset.hoverType || link.dataset.tooltipType;
		const hoverName =
			link.dataset.hoverName ||
			link.dataset.tooltipName ||
			link.textContent?.trim();
		const hoverSource =
			link.dataset.hoverSource || link.dataset.tooltipSource || DEFAULT_SOURCE;
		if (!hoverType || !hoverName) return null;
		return { hoverType, hoverName, hoverSource };
	}
	function isInTooltipSystem(element) {
		if (!element) return false;
		const inTooltip =
			element.classList?.contains('tooltip-container') ||
			element.classList?.contains('tooltip') ||
			element.closest('.tooltip-container') !== null;
		const inLink =
			element.classList?.contains('rd__hover-link') ||
			element.classList?.contains('reference-link') ||
			element.closest('.rd__hover-link') !== null ||
			element.closest('.reference-link') !== null;
		return inTooltip || inLink;
	}
	document.addEventListener('mouseover', (event) => {
		const link = event.target.closest(HoverSelector);
		const hoverMeta = getHoverMeta(link);
		if (!hoverMeta) return;
		const { hoverType, hoverName, hoverSource } = hoverMeta;
		const parentTooltip = link.closest('.tooltip-container');
		let linkTooltipIndex = -1;
		if (parentTooltip) {
			linkTooltipIndex = tooltips.findIndex(
				(t) => t.container === parentTooltip,
			);
		}
		const keepUpToIndex = linkTooltipIndex + 1;
		const newTooltipDepth = keepUpToIndex;
		const existingTooltipAtDepth = tooltips[newTooltipDepth];
		if (link === currentHoverLink && existingTooltipAtDepth) {
			return;
		}
		currentHoverLink = link;
		while (tooltips.length > keepUpToIndex) {
			const lastTooltip = tooltips[tooltips.length - 1];
			if (lastTooltip.isPinned) {
				break;
			}
			const removed = tooltips.pop();
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
				showReferenceTooltip(
					hoverType,
					hoverName,
					hoverSource,
					event.clientX,
					event.clientY,
				);
			}
			if (tooltips.length > startCount) {
				const newTooltip = tooltips[tooltips.length - 1].container;
				activeElements.set(newTooltipDepth, {
					link,
					tooltip: newTooltip,
					timeout: null,
				});
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
				const fromIndex = tooltips.findIndex(
					(t) => t.container === fromTooltip,
				);
				const toIndex = toTooltip
					? tooltips.findIndex((t) => t.container === toTooltip)
					: -1;
				if (fromIndex > toIndex) {
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
				clearTimeout(globalHideTimeout);
				globalHideTimeout = null;
			}
		}
	});
}

export { hideAllTooltips, hideTooltip, showReferenceTooltip, showTooltip };
