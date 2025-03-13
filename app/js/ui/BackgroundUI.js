/**
 * BackgroundUI.js
 * UI class for handling background selection and display
 */

import { EntityCard } from './EntityCard.js';

export class BackgroundUI {
    constructor(container, backgroundManager) {
        this.container = container;
        this.backgroundManager = backgroundManager;
        this.initialize();
    }

    async initialize() {
        this.container.innerHTML = `
            <div class="background-selection-controls">
                <div class="background-selectors">
                    <div class="background-select-container">
                        <select class="form-select" id="backgroundSelect">
                            <option value="">Choose a background...</option>
                        </select>
                    </div>
                </div>
                <div class="background-content-container">
                    <div class="background-quick-desc" id="backgroundQuickDesc">
                        <!-- Quick description will be added here -->
                    </div>
                </div>
            </div>
            <div class="background-image-container">
                <div class="background-image" id="backgroundImage">
                    <!-- Background image will be set dynamically -->
                    <i class="fas fa-user-circle placeholder-icon"></i>
                </div>
            </div>
            <div id="backgroundDetails">
                <!-- Background details will be rendered here -->
            </div>
        `;

        await this.renderBackgroundSelection();

        // Show placeholder if no background is selected
        if (!this.backgroundManager.selectedBackground) {
            this.setBackgroundPlaceholderContent();
        }
    }

    async renderBackgroundSelection() {
        const backgrounds = await this.backgroundManager.getAvailableBackgrounds();
        const selection = this.container.querySelector('#backgroundSelect');

        // Update the select options
        selection.innerHTML = `
            <option value="">Choose a background...</option>
            ${backgrounds.map(bg => `
                <option value="${bg.id}">${bg.name}</option>
            `).join('')}
        `;

        // Add variant container if not exists
        let variantContainer = this.container.querySelector('#variantContainer');
        if (!variantContainer) {
            const selectors = this.container.querySelector('.background-selectors');
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
                <h6>Background Description</h6>
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
                </div>`;

            // Process tooltips for the newly added content
            const textToProcess = [backgroundQuickDesc, backgroundDetails];
            for (const element of textToProcess) {
                const textNodes = element.querySelectorAll('p, li');
                for (const node of textNodes) {
                    const originalText = node.innerHTML;
                    const processedText = await window.dndTextProcessor.processText(originalText);
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

    async renderCharacteristics(backgroundId) {
        const options = await this.backgroundManager.getCharacteristicOptions();
        if (!options) {
            this.setCharacteristicsPlaceholderContent();
            return;
        }

        const characteristics = this.backgroundManager.getCharacteristics();
        const container = this.container.querySelector('#backgroundCharacteristics');

        container.innerHTML = `
            <div class="characteristics-section">
                <h3>Characteristics</h3>
                
                <div class="form-group">
                    <label>Personality Trait</label>
                    <select class="form-select" name="personalityTrait">
                        <option value="">Choose a personality trait...</option>
                        ${options.personalityTraits.map((trait, i) => `
                            <option value="${i}" ${characteristics.personalityTrait?.value === trait ? 'selected' : ''}>
                                ${trait}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Ideal</label>
                    <select class="form-select" name="ideal">
                        <option value="">Choose an ideal...</option>
                        ${options.ideals.map((ideal, i) => `
                            <option value="${i}" ${characteristics.ideal?.value === ideal ? 'selected' : ''}>
                                ${ideal}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Bond</label>
                    <select class="form-select" name="bond">
                        <option value="">Choose a bond...</option>
                        ${options.bonds.map((bond, i) => `
                            <option value="${i}" ${characteristics.bond?.value === bond ? 'selected' : ''}>
                                ${bond}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Flaw</label>
                    <select class="form-select" name="flaw">
                        <option value="">Choose a flaw...</option>
                        ${options.flaws.map((flaw, i) => `
                            <option value="${i}" ${characteristics.flaw?.value === flaw ? 'selected' : ''}>
                                ${flaw}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;

        this.attachCharacteristicListeners();
    }

    attachSelectionListeners() {
        const backgroundSelect = this.container.querySelector('#backgroundSelect');
        const variantSelect = this.container.querySelector('#variantSelect');
        const variantContainer = this.container.querySelector('#variantContainer');

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
            await this.renderCharacteristics(backgroundId);
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

    attachCharacteristicListeners() {
        const selects = this.container.querySelectorAll('.characteristics-section select');
        for (const select of selects) {
            select?.addEventListener('change', () => {
                const type = select.name;
                const value = select.options[select.selectedIndex].text;
                const index = Number.parseInt(select.value, 10);
                if (value) {
                    this.backgroundManager.setCharacteristic(type, value, index);
                }
            });
        }
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
            <h6>Background Description</h6>
            <p>Select a Background to see their characteristics, proficiencies, and other features.</p>`;

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
            </div>`;
    }

    /**
     * Set placeholder content for characteristics
     */
    setCharacteristicsPlaceholderContent() {
        const container = this.container.querySelector('#backgroundCharacteristics');
        if (!container) return;

        container.innerHTML = `
            <div class="characteristics-section">
                <h3>Characteristics</h3>
                <div class="placeholder-content">
                    <p>Select a background to customize your character's personality traits, ideals, bonds, and flaws.</p>
                </div>
                <div class="detail-section">
                    <h6>Personality Traits</h6>
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Ideals</h6>
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Bonds</h6>
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Flaws</h6>
                    <p class="placeholder-text">—</p>
                </div>
            </div>
        `;
    }
} 