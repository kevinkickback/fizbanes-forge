/** StatBlockRenderer.js - Renders enhanced stat blocks for tooltips (5etools-inspired). */

import { getOrdinalForm, getSpeedString, sizeAbvToFull } from './5eToolsParser.js';
import { getAbilityData } from './AbilityScoreUtils.js';
import { Renderer5etools } from './Renderer5etools.js';

/**
 * Render a spell stat block
 * @param {Object} spell Spell data
 * @returns {string} HTML
 */
export function renderSpell(spell) {
	if (!spell || spell.error) {
		return `<strong>${spell?.name || 'Unknown'}</strong><br><small>${spell?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="spell">`;

	// Title and level
	const levelText =
		spell.level === 0 ? 'Cantrip' : `${getOrdinalForm(spell.level)}-level`;
	const schoolText = spell.school ? ` ${_getSchoolName(spell.school)}` : '';
	const ritualText = spell.ritual ? ' (ritual)' : '';

	html += `<div class="tooltip-title">${spell.name}</div>`;
	html += `<div class="tooltip-metadata">${levelText}${schoolText}${ritualText}</div>`;

	// Casting details grid
	if (spell.time || spell.range || spell.components || spell.duration) {
		html += '<div class="tooltip-casting-details">';

		if (spell.time?.[0]) {
			const time = spell.time[0];
			const timeText = `${time.number || 1} ${time.unit || 'action'}`;
			html += `<strong>Casting Time:</strong><span>${timeText}</span>`;
		}

		if (spell.range) {
			const rangeText = _getRangeText(spell.range);
			html += `<strong>Range:</strong><span>${rangeText}</span>`;
		}

		if (spell.components) {
			const compText = _getComponentsText(spell.components);
			html += `<strong>Components:</strong><span>${compText}</span>`;
		}

		if (spell.duration?.[0]) {
			const durText = _getDurationText(spell.duration[0]);
			html += `<strong>Duration:</strong><span>${durText}</span>`;
		}

		html += '</div>';
	}

	// Description
	html += _renderEntries(spell.entries);

	// At higher levels
	if (spell.entriesHigherLevel && spell.entriesHigherLevel.length > 0) {
		html += '<div class="tooltip-section">';
		html += _renderEntries(spell.entriesHigherLevel);
		html += '</div>';
	}

	// Source
	html += _renderSource(spell);
	html += '</div>';

	return html;
}

/**
 * Render an item stat block
 * @param {Object} item Item data
 * @returns {string} HTML
 */
export function renderItem(item) {
	if (!item || item.error) {
		return `<strong>${item?.name || 'Unknown'}</strong><br><small>${item?.error || 'No data'}</small>`;
	}

	const rarityClass = item.rarity
		? `rarity-${item.rarity.toLowerCase().replace(/\s+/g, '-')}`
		: '';
	let html = `<div class="tooltip-content" data-type="item">`;

	// Title
	html += `<div class="tooltip-title">${item.name}</div>`;

	// Type and rarity
	let typeText = '';
	if (item.typeText) {
		typeText = item.typeText;
	} else if (item.type) {
		typeText = item.type;
		if (item.weaponCategory) {
			typeText = `${item.weaponCategory} weapon`;
		}
		if (item.armor) {
			typeText = `${item.type} armor`;
		}
	}

	if (typeText) {
		html += `<div class="item-type">${typeText}</div>`;
	}

	if (item.rarity && item.rarity !== 'none' && item.rarity !== 'unknown') {
		const attunementText = item.reqAttune ? ' (requires attunement)' : '';
		html += `<div class="item-rarity ${rarityClass}">${item.rarity}${attunementText}</div>`;
	}

	// Weapon details
	if (item.weapon) {
		html += '<div class="tooltip-metadata">';
		if (item.dmg1) {
			let dmgText = `<strong>Damage:</strong> ${item.dmg1}`;
			if (item.dmgType) {
				dmgText += ` ${item.dmgType}`;
			}
			if (item.dmg2) {
				dmgText += ` (${item.dmg2} versatile)`;
			}
			html += `${dmgText}<br>`;
		}
		if (item.property && item.property.length > 0) {
			html += `<strong>Properties:</strong> ${item.property.join(', ')}<br>`;
		}
		if (item.range) {
			html += `<strong>Range:</strong> ${item.range}<br>`;
		}
		html += '</div>';
	}

	// Armor details
	if (item.armor || item.ac) {
		html += '<div class="tooltip-metadata">';
		if (item.ac) {
			html += `<strong>AC:</strong> ${item.ac}<br>`;
		}
		if (item.strength) {
			html += `<strong>Strength Required:</strong> ${item.strength}<br>`;
		}
		if (item.stealth) {
			html += `<strong>Stealth:</strong> Disadvantage<br>`;
		}
		html += '</div>';
	}

	// Weight and value
	if (item.weight || item.value) {
		html += '<div class="tooltip-properties">';
		const parts = [];
		if (item.weight) parts.push(`${item.weight} lb.`);
		if (item.value) parts.push(`${item.value / 100} gp`);
		html += parts.join(', ');
		html += '</div>';
	}

	// Description
	if (item.entries) {
		html += _renderEntries(item.entries);
	}

	// Source
	html += _renderSource(item);
	html += '</div>';

	return html;
}

/**
 * Render a race stat block
 * @param {Object} race Race data
 * @returns {string} HTML
 */
export function renderRace(race) {
	if (!race || race.error) {
		return `<strong>${race?.name || 'Unknown'}</strong><br><small>${race?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="race">`;

	// Title
	html += `<div class="tooltip-title">${race.name}</div>`;

	// Core traits
	html += '<div class="tooltip-metadata">';

	if (race.size) {
		const sizeText = Array.isArray(race.size)
			? race.size.map((sz) => sizeAbvToFull(sz)).join('/')
			: sizeAbvToFull(race.size);
		html += `<strong>Size:</strong> ${sizeText}<br>`;
	}

	if (race.speed) {
		const speedText = getSpeedString(race);
		html += `<strong>Speed:</strong> ${speedText}<br>`;
	}

	// Ability Score Increases
	if (race.ability && Array.isArray(race.ability)) {
		const abilities = _getAbilityScoreText(race.ability);
		if (abilities) {
			html += `<strong>Ability Score Increase:</strong> ${abilities}<br>`;
		}
	}

	html += '</div>';

	// Description
	if (race.entries) {
		html += _renderEntries(race.entries);
	}

	// Source
	html += _renderSource(race);
	html += '</div>';

	return html;
}

/**
 * Render a class stat block
 * @param {Object} cls Class data
 * @returns {string} HTML
 */
export function renderClass(cls) {
	if (!cls || cls.error) {
		return `<strong>${cls?.name || 'Unknown'}</strong><br><small>${cls?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="class">`;

	// Title
	html += `<div class="tooltip-title">${cls.name}</div>`;

	// Core stats
	html += '<div class="tooltip-metadata">';

	if (cls.hd) {
		html += `<strong>Hit Die:</strong> d${cls.hd.faces}<br>`;
	}

	// Primary ability
	if (cls.spellcastingAbility) {
		html += `<strong>Primary Ability:</strong> ${cls.spellcastingAbility.toUpperCase()}<br>`;
	}

	// Saving throws
	if (cls.proficiency && Array.isArray(cls.proficiency)) {
		const saves = cls.proficiency.map((p) => p.toUpperCase()).join(', ');
		html += `<strong>Saving Throws:</strong> ${saves}<br>`;
	}

	html += '</div>';

	// Starting proficiencies summary (brief)
	if (cls.startingProficiencies) {
		html += '<div class="tooltip-section">';
		html += '<strong>Proficiencies:</strong> ';
		const profParts = [];
		if (cls.startingProficiencies.armor) {
			profParts.push('Armor');
		}
		if (cls.startingProficiencies.weapons) {
			profParts.push('Weapons');
		}
		if (cls.startingProficiencies.skills) {
			profParts.push('Skills');
		}
		html += profParts.join(', ');
		html += '</div>';
	}

	// Quick description
	if (cls.entries && cls.entries.length > 0) {
		html += '<div class="tooltip-description">';
		const firstEntry = cls.entries[0];
		if (typeof firstEntry === 'string') {
			const shortDesc =
				firstEntry.length > 150
					? `${firstEntry.substring(0, 150)}...`
					: firstEntry;
			html += renderString(shortDesc);
		} else if (firstEntry.entries) {
			const text = firstEntry.entries[0];
			if (typeof text === 'string') {
				const shortDesc =
					text.length > 150 ? `${text.substring(0, 150)}...` : text;
				html += Renderer5etools.processString(shortDesc);
			}
		}
		html += '</div>';
	}

	// Source
	html += _renderSource(cls);
	html += '</div>';

	return html;
}

/**
 * Render a feat stat block
 * @param {Object} feat Feat data
 * @returns {string} HTML
 */
export function renderFeat(feat) {
	if (!feat || feat.error) {
		return `<strong>${feat?.name || 'Unknown'}</strong><br><small>${feat?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="feat">`;

	// Title
	html += `<div class="tooltip-title">${feat.name}</div>`;

	// Prerequisites
	if (feat.prerequisite) {
		html += '<div class="tooltip-metadata">';
		html += `<strong>Prerequisite:</strong> ${_formatPrerequisite(feat.prerequisite)}<br>`;
		html += '</div>';
	}

	// Description
	if (feat.entries) {
		html += _renderEntries(feat.entries);
	}

	// Source
	html += _renderSource(feat);
	html += '</div>';

	return html;
}

/**
 * Render a background stat block
 * @param {Object} background Background data
 * @returns {string} HTML
 */
export function renderBackground(background) {
	if (!background || background.error) {
		return `<strong>${background?.name || 'Unknown'}</strong><br><small>${background?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="background">`;

	// Title
	html += `<div class="tooltip-title">${background.name}</div>`;

	// Skill proficiencies
	if (background.skillProficiencies) {
		html += '<div class="tooltip-metadata">';
		html += '<strong>Skill Proficiencies:</strong> ';
		const skills = [];
		for (const [skill, value] of Object.entries(
			background.skillProficiencies,
		)) {
			if (value === true) {
				skills.push(skill);
			}
		}
		html += skills.join(', ');
		html += '<br></div>';
	}

	// Description
	if (background.entries) {
		html += _renderEntries(background.entries, 3); // Limit to 3 entries for backgrounds
	}

	// Source
	html += _renderSource(background);
	html += '</div>';

	return html;
}

/**
 * Render a condition stat block
 * @param {Object} condition Condition data
 * @returns {string} HTML
 */
export function renderCondition(condition) {
	if (!condition || condition.error) {
		return `<strong>${condition?.name || 'Unknown'}</strong><br><small>${condition?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="condition">`;

	// Title
	html += `<div class="tooltip-title">${condition.name}</div>`;

	// Description
	if (condition.entries) {
		html += _renderEntries(condition.entries);
	}

	// Source
	html += _renderSource(condition);
	html += '</div>';

	return html;
}

/**
 * Render a skill stat block
 * @param {Object} skill Skill data
 * @returns {string} HTML
 */
export function renderSkill(skill) {
	if (!skill || skill.error) {
		return `<strong>${skill?.name || 'Unknown'}</strong><br><small>${skill?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="skill">`;

	// Title
	html += `<div class="tooltip-title">${skill.name}</div>`;

	// Ability
	if (skill.ability) {
		html += `<div class="tooltip-metadata"><strong>Ability:</strong> ${skill.ability.toUpperCase()}</div>`;
	}

	// Description
	if (skill.entries) {
		html += _renderEntries(skill.entries);
	}

	// Source
	html += _renderSource(skill);
	html += '</div>';

	return html;
}

/**
 * Render an action stat block
 * @param {Object} action Action data
 * @returns {string} HTML
 */
export function renderAction(action) {
	if (!action || action.error) {
		return `<strong>${action?.name || 'Unknown'}</strong><br><small>${action?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="action">`;

	// Title
	html += `<div class="tooltip-title">${action.name}</div>`;

	// Time
	if (action.time && Array.isArray(action.time)) {
		html += '<div class="tooltip-metadata">';
		const timeStr = action.time
			.map((t) => `${t.number || 1} ${t.unit}`)
			.join(', ');
		html += `<strong>Time:</strong> ${timeStr}<br>`;
		html += '</div>';
	}

	// Description
	if (action.entries) {
		html += _renderEntries(action.entries);
	}

	// Source
	html += _renderSource(action);
	html += '</div>';

	return html;
}

/**
 * Render an optional feature stat block
 * @param {Object} feature Optional feature data
 * @returns {string} HTML
 */
export function renderOptionalFeature(feature) {
	if (!feature || feature.error) {
		return `<strong>${feature?.name || 'Unknown'}</strong><br><small>${feature?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="optionalfeature">`;

	// Title
	html += `<div class="tooltip-title">${feature.name}</div>`;

	// Feature type
	if (feature.featureType && Array.isArray(feature.featureType)) {
		html += '<div class="tooltip-metadata">';
		html += `<strong>Type:</strong> ${feature.featureType.join(', ')}<br>`;
		html += '</div>';
	}

	// Prerequisites
	if (feature.prerequisite) {
		html += '<div class="tooltip-metadata">';
		html += `<strong>Prerequisite:</strong> ${_formatPrerequisite(feature.prerequisite)}<br>`;
		html += '</div>';
	}

	// Description
	if (feature.entries) {
		html += _renderEntries(feature.entries);
	}

	// Source
	html += _renderSource(feature);
	html += '</div>';

	return html;
}

/**
 * Render a reward stat block
 * @param {Object} reward Reward data
 * @returns {string} HTML
 */
export function renderReward(reward) {
	if (!reward || reward.error) {
		return `<strong>${reward?.name || 'Unknown'}</strong><br><small>${reward?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="reward">`;

	// Title
	html += `<div class="tooltip-title">${reward.name}</div>`;

	// Type
	if (reward.type) {
		html += `<div class="tooltip-metadata"><strong>Type:</strong> ${reward.type}</div>`;
	}

	// Description
	if (reward.entries) {
		html += _renderEntries(reward.entries);
	}

	// Source
	html += _renderSource(reward);
	html += '</div>';

	return html;
}

/**
 * Render a trap/hazard stat block
 * @param {Object} trap Trap data
 * @returns {string} HTML
 */
export function renderTrap(trap) {
	if (!trap || trap.error) {
		return `<strong>${trap?.name || 'Unknown'}</strong><br><small>${trap?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="trap">`;

	// Title
	html += `<div class="tooltip-title">${trap.name}</div>`;

	// Type and threat
	html += '<div class="tooltip-metadata">';
	if (trap.trapHazType) {
		const typeMap = {
			MECH: 'Mechanical',
			SMPL: 'Simple',
			CMPX: 'Complex',
			TRP: 'Trap',
			HAZ: 'Hazard',
		};
		html += `<strong>Type:</strong> ${typeMap[trap.trapHazType] || trap.trapHazType}<br>`;
	}
	if (trap.rating?.[0]) {
		const rating = trap.rating[0];
		html += `<strong>Threat:</strong> ${rating.threat || ''} (Tier ${rating.tier || '?'})<br>`;
	}
	html += '</div>';

	// Trigger
	if (trap.trigger && Array.isArray(trap.trigger)) {
		html += '<div class="tooltip-section">';
		html += '<strong>Trigger:</strong> ';
		html += trap.trigger.join(' ');
		html += '</div>';
	}

	// Description
	if (trap.entries) {
		html += _renderEntries(trap.entries, 3);
	}

	// Source
	html += _renderSource(trap);
	html += '</div>';

	return html;
}

/**
 * Render a vehicle stat block
 * @param {Object} vehicle Vehicle data
 * @returns {string} HTML
 */
export function renderVehicle(vehicle) {
	if (!vehicle || vehicle.error) {
		return `<strong>${vehicle?.name || 'Unknown'}</strong><br><small>${vehicle?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="vehicle">`;

	// Title
	html += `<div class="tooltip-title">${vehicle.name}</div>`;

	// Type and size
	html += '<div class="tooltip-metadata">';
	if (vehicle.vehicleType) {
		html += `<strong>Type:</strong> ${vehicle.vehicleType}<br>`;
	}
	if (vehicle.size) {
		html += `<strong>Size:</strong> ${vehicle.size}<br>`;
	}
	if (vehicle.speed) {
		html += `<strong>Speed:</strong> ${vehicle.speed}<br>`;
	}
	html += '</div>';

	// Description
	if (vehicle.entries) {
		html += _renderEntries(vehicle.entries, 3);
	}

	// Source
	html += _renderSource(vehicle);
	html += '</div>';

	return html;
}

/**
 * Render a monster stat block (lightweight summary)
 * @param {Object} monster Monster data
 * @returns {string} HTML
 */
export function renderMonster(monster) {
	if (!monster || monster.error) {
		return `<strong>${monster?.name || 'Unknown'}</strong><br><small>${monster?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="monster">`;

	// Title and basic meta
	html += `<div class="tooltip-title">${monster.name}</div>`;
	const typeText = monster.type ? (typeof monster.type === 'string' ? monster.type : monster.type.type || '') : '';
	const crText = monster.cr !== undefined ? `CR ${Array.isArray(monster.cr) ? monster.cr[0] : monster.cr}` : '';
	const sizeText = monster.size ? sizeAbvToFull(monster.size) : '';
	const metaParts = [typeText, sizeText, crText].filter(Boolean);
	if (metaParts.length) {
		html += `<div class="tooltip-metadata">${metaParts.join(' · ')}</div>`;
	}

	// Defensive stats
	if (monster.ac || monster.hp || monster.speed) {
		html += '<div class="tooltip-metadata">';
		if (monster.ac) html += `<strong>AC:</strong> ${Array.isArray(monster.ac) ? monster.ac[0].ac || monster.ac[0] : monster.ac}<br>`;
		if (monster.hp) html += `<strong>HP:</strong> ${monster.hp.average || monster.hp.formula || monster.hp}<br>`;
		if (monster.speed) html += `<strong>Speed:</strong> ${getSpeedString(monster.speed)}<br>`;
		html += '</div>';
	}

	// Ability scores (if present)
	if (monster.str || monster.dex || monster.con || monster.int || monster.wis || monster.cha) {
		html += '<div class="tooltip-abilities">';
		const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
		for (const ab of abilities) {
			if (monster[ab] !== undefined) {
				html += `<span><strong>${ab.toUpperCase()}:</strong> ${monster[ab]}</span>`;
			}
		}
		html += '</div>';
	}

	// Description/entries
	if (monster.entries) {
		html += _renderEntries(monster.entries, 3);
	}

	// Source
	html += _renderSource(monster);
	html += '</div>';

	return html;
}

/**
 * Render a table tooltip
 * @param {Object} table Table data
 * @returns {string} HTML
 */
export function renderTable(table) {
	if (!table || table.error) {
		return `<strong>${table?.name || 'Unknown'}</strong><br><small>${table?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="table">`;
	html += `<div class="tooltip-title">${table.name || 'Table'}</div>`;

	const headers = Array.isArray(table.colLabels) ? table.colLabels : [];
	const rows = Array.isArray(table.rows) ? table.rows : [];

	if (headers.length || rows.length) {
		html += '<div class="tooltip-table-wrapper">';
		html += '<table class="tooltip-table">';
		if (headers.length) {
			html += `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
		}
		if (rows.length) {
			html += '<tbody>';
			for (const row of rows) {
				const cells = Array.isArray(row)
					? row
					: Array.isArray(row.cells)
						? row.cells
						: Array.isArray(row.row)
							? row.row
							: [];
				html += `<tr>${cells
					.map((c) => `<td>${typeof c === 'string' ? c : c?.entry || c?.label || c?.roll || ''}</td>`)
					.join('')}</tr>`;
			}
			html += '</tbody>';
		}
		html += '</table>';
		html += '</div>';
	}

	// Fallback entries if present
	if (table.entries) {
		html += _renderEntries(table.entries, 3);
	}

	// Source
	html += _renderSource(table);
	html += '</div>';

	return html;
}

/**
 * Render an object stat block
 * @param {Object} obj Object data
 * @returns {string} HTML
 */
export function renderObject(obj) {
	if (!obj || obj.error) {
		return `<strong>${obj?.name || 'Unknown'}</strong><br><small>${obj?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="object">`;

	// Title
	html += `<div class="tooltip-title">${obj.name}</div>`;

	// Stats
	html += '<div class="tooltip-metadata">';
	if (obj.size) {
		html += `<strong>Size:</strong> ${obj.size}<br>`;
	}
	if (obj.ac) {
		html += `<strong>AC:</strong> ${obj.ac}<br>`;
	}
	if (obj.hp) {
		html += `<strong>HP:</strong> ${obj.hp}<br>`;
	}
	html += '</div>';

	// Description
	if (obj.entries) {
		html += _renderEntries(obj.entries, 3);
	}

	// Source
	html += _renderSource(obj);
	html += '</div>';

	return html;
}

/**
 * Render a variant rule stat block
 * @param {Object} rule Variant rule data
 * @returns {string} HTML
 */
export function renderVariantRule(rule) {
	if (!rule || rule.error) {
		return `<strong>${rule?.name || 'Unknown'}</strong><br><small>${rule?.error || 'No data'}</small>`;
	}

	let html = `<div class="tooltip-content" data-type="variantrule">`;

	// Title
	html += `<div class="tooltip-title">${rule.name}</div>`;

	// Optional metadata (ruleType, source info)
	if (rule.ruleType || rule.source) {
		html += '<div class="tooltip-metadata">';
		if (rule.ruleType) {
			const ruleTypeLabel =
				rule.ruleType === 'C'
					? 'Core Rule'
					: rule.ruleType === 'O'
						? 'Optional Rule'
						: 'Variant Rule';
			html += `<strong>Type:</strong> ${ruleTypeLabel}<br>`;
		}
		if (rule.source) {
			html += `<strong>Source:</strong> ${rule.source}`;
			if (rule.page) {
				html += ` (p. ${rule.page})`;
			}
			html += '<br>';
		}
		html += '</div>';
	}

	// Description / Entries
	if (rule.entries) {
		html += _renderEntries(rule.entries, 10);
	}

	// Source
	html += _renderSource(rule);
	html += '</div>';

	return html;
}

// ===== HELPER METHODS =====

/**
 * Render entries array
 * @param {Array} entries Entries to render
 * @param {number} maxEntries Max entries to show
 * @returns {string} HTML
 * @private
 */
function _renderEntries(entries, maxEntries = 5) {
	if (!entries || !Array.isArray(entries)) return '';

	let html = '<div class="tooltip-description">';

	for (let i = 0; i < Math.min(entries.length, maxEntries); i++) {
		const entry = entries[i];

		if (typeof entry === 'string') {
			html += `<p>${Renderer5etools.processString(entry)}</p>`;
		} else if (entry.type === 'list' && entry.items) {
			// Skip certain list styles
			if (entry.style === 'list-hang-notitle') continue;

			html += '<ul>';
			for (let j = 0; j < Math.min(entry.items.length, 5); j++) {
				const item = entry.items[j];
				if (typeof item === 'string') {
					html += `<li>${Renderer5etools.processString(item)}</li>`;
				} else if (item.type === 'item' && item.entry) {
					const nameText = item.name ? `<strong>${item.name}.</strong> ` : '';
					html += `<li>${nameText}${Renderer5etools.processString(item.entry)}</li>`;
				}
			}
			html += '</ul>';
		} else if (entry.type === 'entries') {
			if (entry.name) {
				html += `<p><strong>${entry.name}.</strong> `;
			} else {
				html += '<p>';
			}
			if (entry.entries && Array.isArray(entry.entries)) {
				for (let j = 0; j < Math.min(entry.entries.length, 2); j++) {
					const subEntry = entry.entries[j];
					if (typeof subEntry === 'string') {
						html += `${Renderer5etools.processString(subEntry)} `;
					}
				}
			}
			html += '</p>';
		} else if (entry.type === 'table') {
			// Simple table rendering
			html += '<div class="tooltip-section"><em>[Table]</em></div>';
		}
	}

	html += '</div>';
	return html;
}

/**
 * Render source information
 * @param {Object} data Entity data
 * @returns {string} HTML
 * @private
 */
function _renderSource(data) {
	if (!data.source) return '';
	const page = data.page ? ` p. ${data.page}` : '';
	return `<div class="tooltip-source">${data.source}${page}</div>`;
}

/**
 * Get spell school name
 * @param {string} code School code
 * @returns {string} Full name
 * @private
 */
function _getSchoolName(code) {
	const schools = {
		A: 'Abjuration',
		C: 'Conjuration',
		D: 'Divination',
		E: 'Enchantment',
		I: 'Illusion',
		N: 'Necromancy',
		T: 'Transmutation',
		V: 'Evocation',
	};
	return schools[code] || code;
}

/**
 * Get range text
 * @param {Object} range Range data
 * @returns {string} Range text
 * @private
 */
function _getRangeText(range) {
	if (!range.distance) return 'Special';
	if (range.distance.type === 'touch') return 'Touch';
	if (range.distance.type === 'sight') return 'Sight';
	if (range.distance.type === 'self') {
		if (range.distance.amount) {
			return `Self (${range.distance.amount}-foot ${range.distance.subtype || 'radius'})`;
		}
		return 'Self';
	}
	return `${range.distance.amount || ''} ${range.distance.type || ''}`.trim();
}

/**
 * Get components text
 * @param {Object} components Components data
 * @returns {string} Components text
 * @private
 */
function _getComponentsText(components) {
	const parts = [];
	if (components.v) parts.push('V');
	if (components.s) parts.push('S');
	if (components.m) {
		const material =
			typeof components.m === 'string' ? components.m : components.m.text;
		if (material) {
			parts.push(`M (${material})`);
		} else {
			parts.push('M');
		}
	}
	return parts.join(', ');
}

/**
 * Get duration text
 * @param {Object} duration Duration data
 * @returns {string} Duration text
 * @private
 */
function _getDurationText(duration) {
	if (duration.type === 'instant') return 'Instantaneous';
	if (duration.type === 'permanent') return 'Until dispelled';
	if (duration.type === 'special') return 'Special';

	const concText = duration.concentration ? 'Concentration, up to ' : '';
	if (duration.duration) {
		return `${concText}${duration.duration.amount || ''} ${duration.duration.type || ''}`.trim();
	}
	return duration.type || 'Unknown';
}

/**
 * Get ability score increase text
 * @param {Array} abilities Ability array
 * @returns {string} Text
 * @private
 */
function _getAbilityScoreText(abilities) {
	if (!abilities || !Array.isArray(abilities) || abilities.length === 0) {
		return '';
	}

	// Use the proven 5etools ability parsing logic
	const data = getAbilityData(abilities);

	// For stat blocks, use the short text format which is more concise
	// e.g., "+2 Str, +1 Con, +1 two choice" instead of full sentences
	return data.asTextShort || data.asText || '';
}

/**
 * Format prerequisite text
 * @param {Object} prerequisite Prerequisite data
 * @returns {string} Text
 * @private
 */
function _formatPrerequisite(prerequisite) {
	if (typeof prerequisite === 'string') return prerequisite;

	const parts = [];
	if (prerequisite.level) parts.push(`Level ${prerequisite.level}`);
	if (prerequisite.ability) {
		for (const [ability, score] of Object.entries(prerequisite.ability)) {
			parts.push(`${ability.toUpperCase()} ${score}`);
		}
	}
	if (prerequisite.spellcasting) parts.push('Spellcasting');
	if (prerequisite.proficiency) {
		parts.push(`Proficiency with ${prerequisite.proficiency.join(', ')}`);
	}

	return parts.join(', ') || 'None';
}
