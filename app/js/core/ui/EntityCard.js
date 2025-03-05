/**
 * EntityCard.js
 * Unified card component for displaying entity information
 */

export class EntityCard {
    /**
     * Create a new EntityCard
     * @param {HTMLElement} container - The container element to render the card in
     * @param {Object} entity - The processed entity data
     * @param {Object} manager - The manager object for this entity type
     */
    constructor(container, entity, manager) {
        this.container = container;
        this.entity = entity;
        this.manager = manager;
    }

    /**
     * Render the card
     * @returns {string} HTML string for the card
     */
    render() {
        return `
            <div class="entity-card ${this.entity.type}-card" data-id="${this.entity.id}">
                <div class="card-header">
                    <h4>${this.entity.name}</h4>
                    ${this.renderHeaderExtras()}
                </div>
                <div class="card-body">
                    ${this.renderBody()}
                </div>
                <div class="card-footer">
                    ${this.renderFooter()}
                </div>
            </div>
        `;
    }

    /**
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
                return `<span class="level">Level ${window.currentCharacter.level}</span>`;
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
            <div class="features">
                <h6>Features</h6>
                ${features.map(level => `
                    <div class="feature-level">
                        <h6>Level ${level.level}</h6>
                        ${level.features.map(feature => `
                            <div class="feature">
                                <strong>${feature.name}:</strong>
                                <div class="feature-description">${feature.description}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
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