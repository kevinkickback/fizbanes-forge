/** View component for displaying background details. */

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
		const skillsHTML = this._formatSkillProficiencies(background);
		return `
            <div class="detail-section">
                <h6>Skill Proficiencies</h6>
                <ul class="mb-0">
                    <li class="text-content">${skillsHTML}</li>
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
		const toolsHTML = this._formatToolProficiencies(background);
		return `
            <div class="detail-section">
                <h6>Tool Proficiencies</h6>
                <ul class="mb-0">
                    <li class="text-content">${toolsHTML}</li>
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
		const languagesHTML = this._formatLanguages(background);
		return `
            <div class="detail-section">
                <h6>Languages</h6>
                <ul class="mb-0">
                    <li class="text-content">${languagesHTML}</li>
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
		const equipmentHTML = this._formatEquipment(background);
		return `
            <div class="detail-section">
                <h6>Equipment</h6>
                <ul class="mb-0">
                    ${equipmentHTML}
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
            <div class="traits-section detail-section" style="margin-top: 1rem;">
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
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted skill proficiencies HTML
	 * @private
	 */
	_formatSkillProficiencies(background) {
		if (!background?.skillProficiencies) return 'None';

		const skills = [];

		for (const skillEntry of background.skillProficiencies) {
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];

				if (from.length === 0) {
					skills.push(`Choose ${count} skill${count > 1 ? 's' : ''}`);
				} else {
					const skillNames = from.map((skill) => {
						return skill
							.split(' ')
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(' ');
					});
					skills.push(`Choose ${count} from: ${skillNames.join(', ')}`);
				}
			} else {
				// Fixed proficiencies
				for (const [skill, value] of Object.entries(skillEntry)) {
					if (value === true) {
						const skillName = skill
							.split(' ')
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(' ');
						skills.push(skillName);
					}
				}
			}
		}

		return skills.join(', ') || 'None';
	}

	/**
	 * Format tool proficiencies from background data
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted tool proficiencies HTML
	 * @private
	 */
	_formatToolProficiencies(background) {
		if (!background?.toolProficiencies) return 'None';

		const tools = [];

		for (const toolEntry of background.toolProficiencies) {
			if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
			} else {
				// Fixed proficiencies
				for (const [tool, value] of Object.entries(toolEntry)) {
					if (value === true) {
						const toolName = tool
							.split(' ')
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(' ');
						tools.push(toolName);
					}
				}
			}
		}

		return tools.join(', ') || 'None';
	}

	/**
	 * Format languages from background data
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted languages HTML
	 * @private
	 */
	_formatLanguages(background) {
		if (!background?.languageProficiencies) return 'None';

		const languages = [];

		for (const langEntry of background.languageProficiencies) {
			if (langEntry.anyStandard) {
				languages.push(
					`Choose ${langEntry.anyStandard} standard language${langEntry.anyStandard > 1 ? 's' : ''}`,
				);
			} else if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				languages.push(`Choose ${count} language${count > 1 ? 's' : ''}`);
			} else {
				// Fixed languages
				for (const [lang, value] of Object.entries(langEntry)) {
					if (value === true) {
						const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
						languages.push(langName);
					}
				}
			}
		}

		return languages.join(', ') || 'None';
	}

	/**
	 * Format equipment from background data
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted equipment HTML
	 * @private
	 */
	_formatEquipment(background) {
		if (!background?.startingEquipment) return '<li>None</li>';

		const equipment = [];

		for (const equipEntry of background.startingEquipment) {
			if (equipEntry._) {
				// Array of items
				for (const item of equipEntry._) {
					if (typeof item === 'string') {
						equipment.push(item);
					} else if (item.item) {
						const name = item.displayName || item.item.split('|')[0];
						const qty = item.quantity ? `${item.quantity}x ` : '';
						equipment.push(`${qty}${name}`);
					} else if (item.special) {
						const qty = item.quantity ? `${item.quantity}x ` : '';
						equipment.push(`${qty}${item.special}`);
					}
				}
			} else if (equipEntry.a || equipEntry.b) {
				// Choice between options
				const choices = [];
				if (equipEntry.a)
					choices.push(`(a) ${this._formatEquipmentOption(equipEntry.a)}`);
				if (equipEntry.b)
					choices.push(`(b) ${this._formatEquipmentOption(equipEntry.b)}`);
				equipment.push(choices.join(' or '));
			}
		}

		return equipment.map((e) => `<li>${e}</li>`).join('') || 'None';
	}

	/**
	 * Format a single equipment option (helper for _formatEquipment)
	 * @param {Array} option - Equipment option array
	 * @returns {string} Formatted equipment option text
	 * @private
	 */
	_formatEquipmentOption(option) {
		const items = [];
		for (const item of option) {
			if (typeof item === 'string') {
				items.push(item);
			} else if (item.item) {
				const name = item.displayName || item.item.split('|')[0];
				const qty = item.quantity ? `${item.quantity}x ` : '';
				items.push(`${qty}${name}`);
			} else if (item.special) {
				const qty = item.quantity ? `${item.quantity}x ` : '';
				items.push(`${qty}${item.special}`);
			}
		}
		return items.join(', ');
	}

	/**
	 * Extract background feature from raw JSON
	 * @param {Object} background - Background JSON object
	 * @returns {Object|null} Feature object with name and description
	 * @private
	 */
	_extractFeature(background) {
		if (!background?.entries) return null;

		for (const entry of background.entries) {
			// Look for entries marked as features
			if (entry.type === 'entries' && entry.data?.isFeature) {
				const description = entry.entries
					? entry.entries.map((e) => (typeof e === 'string' ? e : '')).join(' ')
					: '';
				return {
					name: entry.name || 'Feature',
					description: description,
				};
			}
			// Also check for entries with "Feature:" in the name
			if (
				entry.type === 'entries' &&
				entry.name &&
				entry.name.toLowerCase().includes('feature')
			) {
				const description = entry.entries
					? entry.entries.map((e) => (typeof e === 'string' ? e : '')).join(' ')
					: '';
				return {
					name: entry.name,
					description: description,
				};
			}
		}
		return null;
	}
}
