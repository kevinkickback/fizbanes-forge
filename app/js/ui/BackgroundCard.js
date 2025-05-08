/**
 * BackgroundCard.js
 * UI component that handles the display and selection of character backgrounds.
 * 
 * @typedef {Object} Background
 * @property {string} id - Unique identifier for the background
 * @property {string} name - Name of the background
 * @property {string} source - Source book of the background
 * @property {string} description - Brief description of the background
 * @property {Array<Object>} variants - Available background variants
 * @property {Array<Object>} skillProficiencies - Skill proficiencies provided by the background
 * @property {Array<Object>} toolProficiencies - Tool proficiencies provided by the background
 * @property {Array<Object>} languages - Languages provided by the background
 * @property {Array<Object>} equipment - Starting equipment provided by the background
 * @property {Object} characteristics - Personality traits, ideals, bonds, and flaws
 */

import { backgroundManager } from '../managers/BackgroundManager.js';
import { EntityCard } from './EntityCard.js';
import { textProcessor } from '../utils/TextProcessor.js';
import { characterHandler } from '../utils/characterHandler.js';

/**
 * Manages the background selection UI component and related functionality
 * Extends the base EntityCard class
 */
export class BackgroundCard extends EntityCard {
    /**
     * Creates a new BackgroundCard instance
     */
    constructor() {
        // Use null for parent constructor - this avoids the EntityCard DOM lookup
        super(null);

        // Mark _card as initialized to prevent errors in the parent class
        this._card = document.createElement('div');

        // Override/add our own specific element references
        this.quickDescElementId = 'backgroundQuickDesc';
        this.detailsElementId = 'backgroundDetails';
        this.imageElementId = 'backgroundImage';

        this.quickDescElement = document.getElementById(this.quickDescElementId);
        this.detailsElement = document.getElementById(this.detailsElementId);
        this.imageElement = document.getElementById(this.imageElementId);

        /**
         * Container element for variant selection dropdown
         * @type {HTMLElement}
         * @private
         */
        this._variantContainer = document.querySelector('#variantContainer');

        /**
         * Reference to the background manager singleton
         * @type {BackgroundManager}
         * @private
         */
        this._backgroundManager = backgroundManager;

        /**
         * The main background selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._backgroundSelect = document.getElementById('backgroundSelect');

        /**
         * The variant selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._variantSelect = document.getElementById('variantSelect');

        // Default placeholder text
        this.placeholderTitle = 'Select a Background';
        this.placeholderDesc = 'Choose a background to see details about their traits, proficiencies, and other characteristics.';

        // Create variant container if it doesn't exist
        if (!this._variantContainer) {
            this._createVariantContainer();
        }

        // Initialize the component
        this.initialize();
    }

    /**
     * Initializes the background card UI components and event listeners
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Initialize required dependencies
            await this._backgroundManager.initialize();
            await textProcessor.initialize();

            // Populate background dropdown
            this._renderBackgroundSelection();

            // Set up event listeners
            this._attachSelectionListeners();

            // Load saved background selection from character data
            await this._loadSavedBackgroundSelection();
        } catch (error) {
            console.error('Failed to initialize background card:', error);
        }
    }

    /**
     * Creates the variant selection container if it doesn't exist
     * @private
     */
    _createVariantContainer() {
        const selectors = document.querySelector('.background-selectors');
        if (!selectors) {
            console.warn('Background selectors container not found');
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
     * Populates the background selection dropdown with available backgrounds
     * filtered by allowed sources
     * @private
     */
    _renderBackgroundSelection() {
        if (!this._backgroundSelect) {
            console.warn('Background select element not found');
            return;
        }

        try {
            const backgrounds = this._backgroundManager.getAllBackgrounds();
            if (!backgrounds || backgrounds.length === 0) {
                console.error('No backgrounds available to populate dropdown');
                return;
            }

            // Filter backgrounds by allowed sources
            const currentCharacter = characterHandler.currentCharacter;
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            const filteredBackgrounds = backgrounds.filter(bg => {
                const bgSource = bg.source?.toUpperCase();
                return upperAllowedSources.has(bgSource);
            });

            // Sort backgrounds by name
            filteredBackgrounds.sort((a, b) => a.name.localeCompare(b.name));

            // Update the select options with source in parentheses
            this._backgroundSelect.innerHTML = `
                <option value="">Choose a background...</option>
                ${filteredBackgrounds.map(bg => `
                    <option value="${bg.id}">${bg.name} (${bg.source})</option>
                `).join('')}
            `;

            // Reset display to placeholder
            this.setPlaceholderContent('Select a Background',
                'Choose a background to see details about their traits, proficiencies, and other characteristics.');
        } catch (error) {
            console.error('Error populating background dropdown:', error);
        }
    }

    /**
     * Loads and sets the saved background selection from the character data
     * @returns {Promise<void>}
     * @private
     */
    async _loadSavedBackgroundSelection() {
        try {
            const character = characterHandler?.currentCharacter;
            if (!character?.background?.name) {
                return; // No saved background to load
            }

            // Build the background ID from name and source
            const backgroundId = character.background.name && character.background.source ?
                `${character.background.name}_${character.background.source}` : '';

            if (!backgroundId) {
                return;
            }

            // Check if the background exists in the dropdown
            const backgroundExists = Array.from(this._backgroundSelect.options).some(
                option => option.value === backgroundId
            );

            if (backgroundExists) {
                // Set the background selection
                this._backgroundSelect.value = backgroundId;
                this._backgroundSelect.dispatchEvent(new Event('change', { bubbles: true }));

                // Also set variant if one was selected
                if (character.background.variant) {
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const variantExists = Array.from(this._variantSelect.options).some(
                        option => option.value === character.background.variant
                    );

                    if (variantExists) {
                        this._variantSelect.value = character.background.variant;
                        this._variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } else {
                console.warn(`Saved background "${backgroundId}" not found in available options. Character might use a source that's not currently allowed.`);
            }
        } catch (error) {
            console.error('Error loading saved background selection:', error);
        }
    }

    /**
     * Attaches event listeners to the background and variant selectors
     * @private
     */
    _attachSelectionListeners() {
        // Background selection change handler
        this._backgroundSelect?.addEventListener('change', () => this._handleBackgroundChange());

        // Variant selection change handler
        this._variantSelect?.addEventListener('change', () => this._handleVariantChange());
    }

    /**
     * Handles background selection change events
     * @private
     */
    _handleBackgroundChange() {
        try {
            const backgroundId = this._backgroundSelect.value;

            if (!backgroundId) {
                this._hideVariantSelector();
                this.setPlaceholderContent('Select a Background',
                    'Choose a background to see details about their traits, proficiencies, and other characteristics.');
                this._updateCharacterBackground(null, null);
                return;
            }

            // Extract name and source from ID
            const [name, source] = backgroundId.split('_');
            const background = this._backgroundManager.selectBackground(name, source);

            if (background) {
                // Update variant options
                this._updateVariantOptions(background);

                // Render the background details
                this._renderEntityDetails(background);

                // Update character model
                this._updateCharacterBackground(background, null);
            } else {
                this._hideVariantSelector();
                this.setPlaceholderContent('Select a Background',
                    'Choose a background to see details about their traits, proficiencies, and other characteristics.');
                this._updateCharacterBackground(null, null);
            }
        } catch (error) {
            console.error('Error handling background change:', error);
        }
    }

    /**
     * Handles variant selection change events
     * @private
     */
    _handleVariantChange() {
        try {
            const variantName = this._variantSelect.value;
            const background = this._backgroundManager.getSelectedBackground();

            if (!background) {
                return;
            }

            if (!variantName) {
                // Show standard background
                this._renderEntityDetails(background);
                this._updateCharacterBackground(background, null);
                return;
            }

            // Select and render the variant
            const variant = this._backgroundManager.selectVariant(variantName);
            if (variant) {
                this._renderEntityDetails(variant);
                this._updateCharacterBackground(background, variant);
            }
        } catch (error) {
            console.error('Error handling variant change:', error);
        }
    }

    /**
     * Updates the variant selection dropdown based on available variants
     * @param {Background} background - The selected background
     * @private
     */
    _updateVariantOptions(background) {
        if (!this._variantSelect) {
            return;
        }

        try {
            if (background.variants?.length > 0) {
                // Filter variants by allowed sources
                const currentCharacter = characterHandler.currentCharacter;
                const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
                const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

                const filteredVariants = background.variants.filter(variant => {
                    const variantSource = variant.source?.toUpperCase() || background.source.toUpperCase();
                    return upperAllowedSources.has(variantSource);
                });

                if (filteredVariants.length > 0) {
                    // Sort variants by name
                    filteredVariants.sort((a, b) => a.name.localeCompare(b.name));

                    this._variantSelect.innerHTML = `
                        <option value="">Standard background</option>
                        ${filteredVariants.map(v => `
                            <option value="${v.name}">${v.name} (${v.source || background.source})</option>
                        `).join('')}
                    `;
                    this._showVariantSelector();
                    return;
                }
            }

            this._hideVariantSelector();
        } catch (error) {
            console.error('Error updating variant options:', error);
            this._hideVariantSelector();
        }
    }

    /**
     * Shows the variant selector dropdown
     * @private
     */
    _showVariantSelector() {
        if (this._variantContainer) {
            this._variantContainer.style.display = 'block';
        }
    }

    /**
     * Hides the variant selector dropdown
     * @private
     */
    _hideVariantSelector() {
        if (this._variantContainer) {
            this._variantContainer.style.display = 'none';
        }

        if (this._variantSelect) {
            this._variantSelect.value = '';
        }
    }

    /**
     * Renders the details of a specific background
     * @param {Background} background - The background to render
     * @private
     */
    async _renderEntityDetails(background) {
        if (!background) {
            this.setPlaceholderContent('Select a Background',
                'Choose a background to see details about their traits, proficiencies, and other characteristics.');
            return;
        }

        try {
            // Update image (if we have an image later)
            this.updateEntityImage(background.imageUrl || null, background.name);

            // Update quick description
            await this.updateQuickDescription(background.name, background.getDescription());

            // Update background details
            await this._updateBackgroundDetails(background);
        } catch (error) {
            console.error('Error rendering background details:', error);
        }
    }

    /**
     * Update the quick description
     * @param {string} title - The title to display
     * @param {string} description - The description text
     */
    updateQuickDescription(title, description) {
        if (!this.quickDescElement) {
            this.quickDescElement = document.getElementById(this.quickDescElementId);
            if (!this.quickDescElement) {
                console.error('[BackgroundCard] Quick description element not found!');
                return;
            }
        }

        if (!title && !description) {
            this.setPlaceholderContent();
            return;
        }

        // Replace placeholder with actual content
        this.quickDescElement.innerHTML = `
            <h5>${title}</h5>
            <p>${description}</p>
        `;
    }

    /**
     * Updates the entity image in the card
     * @param {string} imagePath - The path to the image
     * @param {string} altText - Alternative text for the image
     * @returns {void}
     */
    updateEntityImage(imagePath, altText) {
        if (!this.imageElement) {
            this.imageElement = document.getElementById(this.imageElementId);
            if (!this.imageElement) {
                console.error('[BackgroundCard] Image element not found!');
                return;
            }
        }

        try {
            // Clear existing content
            this.imageElement.innerHTML = '';

            // Create and append the image element
            if (imagePath) {
                const img = document.createElement('img');
                img.src = imagePath;
                img.alt = altText || 'Background image';
                img.classList.add('entity-img');
                this.imageElement.appendChild(img);
            } else {
                // Set a default icon
                this.imageElement.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            }
        } catch (error) {
            console.error('Error updating background image:', error);
            // Set a default icon on error
            this.imageElement.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
        }
    }

    /**
     * Updates the background details content
     * @param {Background} background - The background to display
     * @private
     */
    async _updateBackgroundDetails(background) {
        // Direct access to DOM elements for maximum control
        const backgroundDetails = document.getElementById('backgroundDetails');
        if (!backgroundDetails) {
            console.error('[BackgroundCard] ERROR: Details element with ID "backgroundDetails" not found!');
            return;
        }

        // Force direct access to the quick description element
        const quickDescElement = document.getElementById('backgroundQuickDesc');
        if (quickDescElement) {
            quickDescElement.innerHTML = `
                <h5>${background.name}</h5>
                <p>${background.getDescription()}</p>
            `;
        } else {
            console.error('[BackgroundCard] Quick description element not found!');
        }

        // Process skill proficiencies
        const skillProficiencies = this._backgroundManager.getFormattedSkillProficiencies(background);

        // Process tool proficiencies
        const toolProficiencies = this._backgroundManager.getFormattedToolProficiencies(background);

        // Process languages
        const languages = this._backgroundManager.getFormattedLanguages(background);

        // Process equipment
        const equipment = this._backgroundManager.getFormattedEquipment(background);

        // Get the feature text
        const featureHtml = await this._renderFeature(background);

        // Construct the HTML
        const generatedHtml = `
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

        // Direct update of background details
        backgroundDetails.innerHTML = generatedHtml;

        // Process the entire background details container to resolve reference tags
        try {
            await textProcessor.processElement(backgroundDetails);
        } catch (processingError) {
            console.error('[BackgroundCard] Error during text processing:', processingError);
        }
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

            // Notify UI to clear optional proficiencies from background
            document.dispatchEvent(new CustomEvent('proficienciesRemoved', {
                detail: { source: 'Background' }
            }));

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

                // Force a refresh after a short delay to ensure everything is updated
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('proficiencyChanged', {
                        detail: { triggerCleanup: true, forcedRefresh: true }
                    }));
                }, 100);

                // Show unsaved changes
                characterHandler.showUnsavedChanges();
            }

            // Trigger an event to update the UI
            document.dispatchEvent(new CustomEvent('characterChanged'));
        }
    }

    /**
     * Update character proficiencies based on selected background
     * @param {Background} background - The selected background
     * @param {Object} variant - Selected variant
     * @private
     */
    _updateBackgroundProficiencies(background, variant) {
        const character = characterHandler.currentCharacter;
        if (!character || !background) return;

        // Store previous skill and language selections to restore valid ones
        const prevBackgroundSkillsSelected = character.optionalProficiencies.skills.background?.selected || [];
        const prevBackgroundLanguagesSelected = character.optionalProficiencies.languages.background?.selected || [];

        // Get fixed proficiencies from background
        const fixedProfs = background.getFixedProficiencies();

        // Add fixed skill proficiencies - this will automatically refund any selected skills
        for (const skill of fixedProfs.skills) {
            character.addProficiency('skills', skill, 'Background');
        }

        // Add fixed tool proficiencies
        for (const tool of fixedProfs.tools) {
            character.addProficiency('tools', tool, 'Background');
        }

        // Reset background skill options
        character.optionalProficiencies.skills.background.allowed = 0;
        character.optionalProficiencies.skills.background.options = [];
        character.optionalProficiencies.skills.background.selected = [];

        // Reset background language options
        character.optionalProficiencies.languages.background.allowed = 0;
        character.optionalProficiencies.languages.background.options = [];
        character.optionalProficiencies.languages.background.selected = [];

        // Set up optional skill proficiencies
        if (background.proficiencies?.skills?.choices?.count > 0) {
            // Set the background skill choice count and options
            character.optionalProficiencies.skills.background.allowed = background.proficiencies.skills.choices.count;

            // Set options - either specific list or 'any' skills
            if (background.proficiencies.skills.choices.from && background.proficiencies.skills.choices.from.length > 0) {
                // Background specifies specific skills to choose from
                character.optionalProficiencies.skills.background.options = [...background.proficiencies.skills.choices.from];
            } else if (background.proficiencies.skills.choices.anyCount) {
                // Background allows any skills - get all skills
                const allSkills = this._getAllSkills();
                character.optionalProficiencies.skills.background.options = allSkills;
            }

            // Restore valid skill selections if any, excluding now-fixed skills
            if (prevBackgroundSkillsSelected.length > 0) {
                const newBackgroundOptions = character.optionalProficiencies.skills.background.options;
                const validSelections = prevBackgroundSkillsSelected.filter(skill =>
                    newBackgroundOptions.includes(skill) &&
                    !character.proficiencies.skills.includes(skill) &&
                    !fixedProfs.skills.includes(skill));

                character.optionalProficiencies.skills.background.selected =
                    validSelections.slice(0, character.optionalProficiencies.skills.background.allowed);
            }
        }

        // Set up optional tool proficiencies
        if (background.proficiencies?.tools?.choices?.count > 0) {
            character.optionalProficiencies.tools.background.allowed = background.proficiencies.tools.choices.count;
            character.optionalProficiencies.tools.background.options = background.proficiencies.tools.choices.from || [];
            character.optionalProficiencies.tools.background.selected = [];
        }

        // Handle languages
        if (background.languages) {
            // Add fixed languages
            for (const language of background.languages.fixed || []) {
                character.addProficiency('languages', language, 'Background');
            }

            // Set up optional languages
            if (background.languages.choices?.count > 0) {
                character.optionalProficiencies.languages.background.allowed = background.languages.choices.count;

                // Set options - either specific list or 'any' languages
                if (background.languages.choices.from && background.languages.choices.from.length > 0) {
                    // Background specifies specific languages to choose from
                    character.optionalProficiencies.languages.background.options = [...background.languages.choices.from];
                } else {
                    // Background allows ANY language - use the special 'Any' indicator
                    character.optionalProficiencies.languages.background.options = ['Any'];
                }

                // Restore valid language selections if any, excluding now-fixed languages
                if (prevBackgroundLanguagesSelected.length > 0) {
                    const validSelections = prevBackgroundLanguagesSelected.filter(lang =>
                        !character.proficiencies.languages.includes(lang) &&
                        !(background.languages.fixed || []).includes(lang));

                    character.optionalProficiencies.languages.background.selected =
                        validSelections.slice(0, character.optionalProficiencies.languages.background.allowed);
                }

                // Update combined language options
                this._updateCombinedLanguageOptions(character);
            }
        }

        // Update combined skill options
        this._updateCombinedSkillOptions(character);

        // Notify UI to update proficiencies
        document.dispatchEvent(new CustomEvent('proficiencyChanged', {
            detail: { triggerCleanup: true }
        }));
    }

    /**
     * Get all available skills for 'any' selection
     * @returns {string[]} Array of skill names
     * @private
     */
    _getAllSkills() {
        // Try to get skills from a ProficiencyManager if available
        if (window.proficiencyManager && typeof window.proficiencyManager.getAvailableSkills === 'function') {
            // Get skills synchronously if possible
            try {
                return window.proficiencyManager.getAvailableSkills();
            } catch (e) {
                console.warn('Error getting skills from proficiencyManager:', e);
            }
        }

        // Fallback to hardcoded list
        return [
            'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
            'Deception', 'History', 'Insight', 'Intimidation',
            'Investigation', 'Medicine', 'Nature', 'Perception',
            'Performance', 'Persuasion', 'Religion', 'Sleight of Hand',
            'Stealth', 'Survival'
        ];
    }

    /**
     * Updates the combined skill options from race, class and background
     * @param {Character} character - The character object
     * @private
     */
    _updateCombinedSkillOptions(character) {
        if (!character) return;

        const raceAllowed = character.optionalProficiencies.skills.race?.allowed || 0;
        const classAllowed = character.optionalProficiencies.skills.class?.allowed || 0;
        const backgroundAllowed = character.optionalProficiencies.skills.background?.allowed || 0;

        const raceOptions = character.optionalProficiencies.skills.race?.options || [];
        const classOptions = character.optionalProficiencies.skills.class?.options || [];
        const backgroundOptions = character.optionalProficiencies.skills.background?.options || [];

        const raceSelected = character.optionalProficiencies.skills.race?.selected || [];
        const classSelected = character.optionalProficiencies.skills.class?.selected || [];
        const backgroundSelected = character.optionalProficiencies.skills.background?.selected || [];

        // Update total allowed count
        character.optionalProficiencies.skills.allowed = raceAllowed + classAllowed + backgroundAllowed;

        // Combine selected skills from all sources
        character.optionalProficiencies.skills.selected = [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];

        // For combined options, include options from all sources
        character.optionalProficiencies.skills.options = [...new Set([...raceOptions, ...classOptions, ...backgroundOptions])];
    }

    /**
     * Updates the combined language options from race, class and background
     * @param {Character} character - The character object
     * @private
     */
    _updateCombinedLanguageOptions(character) {
        if (!character) return;

        const raceAllowed = character.optionalProficiencies.languages.race?.allowed || 0;
        const classAllowed = character.optionalProficiencies.languages.class?.allowed || 0;
        const backgroundAllowed = character.optionalProficiencies.languages.background?.allowed || 0;

        const raceOptions = character.optionalProficiencies.languages.race?.options || [];
        const classOptions = character.optionalProficiencies.languages.class?.options || [];
        const backgroundOptions = character.optionalProficiencies.languages.background?.options || [];

        const raceSelected = character.optionalProficiencies.languages.race?.selected || [];
        const classSelected = character.optionalProficiencies.languages.class?.selected || [];
        const backgroundSelected = character.optionalProficiencies.languages.background?.selected || [];

        // Update total allowed count
        character.optionalProficiencies.languages.allowed = raceAllowed + classAllowed + backgroundAllowed;

        // Combine selected languages from all sources
        character.optionalProficiencies.languages.selected = [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];

        // For combined options, include options from all sources
        character.optionalProficiencies.languages.options = [...new Set([...raceOptions, ...classOptions, ...backgroundOptions])];
    }

    /**
     * Set placeholder content when no entity is selected
     */
    setPlaceholderContent() {
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
} 