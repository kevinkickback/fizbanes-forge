/** View component for displaying background details. */

import { toSentenceCase, toTitleCase } from '../../utils/TextFormatter.js';
import { textProcessor } from '../../utils/TextProcessor.js';

/** Handles background details rendering (proficiencies, equipment, features). */
export class BackgroundDetailsView {
	/**
	 * @param {HTMLElement} card - Root card element
	 */
	constructor(card) {
		this._card = card;
		this._detailsContainer = document.getElementById('backgroundDetails');
	}

	/**
	 * Update all background details
	 * @param {Object} background - Background object from backgroundService
	 */
	async updateAllDetails(background) {
		if (!this._detailsContainer || !background) {
			this.clearDetails();
			return;
		}

		const html = `
            <div class="background-details-grid">
                ${this._renderSkillProficiencies(background)}
                ${this._renderToolProficiencies(background)}
                ${this._renderLanguages(background)}
                ${this._renderEquipment(background)}
            </div>
            ${this._renderFeature(background)}
        `;

		this._detailsContainer.innerHTML = html;
		await textProcessor.processElement(this._detailsContainer);
	}

	/**
	 * Clear all details - do nothing, leave HTML placeholder intact
	 */
	clearDetails() {
		// Do nothing - the HTML already has the placeholder structure
		// We don't want to clear it
	}

	/**
	 * Render skill proficiencies section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for skill proficiencies
	 * @private
	 */
	_renderSkillProficiencies(background) {
		const skillsHtml = this._formatSkillProficiencies(background);
		return `
            <div class="detail-section">
                <h6>Skill Proficiencies</h6>
                <ul class="mb-0">
                    <li class="text-content">${skillsHtml}</li>
                </ul>
            </div>
        `;
	}

	/**
	 * Render tool proficiencies section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for tool proficiencies
	 * @private
	 */
	_renderToolProficiencies(background) {
		const toolsHtml = this._formatToolProficiencies(background);
		return `
            <div class="detail-section">
                <h6>Tool Proficiencies</h6>
                <ul class="mb-0">
                    <li class="text-content">${toolsHtml}</li>
                </ul>
            </div>
        `;
	}

	/**
	 * Render languages section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for languages
	 * @private
	 */
	_renderLanguages(background) {
		const languagesHtml = this._formatLanguages(background);
		return `
            <div class="detail-section">
                <h6>Languages</h6>
                <ul class="mb-0">
                    <li class="text-content">${languagesHtml}</li>
                </ul>
            </div>
        `;
	}

	/**
	 * Render equipment section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for equipment
	 * @private
	 */
	_renderEquipment(background) {
		const equipmentHtml = this._formatEquipment(background);
		return `
            <div class="detail-section">
                <h6>Equipment</h6>
                <ul class="mb-0">
                    ${equipmentHtml}
                </ul>
            </div>
        `;
	}

	/**
	 * Render feature section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for feature
	 * @private
	 */
	_renderFeature(background) {
		const feature = this._extractFeature(background);
		if (!feature) return '';

		return `
            <div class="traits-section detail-section">
                <h6>Feature</h6>
                <div class="feature-content">
                    <ul class="mb-0">
                        <li class="text-content"><strong>${feature.name}:</strong> ${feature.description}</li>
                    </ul>
                </div>
            </div>
        `;
	}

	/**
	 * Format skill proficiencies from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted skill proficiencies HTML
	 * @private
	 */
	_formatSkillProficiencies(background) {
		if (!background?.proficiencies?.skills) return 'None';

		// 5etools uses normalized structure: proficiencies.skills = [{skill: "...", optional: bool}]
		const skills = background.proficiencies.skills
			.map((prof) => {
				if (prof.choose) {
					return `Choose ${prof.choose.count || 1} from: ${prof.choose.from?.map(toTitleCase).join(', ') || 'any'}`;
				}
				return toTitleCase(prof.skill || prof);
			})
			.filter(Boolean);

		return skills.join(', ') || 'None';
	}

	/**
	 * Format tool proficiencies from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted tool proficiencies HTML
	 * @private
	 */
	_formatToolProficiencies(background) {
		if (!background?.proficiencies?.tools) return 'None';

		// 5etools uses normalized structure: proficiencies.tools = [{tool: "...", optional: bool}]
		const tools = background.proficiencies.tools
			.map((prof) => {
				if (prof.choose) {
					return `Choose ${prof.choose.count || 1} tool${prof.choose.count > 1 ? 's' : ''}`;
				}
				return toSentenceCase(prof.tool || prof);
			})
			.filter(Boolean);

		return tools.join(', ') || 'None';
	}

	/**
	 * Format languages from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted languages HTML
	 * @private
	 */
	_formatLanguages(background) {
		if (!background?.proficiencies?.languages) return 'None';

		// 5etools uses normalized structure: proficiencies.languages = [{language: "...", optional: bool}]
		const languages = background.proficiencies.languages
			.map((prof) => {
				if (prof.choose) {
					const count = prof.choose.count || 1;
					const suffix =
						prof.choose.type === 'anystandard'
							? ' (standard)'
							: prof.choose.type === 'any'
								? ' (any)'
								: '';
					return `Choose ${count} language${count > 1 ? 's' : ''}${suffix}`;
				}
				return prof.language || prof;
			})
			.filter(Boolean);

		return languages.join(', ') || 'None';
	}

	/**
	 * Format equipment from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted equipment HTML
	 * @private
	 */
	_formatEquipment(background) {
		if (!background?.equipment) return '<li>None</li>';

		// 5etools normalizes equipment: equipment = [{item: "...", quantity: n}] or [{a: [...], b: [...]}]
		const equipment = [];

		for (const eq of background.equipment) {
			if (eq.a && eq.b) {
				// Choice between options
				equipment.push(`(a) ${this._formatEquipmentList(eq.a)} or (b) ${this._formatEquipmentList(eq.b)}`);
			} else if (Array.isArray(eq)) {
				// Direct equipment list
				equipment.push(this._formatEquipmentList(eq));
			} else {
				// Single item
				equipment.push(this._formatSingleEquipment(eq));
			}
		}

		return equipment.map((e) => `<li>${e}</li>`).join('') || '<li>None</li>';
	}

	/**
	 * Format a list of equipment items
	 * @param {Array} items - Equipment items array
	 * @returns {string} Formatted items
	 * @private
	 */
	_formatEquipmentList(items) {
		return items.map((item) => this._formatSingleEquipment(item)).join(', ');
	}

	/**
	 * Format a single equipment item
	 * @param {string|Object} item - Equipment item
	 * @returns {string} Formatted item
	 * @private
	 */
	_formatSingleEquipment(item) {
		if (typeof item === 'string') {
			return item;
		}
		const qty = item.quantity ? `${item.quantity}x ` : '';
		const itemRef = item.item || '';
		const name = item.displayName || (itemRef ? window.api.unpackUid(itemRef).name : '') || item.name || item.special || '';
		return `${qty}${name}`.trim();
	}

	/**
	 * Extract background feature from raw JSON
	 * Uses 5etools normalized structure where feature is in entries
	 * @param {Object} background - Background JSON object
	 * @returns {Object|null} Feature object with name and description
	 * @private
	 */
	_extractFeature(background) {
		if (!background?.entries) return null;

		// 5etools typically marks features in entries array
		const featureEntry = background.entries.find(
			(entry) => entry.name?.toLowerCase().includes('feature') || entry.data?.isFeature
		);

		if (!featureEntry) return null;

		const description = Array.isArray(featureEntry.entries)
			? featureEntry.entries.map((e) => (typeof e === 'string' ? e : '')).filter(Boolean).join(' ')
			: featureEntry.entry || '';

		return {
			name: featureEntry.name || 'Feature',
			description: description.trim(),
		};
	}
}
