/**
 * Step 4: Background
 * 
 * User selects character background and views proficiencies, languages, and features.
 */

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

    /**
     * Render the step HTML.
     */
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
                                        <li class="text-muted">Select a background to view details</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Tool Proficiencies</h6>
                                    <ul class="mb-0">
                                        <li class="text-muted">Select a background to view details</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Languages</h6>
                                    <ul class="mb-0">
                                        <li class="text-muted">Select a background to view details</li>
                                    </ul>
                                </div>
                                <div class="detail-section">
                                    <h6>Equipment</h6>
                                    <ul class="mb-0">
                                        <li class="text-muted">Select a background to view details</li>
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

    /**
     * Attach event listeners after render.
     */
    async attachListeners(contentArea) {
        console.debug('[Step4Background]', 'Attaching listeners');

        // Load backgrounds
        await this._loadBackgrounds();

        // Get elements
        const backgroundSelect = contentArea.querySelector('#modalBackgroundSelect');

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
            this._cleanup.on(backgroundSelect, 'change', () => this._handleBackgroundChange());
        }
    }

    /**
     * Validate step before proceeding.
     */
    async validate() {
        // Background is optional, so always return true
        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        // Data is saved on change, nothing to do here
        console.debug('[Step4Background]', 'Background step data saved to session');
    }

    /**
     * Load backgrounds from service.
     * @private
     */
    async _loadBackgrounds() {
        try {
            // BackgroundService is initialized by AppInitializer, no need to check
            // Just ensure it's ready - if not initialized, this will initialize it
            if (!backgroundService._backgroundData) {
                await backgroundService.initialize();
            }
        } catch (error) {
            console.error('[Step4Background]', 'Failed to load backgrounds', error);
        }
    }

    /**
     * Populate background dropdown.
     * @private
     */
    async _populateBackgroundSelect() {
        try {
            const backgrounds = backgroundService.getAllBackgrounds();

            if (!backgrounds || backgrounds.length === 0) {
                console.error('[Step4Background]', 'No backgrounds available');
                return;
            }

            // Filter by allowed sources
            const filteredBackgrounds = backgrounds.filter(bg =>
                sourceService.isSourceAllowed(bg.source)
            );

            // Sort by name
            filteredBackgrounds.sort((a, b) => a.name.localeCompare(b.name));

            // Populate select
            const select = document.getElementById('modalBackgroundSelect');
            if (!select) return;

            // Clear existing options except placeholder
            select.innerHTML = '<option value="">Select a Background</option>';

            // Add background options
            for (const bg of filteredBackgrounds) {
                const option = document.createElement('option');
                option.value = `${bg.name}_${bg.source}`;
                option.textContent = `${bg.name} (${bg.source})`;
                select.appendChild(option);
            }

            console.debug('[Step4Background]', `Populated ${filteredBackgrounds.length} backgrounds`);

        } catch (error) {
            console.error('[Step4Background]', 'Error populating backgrounds', error);
        }
    }

    /**
     * Handle background selection change.
     * @private
     */
    async _handleBackgroundChange() {
        const select = document.getElementById('modalBackgroundSelect');
        if (!select || !select.value) {
            this._clearBackgroundDetails();
            this.session.set('background', { name: '', source: '' });
            return;
        }

        const [name, source] = select.value.split('_');

        // Get background data from service
        const background = backgroundService.selectBackground(name, source);

        if (!background) {
            console.error('[Step4Background]', 'Background not found', name, source);
            return;
        }

        console.debug('[Step4Background]', 'Selected background:', name, source);

        // Save to session
        this.session.set('background', {
            name: background.name,
            source: background.source
        });

        // Update details display
        await this._updateBackgroundDetails(background);
    }

    /**
     * Update background details display.
     * @private
     */
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

    /**
     * Clear background details.
     * @private
     */
    _clearBackgroundDetails() {
        const detailsContainer = document.getElementById('modalBackgroundDetails');
        if (!detailsContainer) return;

        detailsContainer.innerHTML = `
            <div class="background-details-grid">
                <div class="detail-section">
                    <h6>Skill Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="text-muted">Select a background to view details</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="text-muted">Select a background to view details</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="text-muted">Select a background to view details</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Equipment</h6>
                    <ul class="mb-0">
                        <li class="text-muted">Select a background to view details</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Render skill proficiencies.
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
     * Render tool proficiencies.
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
     * Render languages.
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
     * Render equipment.
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
     * Render feature.
     * @private
     */
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

    /**
     * Format skill proficiencies.
     * @private
     */
    _formatSkillProficiencies(background) {
        if (!background?.proficiencies?.skills) return 'None';

        const skills = background.proficiencies.skills
            .map(prof => {
                if (prof.choose) {
                    return `Choose ${prof.choose.count || 1} from: ${prof.choose.from?.map(toTitleCase).join(', ') || 'any'}`;
                }
                return toTitleCase(prof.skill || prof);
            })
            .filter(Boolean);

        return skills.join(', ') || 'None';
    }

    /**
     * Format tool proficiencies.
     * @private
     */
    _formatToolProficiencies(background) {
        if (!background?.proficiencies?.tools) return 'None';

        const tools = background.proficiencies.tools
            .map(prof => {
                if (prof.choose) {
                    return `Choose ${prof.choose.count || 1} tool${prof.choose.count > 1 ? 's' : ''}`;
                }
                return toSentenceCase(prof.tool || prof);
            })
            .filter(Boolean);

        return tools.join(', ') || 'None';
    }

    /**
     * Format languages.
     * @private
     */
    _formatLanguages(background) {
        if (!background?.proficiencies?.languages) return 'None';

        const languages = background.proficiencies.languages
            .map(prof => {
                if (prof.choose) {
                    const count = prof.choose.count || 1;
                    const suffix = prof.choose.type === 'anystandard' ? ' (standard)' :
                        prof.choose.type === 'any' ? ' (any)' : '';
                    return `Choose ${count} language${count > 1 ? 's' : ''}${suffix}`;
                }
                return prof.language || prof;
            })
            .filter(Boolean);

        return languages.join(', ') || 'None';
    }

    /**
     * Format equipment.
     * @private
     */
    _formatEquipment(background) {
        if (!background?.equipment) return '<li>None</li>';

        const equipment = [];

        for (const eq of background.equipment) {
            if (eq.a && eq.b) {
                equipment.push(`(a) ${this._formatEquipmentList(eq.a)} or (b) ${this._formatEquipmentList(eq.b)}`);
            } else if (Array.isArray(eq)) {
                equipment.push(this._formatEquipmentList(eq));
            } else {
                equipment.push(this._formatSingleEquipment(eq));
            }
        }

        return equipment.map(e => `<li>${e}</li>`).join('') || '<li>None</li>';
    }

    /**
     * Format equipment list.
     * @private
     */
    _formatEquipmentList(items) {
        return items.map(item => this._formatSingleEquipment(item)).join(', ');
    }

    /**
     * Format single equipment item.
     * @private
     */
    _formatSingleEquipment(item) {
        if (typeof item === 'string') {
            return item;
        }
        const qty = item.quantity ? `${item.quantity}x ` : '';
        const name = item.item || item.name || item.special || '';
        return `${qty}${name}`.trim();
    }

    /**
     * Extract feature from background.
     * @private
     */
    _extractFeature(background) {
        if (!background?.entries) return null;

        const featureEntry = background.entries.find(entry =>
            entry.name?.toLowerCase().includes('feature') || entry.data?.isFeature
        );

        if (!featureEntry) return null;

        const description = Array.isArray(featureEntry.entries)
            ? featureEntry.entries
                .map(e => typeof e === 'string' ? e : '')
                .filter(Boolean)
                .join(' ')
            : featureEntry.entry || '';

        return {
            name: featureEntry.name || 'Feature',
            description: description.trim()
        };
    }

    /**
     * Cleanup when step is destroyed.
     */
    destroy() {
        this._cleanup.cleanup();
    }
}
