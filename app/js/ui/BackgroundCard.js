/**
 * BackgroundCard.js
 * UI class for handling background selection and display
 */

import { backgroundManager } from '../managers/BackgroundManager.js';
import { EntityCard } from './EntityCard.js';
import { textProcessor } from '../utils/TextProcessor.js';
import { characterHandler } from '../utils/characterHandler.js';

export class BackgroundCard extends EntityCard {
    constructor() {
        super({
            entityType: 'background',
            selectElementId: 'backgroundSelect',
            imageElementId: 'backgroundImage',
            quickDescElementId: 'backgroundQuickDesc',
            detailsElementId: 'backgroundDetails',
            placeholderTitle: 'Select a Background',
            placeholderDesc: 'Choose a background to see details about their traits, proficiencies, and other characteristics.'
        });

        this.variantContainer = document.querySelector('#variantContainer');
        if (!this.variantContainer) {
            this._createVariantContainer();
        }

        this.initialize();
    }

    /**
     * Initialize the background card
     */
    async initialize() {
        await backgroundManager.initialize();
        this.renderBackgroundSelection();
        this.attachSelectionListeners();
        await this.loadSavedBackgroundSelection();
    }

    /**
     * Creates the variant selection container if it doesn't exist
     */
    _createVariantContainer() {
        const selectors = document.querySelector('.background-selectors');
        if (!selectors) return;

        this.variantContainer = document.createElement('div');
        this.variantContainer.id = 'variantContainer';
        this.variantContainer.className = 'background-select-container';
        this.variantContainer.style.display = 'none';
        this.variantContainer.innerHTML = `
            <label for="variantSelect">Variant</label>
            <select class="form-select" id="variantSelect">
                <option value="">Standard background</option>
            </select>
        `;
        selectors.appendChild(this.variantContainer);
    }

    /**
     * Update the quick description
     * @param {string} title - The title to display
     * @param {string} description - The description text
     */
    updateQuickDescription(title, description) {
        if (!this.quickDescElement) {
            this.quickDescElement = document.getElementById(this.quickDescElementId);
            if (!this.quickDescElement) return;
        }

        if (!title && !description) {
            this.setPlaceholderContent();
            return;
        }

        // For debugging
        console.log(`Updating quick description for ${title}:`, description);

        // Replace placeholder with actual content
        this.quickDescElement.innerHTML = `
            <h5>${title}</h5>
            <p>${description}</p>
        `;
    }

    /**
     * Render the background selection dropdown
     */
    renderBackgroundSelection() {
        const backgrounds = backgroundManager.getAllBackgrounds();
        const selection = document.querySelector('#backgroundSelect');

        if (!selection) return;

        // Filter backgrounds by allowed sources
        const currentCharacter = characterHandler.currentCharacter;
        const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
        const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

        const filteredBackgrounds = backgrounds.filter(bg => {
            const bgSource = bg.source?.toUpperCase();
            return upperAllowedSources.has(bgSource);
        });

        console.log('[BackgroundCard] Filtered backgrounds:', filteredBackgrounds.length);

        // Update the select options with source in parentheses
        selection.innerHTML = `
            <option value="">Choose a background...</option>
            ${filteredBackgrounds.map(bg => `
                <option value="${bg.id}">${bg.name} (${bg.source})</option>
            `).join('')}
        `;

        // Reset display to placeholder
        this.setPlaceholderContent();
    }

    /**
     * Attach event listeners to the background and variant selectors
     */
    attachSelectionListeners() {
        const backgroundSelect = document.querySelector('#backgroundSelect');
        const variantSelect = document.querySelector('#variantSelect');

        backgroundSelect?.addEventListener('change', () => {
            const backgroundId = backgroundSelect.value;
            if (!backgroundId) {
                this._hideVariantSelector();
                this.setPlaceholderContent();
                this._updateCharacterBackground(null, null);
                return;
            }

            // Extract name and source from ID
            const [name, source] = backgroundId.split('_');
            const background = backgroundManager.selectBackground(name, source);

            if (background) {
                // Update variant options
                this._updateVariantOptions(background);

                // Render the background details
                this.renderEntityDetails(background);

                // Update character model
                this._updateCharacterBackground(background, null);
            } else {
                this._hideVariantSelector();
                this.setPlaceholderContent();
                this._updateCharacterBackground(null, null);
            }
        });

        variantSelect?.addEventListener('change', () => {
            const variantName = variantSelect.value;
            const background = backgroundManager.getSelectedBackground();

            if (!variantName) {
                // Show standard background
                this.renderEntityDetails(background);
                this._updateCharacterBackground(background, null);
                return;
            }

            // Select and render the variant
            const variant = backgroundManager.selectVariant(variantName);
            if (variant) {
                this.renderEntityDetails(variant);
                this._updateCharacterBackground(background, variant);
            }
        });
    }

    /**
     * Update the variant selection dropdown based on available variants
     * @param {Object} background - The selected background
     */
    _updateVariantOptions(background) {
        const variantSelect = document.querySelector('#variantSelect');
        if (!variantSelect) return;

        if (background.variants?.length > 0) {
            variantSelect.innerHTML = `
                <option value="">Standard background</option>
                ${background.variants.map(v => `
                    <option value="${v.name}">${v.name} (${v.source})</option>
                `).join('')}
            `;
            this._showVariantSelector();
        } else {
            this._hideVariantSelector();
        }
    }

    /**
     * Show the variant selector
     */
    _showVariantSelector() {
        if (this.variantContainer) {
            this.variantContainer.style.display = 'block';
        }
    }

    /**
     * Hide the variant selector
     */
    _hideVariantSelector() {
        if (this.variantContainer) {
            this.variantContainer.style.display = 'none';
        }
    }

    /**
     * Render the details of a specific background
     * @param {Object} background - The background to render
     */
    async renderEntityDetails(background) {
        if (!background) {
            this.setPlaceholderContent();
            return;
        }

        console.log("Rendering background details:", background);

        // Update image (if we have an image later)
        this.updateEntityImage(background.imageUrl);

        // Update quick description
        this.updateQuickDescription(background.name, background.getDescription());

        // Update background details
        await this._updateBackgroundDetails(background);
    }

    /**
     * Update the background details content
     * @param {Background} background - The background to display
     * @private
     */
    async _updateBackgroundDetails(background) {
        const backgroundDetails = document.getElementById(this.detailsElementId);
        if (!backgroundDetails) return;

        console.log("Updating background details:", {
            id: background.id,
            proficiencies: background.proficiencies,
            languages: background.languages,
            equipment: background.equipment
        });

        // Process skill proficiencies
        const skillProficiencies = backgroundManager.getFormattedSkillProficiencies(background);
        console.log("Formatted skill proficiencies:", skillProficiencies);

        // Process tool proficiencies
        const toolProficiencies = backgroundManager.getFormattedToolProficiencies(background);
        console.log("Formatted tool proficiencies:", toolProficiencies);

        // Process languages
        const languages = backgroundManager.getFormattedLanguages(background);
        console.log("Formatted languages:", languages);

        // Process equipment
        const equipment = backgroundManager.getFormattedEquipment(background);
        console.log("Formatted equipment:", equipment);

        // Get the feature text
        const featureHtml = await this._renderFeature(background);
        console.log("Feature HTML:", featureHtml);

        // Update background details
        backgroundDetails.innerHTML = `
            <div class="background-details-grid">
                <div class="detail-section">
                    <h6>Skill Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="text-content">${skillProficiencies}</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="text-content">${toolProficiencies}</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="text-content">${languages}</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Equipment</h6>
                    <ul class="mb-0">
                        <li class="text-content">${equipment}</li>
                    </ul>
                </div>
            </div>
            <div class="traits-section detail-section" style="margin-top: 1rem;">
                <h6>Feature</h6>
                <div class="feature-content">
                    <ul class="mb-0">
                        ${featureHtml}
                    </ul>
                </div>
            </div>
        `;

        // Process the entire background details container to resolve reference tags
        await textProcessor.processElement(backgroundDetails);
    }

    /**
     * Renders a background's feature as plain text
     * @param {Object} background - The background object
     * @returns {string} HTML for the feature text
     * @private
     */
    async _renderFeature(background) {
        const feature = background.getFeature();
        if (!feature || !feature.name) {
            return '<li class="text-content">No features available</li>';
        }

        let description = feature.description || '';
        // Process description with textProcessor if available
        if (textProcessor) {
            try {
                description = await textProcessor.processString(description);
            } catch (error) {
                console.error('Error processing feature description:', error);
            }
        }

        // Clean up feature name by removing any "Feature:" prefix
        const cleanName = feature.name.replace(/^Feature:?\s*/i, '').trim();

        // Return formatted feature with name and description as a list item
        return `<li class="text-content"><strong>${cleanName}:</strong> ${description}</li>`;
    }

    /**
     * Process tooltips for embedded content
     * @param {HTMLElement} element - The element to process tooltips for
     */
    async _processTooltips(element) {
        if (!element || !textProcessor) return;

        try {
            const textNodes = element.querySelectorAll('p, li');
            for (const node of textNodes) {
                const originalText = node.innerHTML;
                const processedText = await textProcessor.processString(originalText);
                node.innerHTML = processedText;
            }
        } catch (error) {
            console.error('Error processing tooltips:', error);
        }
    }

    /**
     * Load and set the saved background selection
     */
    async loadSavedBackgroundSelection() {
        try {
            const character = characterHandler?.currentCharacter;
            if (character?.background?.name && character?.background?.source) {
                const backgroundId = `${character.background.name}_${character.background.source}`;
                const backgroundSelect = document.querySelector('#backgroundSelect');
                const backgroundExists = Array.from(backgroundSelect.options).some(option => option.value === backgroundId);

                if (backgroundExists) {
                    backgroundSelect.value = backgroundId;
                    backgroundSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    if (character.background.variant) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const variantSelect = document.querySelector('#variantSelect');
                        const variantExists = Array.from(variantSelect.options).some(option => option.value === character.background.variant);
                        if (variantExists) {
                            variantSelect.value = character.background.variant;
                            variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                } else {
                    console.warn(`Saved background "${backgroundId}" not found in available options. Character might use a source that's not currently allowed.`);
                }
            }
        } catch (error) {
            console.error('Error loading saved background selection:', error);
        }
    }

    /**
     * Override placeholder details to match the HTML structure
     * @returns {string} HTML structure that matches the placeholder in index.html
     */
    getPlaceholderDetailsContent() {
        return `
            <div class="background-details-grid">
                <div class="detail-section">
                    <h6>Skill Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Equipment</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            </div>
            <div class="traits-section detail-section" style="margin-top: 1rem;">
                <h6>Feature</h6>
                <div class="feature-content">
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            </div>`;
    }

    /**
     * Update character's background information
     * @param {Object} background - Selected background
     * @param {Object} variant - Selected variant
     * @private
     */
    _updateCharacterBackground(background, variant) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Check if background has changed
        const hasChanged = !background ?
            (character.background?.name || character.background?.source) :
            (character.background?.name !== background.name ||
                character.background?.source !== background.source ||
                character.background?.variant !== (variant?.name || null));

        if (hasChanged) {
            // Clear previous background proficiencies
            character.removeProficienciesBySource('Background');

            if (!background) {
                // Clear background
                character.background = {};
            } else {
                // Set background
                character.background = {
                    name: background.name,
                    source: background.source
                };

                // Add variant if selected
                if (variant) {
                    character.background.variant = variant.name;
                } else {
                    character.background.variant = null;
                }

                // Add background proficiencies
                this._updateBackgroundProficiencies(background, variant);

                // Show unsaved changes
                characterHandler.showUnsavedChanges();
            }

            // Trigger an event to update the UI
            document.dispatchEvent(new CustomEvent('characterChanged'));
        }
    }

    /**
     * Update character's proficiencies based on background
     * @param {Background} background - The selected background
     * @param {Object} variant - Selected variant
     * @private
     */
    _updateBackgroundProficiencies(background, variant) {
        const character = characterHandler.currentCharacter;
        if (!character || !background) return;

        console.log(`[BackgroundCard] Adding proficiencies for ${background.name}`);

        // Get fixed proficiencies from background
        const fixedProfs = background.getFixedProficiencies();

        // Add fixed skill proficiencies
        for (const skill of fixedProfs.skills) {
            character.addProficiency('skills', skill, 'Background');
        }

        // Add fixed tool proficiencies
        for (const tool of fixedProfs.tools) {
            character.addProficiency('tools', tool, 'Background');
        }

        // Set up optional proficiencies
        if (background.proficiencies?.skills?.choices?.count > 0) {
            character.optionalProficiencies.skills.allowed = background.proficiencies.skills.choices.count;
            character.optionalProficiencies.skills.selected = [];
        }

        if (background.proficiencies?.tools?.choices?.count > 0) {
            character.optionalProficiencies.tools.allowed = background.proficiencies.tools.choices.count;
            character.optionalProficiencies.tools.selected = [];
        }

        // Handle languages
        if (background.languages) {
            // Add fixed languages
            for (const language of background.languages.fixed || []) {
                character.addProficiency('languages', language, 'Background');
            }

            // Set up optional languages
            if (background.languages.choices?.count > 0) {
                character.optionalProficiencies.languages.allowed = background.languages.choices.count;
                character.optionalProficiencies.languages.selected = [];
            }
        }
    }

    /**
     * Set placeholder content when no entity is selected
     */
    setPlaceholderContent() {
        console.log("Setting placeholder content");

        // Set placeholder image
        const imageElement = document.getElementById(this.imageElementId);
        if (imageElement) {
            imageElement.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
        }

        // Set placeholder quick description
        if (!this.quickDescElement) {
            this.quickDescElement = document.getElementById(this.quickDescElementId);
        }

        if (this.quickDescElement) {
            this.quickDescElement.innerHTML = `
                <div class="placeholder-content">
                    <h5>${this.placeholderTitle}</h5>
                    <p>${this.placeholderDesc}</p>
                </div>`;
        }

        // Set placeholder details
        const detailsElement = document.getElementById(this.detailsElementId);
        if (detailsElement) {
            detailsElement.innerHTML = this.getPlaceholderDetailsContent();
        }
    }
} 