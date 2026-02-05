// Step 4: Background - background selection with proficiencies, languages, and features

import { toSentenceCase, toTitleCase } from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { backgroundService } from '../../../services/BackgroundService.js';
import { sourceService } from '../../../services/SourceService.js';

export class CharacterStepBackground {
	constructor(session, modal) {
		this.session = session;
		this.modal = modal;
		this._cleanup = DOMCleanup.create();
		this._backgroundService = backgroundService;
	}

	async render() {
		return `
            <div class="step-4-background">
                <div class="card">
                    <div class="card-header">
                        <i class="fas fa-book"></i> Background Selection
                    </div>
                    <div class="card-body">
                        <div class="row g-3 mb-3">
                            <div class="col-12">
                                <label for="modalBackgroundSelect" class="form-label">Background</label>
                                <select class="form-select" id="modalBackgroundSelect">
                                    <option value="">Select a Background</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="modalBackgroundDetails">
                            <div class="background-details-grid">
                                <div class="detail-section">
                                    <h6>Skill Proficiencies</h6>
                                    <ul class="mb-0">
                                        <li class="placeholder-text">&nbsp;</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Tool Proficiencies</h6>
                                    <ul class="mb-0">
                                        <li class="placeholder-text">&nbsp;</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Languages</h6>
                                    <ul class="mb-0">
                                        <li class="placeholder-text">&nbsp;</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Equipment</h6>
                                    <ul class="mb-0">
                                        <li class="placeholder-text">&nbsp;</li>
                                    </ul>
                                </div>
                            </div>
                            <div id="modalBackgroundFeature" class="mt-3"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
	}

	async attachListeners(contentArea) {
		await this._loadBackgrounds();

		// Get elements
		const backgroundSelect = contentArea.querySelector(
			'#modalBackgroundSelect',
		);

		if (backgroundSelect) {
			// Populate dropdown
			await this._populateBackgroundSelect();

			// Load saved selection if any
			const savedBackground = this.session.get('background');
			if (savedBackground?.name && savedBackground?.source) {
				const value = `${savedBackground.name}_${savedBackground.source}`;
				backgroundSelect.value = value;
				await this._handleBackgroundChange();
			}

			// Listen for changes
			this._cleanup.on(backgroundSelect, 'change', () =>
				this._handleBackgroundChange(),
			);
		}
	}

	async validate() {
		// Background is optional, so always return true
		return true;
	}

	async save() {
		// No action needed - data saved on change
	}

	async _loadBackgrounds() {
		try {
			if (!backgroundService._backgroundData) {
				await backgroundService.initialize();
			}
		} catch (error) {
			console.error('[Step4Background]', 'Failed to load backgrounds', error);
		}
	}

	async _populateBackgroundSelect() {
		try {
			const backgrounds = backgroundService.getAllBackgrounds();

			if (!backgrounds || backgrounds.length === 0) {
				console.error('[Step4Background]', 'No backgrounds available');
				return;
			}

			const filteredBackgrounds = backgrounds.filter((bg) =>
				sourceService.isSourceAllowed(bg.source),
			);

			filteredBackgrounds.sort((a, b) => a.name.localeCompare(b.name));

			const select = document.getElementById('modalBackgroundSelect');
			if (!select) return;

			select.innerHTML = '<option value="">Select a Background</option>';
			for (const bg of filteredBackgrounds) {
				const option = document.createElement('option');
				option.value = `${bg.name}_${bg.source}`;
				option.textContent = `${bg.name} (${bg.source})`;
				select.appendChild(option);
			}
		} catch (error) {
			console.error('[Step4Background]', 'Error populating backgrounds', error);
		}
	}

	async _handleBackgroundChange() {
		const select = document.getElementById('modalBackgroundSelect');
		if (!select || !select.value) {
			this._clearBackgroundDetails();
			this.session.set('background', { name: '', source: '' });
			return;
		}

		const [name, source] = select.value.split('_');

		const background = backgroundService.selectBackground(name, source);

		if (!background) {
			console.error('[Step4Background]', 'Background not found', name, source);
			return;
		}

		this.session.set('background', {
			name: background.name,
			source: background.source,
		});

		// Update details display
		await this._updateBackgroundDetails(background);
	}

	async _updateBackgroundDetails(background) {
		const detailsContainer = document.getElementById('modalBackgroundDetails');
		if (!detailsContainer) return;

		const html = `
            <div class="background-details-grid">
                ${this._renderSkillProficiencies(background)}
                ${this._renderToolProficiencies(background)}
                ${this._renderLanguages(background)}
                ${this._renderEquipment(background)}
            </div>
            ${this._renderFeature(background)}
        `;

		detailsContainer.innerHTML = html;
	}

	_clearBackgroundDetails() {
		const detailsContainer = document.getElementById('modalBackgroundDetails');
		if (!detailsContainer) return;

		detailsContainer.innerHTML = `
            <div class="background-details-grid">
                <div class="detail-section">
                    <h6>Skill Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">&nbsp;</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">&nbsp;</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">&nbsp;</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Equipment</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">&nbsp;</li>
                    </ul>
                </div>
            </div>
        `;
	}

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

	_renderFeature(background) {
		const feature = this._extractFeature(background);
		if (!feature) return '';

		// Remove "Feature:" prefix if it exists in the name
		const featureName = feature.name.replace(/^Feature:\s*/i, '');

		return `
            <div class="traits-section detail-section mt-3">
                <h6>Feature</h6>
                <div class="feature-content modal-background-feature-scroll">
                    <ul class="mb-0">
                        <li class="text-content"><strong>${featureName}:</strong> ${feature.description}</li>
                    </ul>
                </div>
            </div>
        `;
	}

	_formatSkillProficiencies(background) {
		if (!background?.proficiencies?.skills) return 'None';

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

	_formatToolProficiencies(background) {
		if (!background?.proficiencies?.tools) return 'None';

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

	_formatLanguages(background) {
		if (!background?.proficiencies?.languages) return 'None';

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
				return toTitleCase(prof.language || prof);
			})
			.filter(Boolean);

		return languages.join(', ') || 'None';
	}

	_formatEquipment(background) {
		if (!background?.equipment) return '<li>None</li>';

		const equipment = [];

		for (const eq of background.equipment) {
			if (eq.a && eq.b) {
				equipment.push(
					`(a) ${this._formatEquipmentList(eq.a)} or (b) ${this._formatEquipmentList(eq.b)}`,
				);
			} else if (Array.isArray(eq)) {
				equipment.push(this._formatEquipmentList(eq));
			} else {
				equipment.push(this._formatSingleEquipment(eq));
			}
		}

		return equipment.map((e) => `<li>${e}</li>`).join('') || '<li>None</li>';
	}

	_formatEquipmentList(items) {
		return items.map((item) => this._formatSingleEquipment(item)).join(', ');
	}

	_formatSingleEquipment(item) {
		if (typeof item === 'string') {
			return item;
		}
		const qty = item.quantity ? `${item.quantity}x ` : '';
		const name = item.item || item.name || item.special || '';
		return `${qty}${name}`.trim();
	}

	_extractFeature(background) {
		if (!background?.entries) return null;

		const featureEntry = background.entries.find(
			(entry) =>
				entry.name?.toLowerCase().includes('feature') || entry.data?.isFeature,
		);

		if (!featureEntry) return null;

		const description = Array.isArray(featureEntry.entries)
			? featureEntry.entries
				.map((e) => (typeof e === 'string' ? e : ''))
				.filter(Boolean)
				.join(' ')
			: featureEntry.entry || '';

		return {
			name: featureEntry.name || 'Feature',
			description: description.trim(),
		};
	}

	destroy() {
		this._cleanup.cleanup();
	}
}
