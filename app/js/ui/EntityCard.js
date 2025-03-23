/**
 * EntityCard.js
 * Unified card component for displaying entity information
 */

import { textProcessor } from '../utils/TextProcessor.js';

export class EntityCard {
    /**
     * Create a new EntityCard
     * @param {Object} options - Configuration options
     * @param {string} options.entityType - Type of entity this card represents
     * @param {string} options.selectElementId - ID of the select element
     * @param {string} options.imageElementId - ID of the image container element
     * @param {string} options.quickDescElementId - ID of the quick description element
     * @param {string} options.detailsElementId - ID of the details container element
     * @param {string} options.placeholderTitle - Title to show when no entity is selected
     * @param {string} options.placeholderDesc - Description to show when no entity is selected
     */
    constructor(options) {
        this.entityType = options.entityType;
        this.selectElementId = options.selectElementId;
        this.imageElementId = options.imageElementId;
        this.quickDescElementId = options.quickDescElementId;
        this.detailsElementId = options.detailsElementId;
        this.placeholderTitle = options.placeholderTitle;
        this.placeholderDesc = options.placeholderDesc;
    }

    /**
     * Update the entity image
     * @param {string} imageUrl - URL to the entity image
     */
    updateEntityImage(imageUrl) {
        const imageElement = document.getElementById(this.imageElementId);
        if (!imageElement) return;

        if (imageUrl) {
            imageElement.innerHTML = `<img src="${imageUrl}" alt="Entity image" class="entity-image">`;
        } else {
            imageElement.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
        }
    }

    /**
     * Update the quick description section
     * @param {string} title - Title for the entity
     * @param {string} description - Description text
     */
    updateQuickDescription(title, description) {
        const descElement = document.getElementById(this.quickDescElementId);
        if (!descElement) return;

        descElement.innerHTML = `
            <h5>${title}</h5>
            <p>${description || `${title} features and characteristics.`}</p>`;
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
        const descElement = document.getElementById(this.quickDescElementId);
        if (descElement) {
            descElement.innerHTML = `
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
     * Get placeholder content for details section
     * @returns {string} HTML for placeholder details
     */
    getPlaceholderDetailsContent() {
        return `<div class="placeholder-details">Select ${this.entityType} to see details</div>`;
    }

    /**
     * Create a new EntityCard with container and entity
     * @param {HTMLElement} container - The container element to render the card in
     * @param {Object} entity - The processed entity data
     * @param {Object} manager - The manager object for this entity type
     */
    static withContainerAndEntity(container, entity, manager) {
        const card = new EntityCard({
            entityType: entity.type,
            selectElementId: '',
            imageElementId: '',
            quickDescElementId: '',
            detailsElementId: '',
            placeholderTitle: '',
            placeholderDesc: ''
        });

        card.container = container;
        card.entity = entity;
        card.manager = manager;
        card.character = window.currentCharacter;

        return card;
    }

    /**
     * Render the card
     * @returns {HTMLElement} The rendered card element
     */
    render() {
        const card = document.createElement('div');
        card.className = 'entity-card';
        card.innerHTML = this.getCardContent();

        // Process the card content to resolve reference tags
        setTimeout(() => textProcessor.processElement(card), 0);

        return card;
    }

    getCardContent() {
        const level = this.character?.level || 1;
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${this.entity.name}</h3>
                    <span class="level">Level ${level}</span>
                </div>
                <div class="card-body">
                    ${this.getCardBody()}
                </div>
            </div>
        `;
    }

    getCardBody() {
        return `
            <p class="description">${this.entity.description || ''}</p>
            ${this.getAdditionalContent()}
        `;
    }

    getAdditionalContent() {
        return '';
    }

    /**
     * Render the card body
     * Render extra header content
     * @returns {string} HTML string for extra header content
     */
    renderHeaderExtras() {
        switch (this.entity.type) {
            case 'pack':
                return `<span class="quantity">×${this.entity.quantity || 1}</span>`;
            case 'feat':
                return this.entity.count > 1 ? `<span class="count">×${this.entity.count}</span>` : '';
            case 'class':
                return `<span class="level">Level ${this.character?.level}</span>`;
            default:
                return '';
        }
    }

    /**
     * Render the card body
     * @returns {string} HTML string for the card body
     */
    renderBody() {
        const description = this.entity.description ?
            `<div class="description">${this.entity.description}</div>` : '';

        switch (this.entity.type) {
            case 'race':
                return `
                    ${description}
                    <div class="race-details">
                        <p>Size: ${this.entity.size}</p>
                        ${this.renderSpeed(this.entity.speed)}
                        ${this.renderAbilityScores(this.entity.ability)}
                        ${this.renderTraits(this.entity.traits)}
                        ${this.entity.features.darkvision ? `<p>Darkvision: ${this.entity.features.darkvision} feet</p>` : ''}
                    </div>
                `;
            case 'class':
                return `
                    ${description}
                    <div class="class-details">
                        <p>Hit Dice: ${this.entity.hitDice}</p>
                        ${this.renderProficiencies(this.entity.proficiencies)}
                        ${this.renderFeatures(this.entity.features)}
                        ${this.entity.spellcasting ? this.renderSpellcasting(this.entity.spellcasting) : ''}
                    </div>
                `;
            case 'background':
                return `
                    ${description}
                    <div class="background-details">
                        ${this.renderProficiencies(this.entity.proficiencies)}
                        ${this.renderCharacteristics(this.entity.characteristics)}
                    </div>
                `;
            case 'feat':
                return `
                    ${description}
                    ${this.entity.prerequisite ?
                        `<div class="prerequisite">Prerequisite: ${this.entity.prerequisite}</div>` :
                        ''}
                    ${this.entity.ability ? this.renderAbilityScores(this.entity.ability) : ''}
                `;
            case 'item':
            case 'equipment':
                return `
                    ${description}
                    <div class="item-details">
                        ${this.entity.value ? `<p>Value: ${this.entity.value.amount} ${this.entity.value.coin}</p>` : ''}
                        ${this.entity.weight ? `<p>Weight: ${this.entity.weight} lb.</p>` : ''}
                        ${this.entity.properties?.length ?
                        `<p>Properties: ${this.entity.properties.join(', ')}</p>` : ''}
                        ${this.entity.attunement ?
                        `<p class="attunement">Requires Attunement${typeof this.entity.attunement === 'object' ?
                            ` by ${this.entity.attunement.by}` : ''}</p>` : ''}
                    </div>
                `;
            case 'pack':
                return `
                    ${description}
                    <div class="pack-contents">
                        ${this.renderPackContents()}
                    </div>
                `;
            default:
                return description;
        }
    }

    /**
     * Render the card footer
     * @returns {string} HTML string for the card footer
     */
    renderFooter() {
        return `
            <div class="actions">
                ${this.renderActions()}
            </div>
        `;
    }

    /**
     * Render action buttons
     * @returns {string} HTML string for action buttons
     */
    renderActions() {
        switch (this.entity.type) {
            case 'pack':
                return `
                    <button class="btn btn-sm btn-primary unpack-btn">Unpack</button>
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                `;
            case 'item':
            case 'equipment':
                return `
                    <button class="btn btn-sm btn-primary equip-btn">
                        ${this.entity.equipped ? 'Unequip' : 'Equip'}
                    </button>
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                `;
            case 'feat':
                return `
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                `;
            default:
                return '';
        }
    }

    /**
     * Render speed information
     * @param {Object} speed - Speed data
     * @returns {string} HTML string for speed information
     */
    renderSpeed(speed) {
        return `
            <div class="speed">
                ${Object.entries(speed).map(([type, value]) =>
            `<p>${type.charAt(0).toUpperCase() + type.slice(1)} Speed: ${value} feet</p>`
        ).join('')}
            </div>
        `;
    }

    /**
     * Render ability score information
     * @param {Object} ability - Ability score data
     * @returns {string} HTML string for ability score information
     */
    renderAbilityScores(ability) {
        if (!ability) return '';

        return `
            <div class="ability-scores">
                <h6>Ability Score Increase</h6>
                <ul>
                    ${ability.map(a => {
            if (a.mode === 'fixed') {
                return a.scores.map(score =>
                    `<li>${score} +${a.amount}</li>`
                ).join('');
            }
            return `<li>Choose ${a.scores.length} different abilities to increase by ${a.amount}</li>`;
        }).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render proficiency information
     * @param {Object} proficiencies - Proficiency data
     * @returns {string} HTML string for proficiency information
     */
    renderProficiencies(proficiencies) {
        if (!proficiencies) return '';

        return `
            <div class="proficiencies">
                <h6>Proficiencies</h6>
                <ul>
                    ${proficiencies.armor?.length ?
                `<li><strong>Armor:</strong> ${proficiencies.armor.join(', ')}</li>` : ''}
                    ${proficiencies.weapons?.length ?
                `<li><strong>Weapons:</strong> ${proficiencies.weapons.join(', ')}</li>` : ''}
                    ${proficiencies.tools?.length ?
                `<li><strong>Tools:</strong> ${proficiencies.tools.join(', ')}</li>` : ''}
                    ${proficiencies.languages?.length ?
                `<li><strong>Languages:</strong> ${proficiencies.languages.join(', ')}</li>` : ''}
                    ${proficiencies.skills?.choices?.length ?
                `<li><strong>Skills:</strong> Choose ${proficiencies.skills.choices[0].count} from ${proficiencies.skills.choices[0].from.join(', ')}</li>` : ''}
                </ul>
            </div>
        `;
    }

    /**
     * Render feature information
     * @param {Array} features - Feature data
     * @returns {string} HTML string for feature information
     */
    renderFeatures(features) {
        if (!features?.length) return '';

        return `
            <div class="features-section">
                <h6>Features</h6>
                <div class="features-grid">
                    ${features.map(level =>
            level.features.map(feature =>
                `<span class="feature-tag" data-tooltip="${encodeURIComponent(feature.description)}">${feature.name}</span>`
            ).join('')
        ).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render spellcasting information
     * @param {Object} spellcasting - Spellcasting data
     * @returns {string} HTML string for spellcasting information
     */
    renderSpellcasting(spellcasting) {
        return `
            <div class="spellcasting">
                <h6>Spellcasting</h6>
                <p>Ability: ${spellcasting.ability}</p>
                <p>Progression: ${spellcasting.progression}</p>
            </div>
        `;
    }

    /**
     * Render trait information
     * @param {Array} traits - Trait data
     * @returns {string} HTML string for trait information
     */
    renderTraits(traits) {
        if (!traits?.length) return '';

        return `
            <div class="traits">
                <h6>Traits</h6>
                ${traits.map(trait => `
                    <div class="trait">
                        <strong>${trait.name}:</strong>
                        <div class="trait-description">${trait.description}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render pack contents
     * @returns {string} HTML string for pack contents
     */
    renderPackContents() {
        if (!this.entity.contents?.length) return '';

        return `
            <h6>Contents</h6>
            <ul>
                ${this.entity.contents.map(item =>
            `<li>${item.quantity || 1}× ${item.name}</li>`
        ).join('')}
            </ul>
        `;
    }

    /**
     * Render characteristics information
     * @param {Object} characteristics - Characteristics data
     * @returns {string} HTML string for characteristics information
     */
    renderCharacteristics(characteristics) {
        if (!characteristics) return '';

        return `
            <div class="characteristics">
                <h6>Characteristics</h6>
                ${Object.entries(characteristics).map(([type, options]) => `
                    <div class="characteristic-section">
                        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong>
                        <ul>
                            ${options.map(option => `<li>${option}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
    }
} 