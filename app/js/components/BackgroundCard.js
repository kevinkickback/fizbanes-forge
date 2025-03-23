/**
 * BackgroundCard.js
 * Component for displaying and selecting character backgrounds
 */

import { backgroundManager } from '../managers/BackgroundManager.js';
import { Card } from './Card.js';
import { TextProcessor } from '../utils/TextProcessor.js';
import { referenceResolver } from '../utils/ReferenceResolver.js';
import { eventBus } from '../utils/EventBus.js';

/**
 * @typedef {Object} Background
 * @property {string} id - Unique identifier of background
 * @property {string} name - Name of the background
 * @property {string} source - Source book abbreviation
 * @property {string} description - Background description
 * @property {Object} proficiencies - Background proficiencies
 * @property {Object} languages - Background languages
 * @property {Array} equipment - Background equipment
 * @property {Object} feature - Background feature
 */

export class BackgroundCard extends Card {
    /**
     * Creates a new BackgroundCard instance
     * @param {HTMLElement} container - The DOM element to attach the card to
     */
    constructor(container) {
        super(container, 'Background', 'background-card');
        this.textProcessor = new TextProcessor(referenceResolver);
        this.selectedBackground = null;

        // Initialize UI components
        this.renderBackgroundSelection();
        this.renderDetailSections();

        // Set up event listeners
        eventBus.on('character:background-changed', this._updateBackground.bind(this));
    }

    /**
     * Create dropdown for selecting a background
     */
    renderBackgroundSelection() {
        const selectionContainer = document.createElement('div');
        selectionContainer.className = 'selection-container';

        // Create dropdown for background selection
        this.backgroundSelect = document.createElement('select');
        this.backgroundSelect.id = 'background-select';
        this.backgroundSelect.className = 'item-select';

        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select a background...';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        this.backgroundSelect.appendChild(placeholderOption);

        // Add background options
        const backgrounds = backgroundManager.getAllBackgrounds();
        if (backgrounds && backgrounds.length > 0) {
            // Sort backgrounds alphabetically by name
            backgrounds.sort((a, b) => a.name.localeCompare(b.name));

            for (const background of backgrounds) {
                const option = document.createElement('option');
                option.value = background.id;
                option.textContent = `${background.name} (${background.source})`;
                this.backgroundSelect.appendChild(option);
            }
        }

        // Add change event listener
        this.backgroundSelect.addEventListener('change', this._handleBackgroundSelection.bind(this));

        selectionContainer.appendChild(this.backgroundSelect);
        this.content.appendChild(selectionContainer);
    }

    /**
     * Create sections for background details (description, proficiencies, etc.)
     */
    renderDetailSections() {
        // Container for all details
        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'background-details hidden';

        // Description section
        this.descriptionSection = document.createElement('div');
        this.descriptionSection.className = 'detail-section';

        const descriptionTitle = document.createElement('h3');
        descriptionTitle.textContent = 'Description';
        this.descriptionSection.appendChild(descriptionTitle);

        this.descriptionContent = document.createElement('div');
        this.descriptionContent.className = 'section-content description-content';
        this.descriptionSection.appendChild(this.descriptionContent);

        // Proficiencies section
        this.proficienciesSection = document.createElement('div');
        this.proficienciesSection.className = 'detail-section';

        const proficienciesTitle = document.createElement('h3');
        proficienciesTitle.textContent = 'Proficiencies';
        this.proficienciesSection.appendChild(proficienciesTitle);

        // Skills
        const skillsLabel = document.createElement('h4');
        skillsLabel.textContent = 'Skills';
        this.proficienciesSection.appendChild(skillsLabel);

        this.skillContent = document.createElement('div');
        this.skillContent.className = 'section-content';
        this.proficienciesSection.appendChild(this.skillContent);

        // Tools
        const toolsLabel = document.createElement('h4');
        toolsLabel.textContent = 'Tools';
        this.proficienciesSection.appendChild(toolsLabel);

        this.toolContent = document.createElement('div');
        this.toolContent.className = 'section-content';
        this.proficienciesSection.appendChild(this.toolContent);

        // Languages
        const languagesLabel = document.createElement('h4');
        languagesLabel.textContent = 'Languages';
        this.proficienciesSection.appendChild(languagesLabel);

        this.languageContent = document.createElement('div');
        this.languageContent.className = 'section-content';
        this.proficienciesSection.appendChild(this.languageContent);

        // Equipment section
        this.equipmentSection = document.createElement('div');
        this.equipmentSection.className = 'detail-section';

        const equipmentTitle = document.createElement('h3');
        equipmentTitle.textContent = 'Equipment';
        this.equipmentSection.appendChild(equipmentTitle);

        this.equipmentContent = document.createElement('div');
        this.equipmentContent.className = 'section-content';
        this.equipmentSection.appendChild(this.equipmentContent);

        // Feature section
        this.featureSection = document.createElement('div');
        this.featureSection.className = 'detail-section';

        const featureTitle = document.createElement('h3');
        featureTitle.textContent = 'Feature';
        this.featureSection.appendChild(featureTitle);

        this.featureNameContent = document.createElement('h4');
        this.featureSection.appendChild(this.featureNameContent);

        this.featureContent = document.createElement('div');
        this.featureContent.className = 'section-content';
        this.featureSection.appendChild(this.featureContent);

        // Add all sections to details container
        this.detailsContainer.appendChild(this.descriptionSection);
        this.detailsContainer.appendChild(this.proficienciesSection);
        this.detailsContainer.appendChild(this.equipmentSection);
        this.detailsContainer.appendChild(this.featureSection);

        // Add details container to card content
        this.content.appendChild(this.detailsContainer);
    }

    /**
     * Handle background selection from dropdown
     * @param {Event} event - Change event
     * @private
     */
    _handleBackgroundSelection(event) {
        const backgroundId = event.target.value;
        if (!backgroundId) return;

        const [name, source] = backgroundId.split('_');
        const selectedBackground = backgroundManager.selectBackground(name, source);

        if (selectedBackground) {
            eventBus.emit('character:background-changed', selectedBackground);
        }
    }

    /**
     * Update the display when a background is selected
     * @param {Background} background - The selected background
     * @private
     */
    _updateBackground(background) {
        this.selectedBackground = background;

        if (!background) {
            this.detailsContainer.classList.add('hidden');
            return;
        }

        // Update UI to show selected background
        this.backgroundSelect.value = background.id;
        this.detailsContainer.classList.remove('hidden');

        // Update description
        this.descriptionContent.textContent = background.description || 'No description available.';
        this.textProcessor.processPageContent(this.descriptionContent);

        // Update skill proficiencies
        this.skillContent.textContent = backgroundManager.getFormattedSkillProficiencies(background) || 'None';

        // Update tool proficiencies
        this.toolContent.textContent = backgroundManager.getFormattedToolProficiencies(background) || 'None';

        // Update languages
        this.languageContent.textContent = backgroundManager.getFormattedLanguages(background) || 'None';

        // Update equipment
        this.equipmentContent.textContent = backgroundManager.getFormattedEquipment(background) || 'None';

        // Update feature
        if (background.feature?.name) {
            this.featureNameContent.textContent = background.feature.name;
            this.featureContent.textContent = background.feature.description || 'No description available.';
            this.textProcessor.processPageContent(this.featureContent);
            this.featureSection.classList.remove('hidden');
        } else {
            this.featureNameContent.textContent = '';
            this.featureContent.textContent = 'No feature available.';
            this.featureSection.classList.add('hidden');
        }
    }
} 