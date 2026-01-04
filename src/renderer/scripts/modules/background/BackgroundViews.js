/** View components for background selection and details display. */

import { toSentenceCase, toTitleCase } from '../../utils/TextFormatter.js';
import { textProcessor } from '../../utils/TextProcessor.js';

//=============================================================================
// Background Card View - Selection dropdowns and quick description
//=============================================================================

/** Manages background selection view (dropdowns + quick description). */
export class BackgroundCardView {
    /**
     * @param {HTMLElement} card - Root card element
     */
    constructor(card) {
        this._card = card;
        this._backgroundSelect = document.getElementById('backgroundSelect');
        this._variantContainer = document.getElementById('variantContainer');
        this._variantSelect = document.getElementById('variantSelect');
        this._quickDescription = document.getElementById('backgroundQuickDesc');
        this._imageElement = document.getElementById('backgroundImage');

        // Create variant container if it doesn't exist
        if (!this._variantContainer) {
            this._createVariantContainer();
        }
    }

    /**
     * Creates the variant selection container if it doesn't exist
     * @private
     */
    _createVariantContainer() {
        const selectors = document.querySelector('.background-selectors');
        if (!selectors) {
            console.warn(
                'BackgroundView',
                'Background selectors container not found',
            );
            return;
        }

        this._variantContainer = document.createElement('div');
        this._variantContainer.id = 'variantContainer';
        this._variantContainer.className = 'background-select-container';
        this._variantContainer.style.display = 'none';
        this._variantContainer.innerHTML = `
            <label for="variantSelect">Variant</label>
            <select class="form-select" id="variantSelect">
                <option value="">Standard background</option>
            </select>
        `;
        selectors.appendChild(this._variantContainer);

        // Update the reference to the variant select element
        this._variantSelect = document.getElementById('variantSelect');
    }

    /**
     * Populate background selection dropdown
     * @param {Array} backgrounds - Array of background objects from backgroundService
     */
    populateBackgroundSelect(backgrounds) {
        if (!this._backgroundSelect) return;

        // Clear existing options except the first (default)
        while (this._backgroundSelect.options.length > 1) {
            this._backgroundSelect.remove(1);
        }

        // Add background options
        backgrounds.forEach((background) => {
            const option = document.createElement('option');
            option.value = `${background.name}_${background.source}`;
            option.textContent = `${background.name} (${background.source})`;
            this._backgroundSelect.appendChild(option);
        });
    }

    /**
     * Populate variant selection dropdown
     * @param {Array} variants - Array of variant background objects
     */
    populateVariantSelect(variants) {
        if (!this._variantSelect) return;

        // Clear existing options except the first (default)
        while (this._variantSelect.options.length > 1) {
            this._variantSelect.remove(1);
        }

        // Add variant options
        variants.forEach((variant) => {
            const option = document.createElement('option');
            option.value = variant.name;
            option.textContent = `${variant.name} (${variant.source})`;
            this._variantSelect.appendChild(option);
        });
    }

    /**
     * Update quick description display
     * @param {Object} background - Background object
     */
    async updateQuickDescription(background) {
        if (!this._quickDescription || !background) return;

        const description = this._extractDescription(background);
        this._quickDescription.innerHTML = description;
        await textProcessor.processElement(this._quickDescription);
    }

    /**
     * Reset quick description to default state
     */
    resetQuickDescription() {
        if (!this._quickDescription) return;
        this._quickDescription.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Background</h5>
                <p>Choose a background to see details about their traits, proficiencies, and other characteristics.</p>
            </div>
        `;
    }

    /**
     * Update background image
     * @param {string} imageSrc - Image source URL
     * @param {string} altText - Alternative text for the image
     */
    updateBackgroundImage(imageSrc, altText = 'Background image') {
        if (!this._imageElement) return;

        try {
            // Clear existing content
            this._imageElement.innerHTML = '';

            // Create and append the image element
            if (imageSrc) {
                const img = document.createElement('img');
                img.src = imageSrc;
                img.alt = altText;
                img.classList.add('entity-img');
                this._imageElement.appendChild(img);
            } else {
                // Set a default icon
                this._imageElement.innerHTML =
                    '<i class="fas fa-user-circle placeholder-icon"></i>';
            }
        } catch (error) {
            console.error(
                'BackgroundView',
                'Error updating background image:',
                error,
            );
            // Set a default icon on error
            this._imageElement.innerHTML =
                '<i class="fas fa-user-circle placeholder-icon"></i>';
        }
    }

    /**
     * Show variant selector
     */
    showVariantSelector() {
        if (this._variantContainer) {
            this._variantContainer.style.display = 'block';
        }
    }

    /**
     * Hide variant selector and reset selection
     */
    hideVariantSelector() {
        if (this._variantContainer) {
            this._variantContainer.style.display = 'none';
        }
        if (this._variantSelect) {
            this._variantSelect.selectedIndex = 0;
        }
    }

    /**
     * Get current background selection
     * @returns {string} Selected background name
     */
    getSelectedBackground() {
        return this._backgroundSelect?.value || '';
    }

    /**
     * Get current variant selection
     * @returns {string} Selected variant name
     */
    getSelectedVariant() {
        return this._variantSelect?.value || '';
    }

    /**
     * Set background selection
     * @param {string} backgroundName - Background name to select
     */
    setSelectedBackground(backgroundName) {
        if (!this._backgroundSelect) return;

        // Find and select the option
        for (let i = 0; i < this._backgroundSelect.options.length; i++) {
            if (this._backgroundSelect.options[i].value === backgroundName) {
                this._backgroundSelect.selectedIndex = i;
                break;
            }
        }
    }

    /**
     * Set variant selection
     * @param {string} variantName - Variant name to select
     */
    setSelectedVariant(variantName) {
        if (!this._variantSelect) return;

        // Find and select the option
        for (let i = 0; i < this._variantSelect.options.length; i++) {
            if (this._variantSelect.options[i].value === variantName) {
                this._variantSelect.selectedIndex = i;
                break;
            }
        }
    }

    /**
     * Attach event listeners
     * @param {Function} onBackgroundChange - Handler for background selection change
     * @param {Function} onVariantChange - Handler for variant selection change
     */
    attachListeners(onBackgroundChange, onVariantChange) {
        if (this._backgroundSelect) {
            this._backgroundSelect.addEventListener('change', onBackgroundChange);
        }
        if (this._variantSelect) {
            this._variantSelect.addEventListener('change', onVariantChange);
        }
    }

    /**
     * Extract description from background data
     * @param {Object} background - Background object
     * @returns {string} HTML description
     * @private
     */
    _extractDescription(background) {
        if (background?.entries) {
            for (const entry of background.entries) {
                if (typeof entry === 'string') {
                    return `<p>${entry}</p>`;
                }
                if (entry.type === 'entries' && entry.entries) {
                    for (const subEntry of entry.entries) {
                        if (typeof subEntry === 'string') {
                            return `<p>${subEntry}</p>`;
                        }
                    }
                }
            }
        }
        return `<p>${background.name} is a character background from ${background.source}.</p>`;
    }
}

//=============================================================================
// Background Details View - Proficiencies, equipment, features
//=============================================================================

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
                equipment.push(
                    `(a) ${this._formatEquipmentList(eq.a)} or (b) ${this._formatEquipmentList(eq.b)}`,
                );
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
        const name =
            item.displayName ||
            (itemRef ? window.api.unpackUid(itemRef).name : '') ||
            item.name ||
            item.special ||
            '';
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
}
