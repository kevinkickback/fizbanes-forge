/**
 * BackgroundUI.js
 * UI class for handling background selection and display
 */

import { EntityCard } from './EntityCard.js';
import { BackgroundManager } from '../managers/BackgroundManager.js';
import { characterInitializer } from '../utils/Initialize.js';

export class BackgroundCard {
    constructor(character) {
        this.character = character;
        this.backgroundManager = new BackgroundManager(character);
        this.textProcessor = characterInitializer.textProcessor;
        this.initialize();
    }

    async initialize() {
        await this.renderBackgroundSelection();
    }

    async renderBackgroundSelection() {
        const backgrounds = await this.backgroundManager.getAvailableBackgrounds();
        const selection = document.querySelector('#backgroundSelect');

        // Update the select options
        selection.innerHTML = `
            <option value="">Choose a background...</option>
            ${backgrounds.map(bg => `
                <option value="${bg.id}">${bg.name}</option>
            `).join('')}
        `;

        // Add variant container if not exists
        let variantContainer = document.querySelector('#variantContainer');
        if (!variantContainer) {
            const selectors = document.querySelector('.background-selectors');
            variantContainer = document.createElement('div');
            variantContainer.id = 'variantContainer';
            variantContainer.className = 'background-select-container';
            variantContainer.style.display = 'none';
            variantContainer.innerHTML = `
                <label for="variantSelect">Variant</label>
                <select class="form-select" id="variantSelect">
                    <option value="">Standard background</option>
                </select>
            `;
            selectors.appendChild(variantContainer);
        }

        this.attachSelectionListeners();
    }

    async renderBackgroundDetails(background) {
        const backgroundImage = document.getElementById('backgroundImage');
        const backgroundQuickDesc = document.getElementById('backgroundQuickDesc');
        const backgroundDetails = document.getElementById('backgroundDetails');

        if (!backgroundImage || !backgroundQuickDesc || !backgroundDetails) return;

        if (!background) {
            this.setBackgroundPlaceholderContent();
            return;
        }

        try {
            // Update background image
            if (background.imageUrl) {
                backgroundImage.innerHTML = `<img src="${background.imageUrl}" alt="${background.name}" class="background-image">`;
            } else {
                backgroundImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            }

            // Update quick description
            backgroundQuickDesc.innerHTML = `
                <h5>${background.name}</h5>
                <p>${this.getQuickDescription(background)}</p>`;

            // Process skill proficiencies
            let skillProficiencies = '<li>None</li>';
            if (background.proficiencies?.skills) {
                const skills = Array.isArray(background.proficiencies.skills)
                    ? background.proficiencies.skills
                    : Object.keys(background.proficiencies.skills);

                if (skills.length > 0) {
                    skillProficiencies = skills
                        .map(skill => `<li>${typeof skill === 'string' ? skill.charAt(0).toUpperCase() + skill.slice(1) : skill}</li>`)
                        .join('');
                }
            }

            // Process tool proficiencies
            let toolProficiencies = '<li>None</li>';
            if (background.proficiencies?.tools) {
                const tools = Array.isArray(background.proficiencies.tools)
                    ? background.proficiencies.tools
                    : Object.keys(background.proficiencies.tools);

                if (tools.length > 0) {
                    toolProficiencies = tools
                        .map(tool => `<li>${typeof tool === 'string' ? tool.charAt(0).toUpperCase() + tool.slice(1) : tool}</li>`)
                        .join('');
                }
            }

            // Process languages
            let languages = '<li>None</li>';
            if (background.languages?.length > 0) {
                languages = background.languages
                    .map(lang => `<li>${typeof lang === 'string' ? lang.charAt(0).toUpperCase() + lang.slice(1) : lang}</li>`)
                    .join('');
            }

            // Process equipment
            let equipment = '<li>None</li>';
            if (background.equipment?.length > 0) {
                equipment = background.equipment
                    .map(item => `<li>${typeof item === 'string' ? item.charAt(0).toUpperCase() + item.slice(1) : item}</li>`)
                    .join('');
            }

            // Update background details
            backgroundDetails.innerHTML = `
                <div class="background-details-grid">
                    <div class="detail-section">
                        <h6>Skill Proficiencies</h6>
                        <ul class="mb-0">
                            ${skillProficiencies}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Tool Proficiencies</h6>
                        <ul class="mb-0">
                            ${toolProficiencies}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Languages</h6>
                        <ul class="mb-0">
                            ${languages}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Equipment</h6>
                        <ul class="mb-0">
                            ${equipment}
                        </ul>
                    </div>
                </div>`;

            // Process tooltips for the newly added content
            const textToProcess = [backgroundQuickDesc, backgroundDetails];
            for (const element of textToProcess) {
                const textNodes = element.querySelectorAll('p, li');
                for (const node of textNodes) {
                    const originalText = node.innerHTML;
                    const processedText = await this.processText(originalText);
                    node.innerHTML = processedText;
                }
            }
        } catch (error) {
            console.error('Error rendering background details:', error);
            this.setBackgroundPlaceholderContent();
        }
    }

    getQuickDescription(background) {
        if (!background) return '';

        // Try to find a description in the entries
        if (background.entries) {
            const desc = background.entries.find(entry =>
                (typeof entry === 'string') ||
                (typeof entry === 'object' && entry.type === 'entries' && !entry.name)
            );

            if (desc) {
                if (typeof desc === 'string') {
                    return desc;
                }
                if (Array.isArray(desc.entries)) {
                    return desc.entries.join(' ');
                }
                if (typeof desc.entries === 'string') {
                    return desc.entries;
                }
            }
        }

        // Fallback to a generic description
        return `${background.name} background features and characteristics.`;
    }

    attachSelectionListeners() {
        const backgroundSelect = document.querySelector('#backgroundSelect');
        const variantSelect = document.querySelector('#variantSelect');
        const variantContainer = document.querySelector('#variantContainer');

        backgroundSelect?.addEventListener('change', async () => {
            const backgroundId = backgroundSelect.value;
            if (!backgroundId) {
                variantContainer.style.display = 'none';
                this.setBackgroundPlaceholderContent();
                return;
            }

            const background = await this.backgroundManager.loadBackground(backgroundId);

            // Update variant options
            if (background.variants?.length > 0) {
                variantSelect.innerHTML = `
                    <option value="">Standard background</option>
                    ${background.variants.map(v => `
                        <option value="${v.name}">${v.name}</option>
                    `).join('')}
                `;
                variantContainer.style.display = 'block';
            } else {
                variantContainer.style.display = 'none';
            }

            // Update background
            await this.backgroundManager.setBackground(backgroundId);
            await this.renderBackgroundDetails(background);
        });

        variantSelect?.addEventListener('change', async () => {
            const backgroundId = backgroundSelect.value;
            const variantName = variantSelect.value;
            if (backgroundId) {
                await this.backgroundManager.setBackground(backgroundId, variantName);
                await this.renderBackgroundDetails(backgroundId);
            }
        });
    }

    /**
     * Set placeholder content for background
     */
    setBackgroundPlaceholderContent() {
        const backgroundImage = document.getElementById('backgroundImage');
        const backgroundQuickDesc = document.getElementById('backgroundQuickDesc');
        const backgroundDetails = document.getElementById('backgroundDetails');

        if (!backgroundImage || !backgroundQuickDesc || !backgroundDetails) return;

        // Set placeholder image
        backgroundImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';

        // Set placeholder quick description
        backgroundQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Background</h5>
                <p>Choose a background to see details about their traits, proficiencies, and other characteristics.</p>
            </div>`;

        // Set placeholder details with grid layout
        backgroundDetails.innerHTML = `
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
            </div>`;
    }

    /**
     * Process text content
     * @param {string} originalText - The text to process
     * @returns {Promise<string>} The processed text
     */
    async processText(originalText) {
        return await this.textProcessor.processString(originalText);
    }
} 