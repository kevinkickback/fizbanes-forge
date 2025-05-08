/**
 * Character.js
 * Model class representing a character in the D&D Character Creator
 */

/**
 * Represents a character with all its attributes, abilities, proficiencies, and features
 */
export class Character {
    /**
     * Creates a new Character instance
     * @param {Object} [data] - Optional character data to initialize with
     */
    constructor(data = {}) {
        /**
         * Unique identifier for the character
         * @type {string|null}
         */
        this.id = data.id || null;

        /**
         * Character's name
         * @type {string}
         */
        this.name = data.name || '';

        /**
         * Player's name
         * @type {string}
         */
        this.playerName = data.playerName || '';

        /**
         * Character's race information
         * @type {Object}
         */
        this.race = data.race || {
            name: '',
            source: '',
            subrace: ''
        };

        /**
         * Character's class information
         * @type {Object}
         */
        this.class = data.class || {
            level: 1
        };

        this.subclass = data.subclass || '';
        this.background = data.background || '';
        this.level = data.level || 1;
        this.lastModified = data.lastModified || new Date().toISOString();

        // Initialize allowed sources with PHB by default, or from data
        this.allowedSources = new Set(
            Array.isArray(data.allowedSources)
                ? data.allowedSources
                : (data.allowedSources instanceof Set
                    ? Array.from(data.allowedSources)
                    : ['PHB'])
        );

        // Initialize ability scores
        this.abilityScores = data.abilityScores || {
            strength: 8,
            dexterity: 8,
            constitution: 8,
            intelligence: 8,
            wisdom: 8,
            charisma: 8
        };

        // Initialize ability bonuses
        this.abilityBonuses = data.abilityBonuses || {
            strength: [],
            dexterity: [],
            constitution: [],
            intelligence: [],
            wisdom: [],
            charisma: []
        };

        // Initialize pending ability choices
        this.pendingAbilityChoices = data.pendingAbilityChoices || [];

        this.size = data.size || 'M';
        this.speed = data.speed || { walk: 30 };

        // Initialize features
        this.features = {
            darkvision: data.features?.darkvision || 0,
            resistances: new Set(data.features?.resistances || []),
            traits: new Map(data.features?.traits ? Object.entries(data.features.traits) : [])
        };

        // Initialize proficiencies
        this.proficiencies = data.proficiencies || {
            armor: [],
            weapons: [],
            tools: [],
            skills: [],
            languages: [],
            savingThrows: []
        };

        // Initialize proficiency sources
        this.proficiencySources = {
            armor: new Map(),
            weapons: new Map(),
            tools: new Map(),
            skills: new Map(),
            languages: new Map(),
            savingThrows: new Map()
        };

        // Restore proficiency sources if available in the data
        if (data.proficiencySources) {
            for (const type in this.proficiencySources) {
                if (data.proficiencySources[type]) {
                    // Handle serialized Map data
                    if (typeof data.proficiencySources[type] === 'object') {
                        for (const [key, sourceList] of Object.entries(data.proficiencySources[type])) {
                            // Convert the source list to a Set
                            if (Array.isArray(sourceList)) {
                                this.proficiencySources[type].set(key, new Set(sourceList));
                            } else {
                                this.proficiencySources[type].set(key, new Set([sourceList]));
                            }
                        }
                    }
                }
            }
        }

        // Add structure for optional proficiencies
        this.optionalProficiencies = data.optionalProficiencies || {
            armor: { allowed: 0, selected: [] },
            weapons: { allowed: 0, selected: [] },
            savingThrows: { allowed: 0, selected: [] },
            skills: {
                allowed: 0,
                options: [],
                selected: [],
                race: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                class: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                background: {
                    allowed: 0,
                    options: [],
                    selected: []
                }
            },
            languages: {
                allowed: 0,
                options: [],
                selected: [],
                race: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                class: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                background: {
                    allowed: 0,
                    options: [],
                    selected: []
                }
            },
            tools: {
                allowed: 0,
                options: [],
                selected: [],
                race: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                class: {
                    allowed: 0,
                    options: [],
                    selected: []
                },
                background: {
                    allowed: 0,
                    options: [],
                    selected: []
                }
            }
        };

        this.pendingChoices = new Map(data.pendingChoices ? Object.entries(data.pendingChoices) : []);
        this.height = data.height || '';
        this.weight = data.weight || '';
        this.gender = data.gender || '';
        this.backstory = data.backstory || '';

        this.equipment = data.equipment || {
            weapons: [],
            armor: [],
            items: []
        };

        // Initialize variant rules with defaults or from data
        this.variantRules = data.variantRules || {
            feats: true,
            multiclassing: true,
            abilityScoreMethod: 'custom' // Options: 'custom', 'pointBuy', 'standardArray'
        };

        // Add Common as a default language if no languages are provided
        if (!this.proficiencies.languages || this.proficiencies.languages.length === 0) {
            this.addLanguage('Common', 'Default');
        }
    }

    /**
     * Gets an ability score value
     * @param {string} ability - Ability score name
     * @returns {number} The ability score value
     */
    getAbilityScore(ability) {
        // Simple getter without manager dependency
        return this.abilityScores[ability] || 0;
    }

    /**
     * Gets an ability score modifier
     * @param {string} ability - Ability score name
     * @returns {number} The ability score modifier
     */
    getAbilityModifier(ability) {
        const score = this.getAbilityScore(ability);
        return Math.floor((score - 10) / 2);
    }

    /**
     * Adds an ability score bonus from a source
     * @param {string} ability - The ability to add the bonus to
     * @param {number} value - The bonus value
     * @param {string} source - The source of the bonus
     */
    addAbilityBonus(ability, value, source) {
        // Handle null or undefined ability
        if (!ability) {
            console.warn(`Attempted to add ability bonus with undefined ability name (value: ${value}, source: ${source})`);
            return;
        }

        // Normalize the ability name
        const normalizedAbility = ability.toLowerCase()
            .replace(/^str$/, 'strength')
            .replace(/^dex$/, 'dexterity')
            .replace(/^con$/, 'constitution')
            .replace(/^int$/, 'intelligence')
            .replace(/^wis$/, 'wisdom')
            .replace(/^cha$/, 'charisma');

        if (!this.abilityBonuses[normalizedAbility]) {
            this.abilityBonuses[normalizedAbility] = [];
        }

        // Check if a bonus from this source already exists
        const existingBonus = this.abilityBonuses[normalizedAbility].find(bonus => bonus.source === source);
        if (existingBonus) {
            // Update existing bonus
            existingBonus.value = value;
        } else {
            // Add new bonus
            this.abilityBonuses[normalizedAbility].push({ value, source });
        }
    }

    /**
     * Clears ability bonuses from a specific source
     * @param {string} source - Source to clear bonuses from
     */
    clearAbilityBonuses(source) {
        for (const ability in this.abilityBonuses) {
            this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
                bonus => bonus.source !== source
            );
        }
    }

    /**
     * Clears ability bonuses from the character model that start with a specific prefix.
     * @param {string} prefix - The prefix to match against the bonus source (case-insensitive).
     */
    clearAbilityBonusesByPrefix(prefix) {
        if (!prefix) return;
        const lowerCasePrefix = prefix.toLowerCase();
        for (const ability in this.abilityBonuses) {
            if (Array.isArray(this.abilityBonuses[ability])) {
                this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(bonus =>
                    !bonus.source || !bonus.source.toLowerCase().startsWith(lowerCasePrefix)
                );
            }
        }
    }

    /**
     * Adds a pending choice of a specific type
     * @param {string} type - Choice type
     * @param {Object} choice - Choice details
     */
    addPendingChoice(type, choice) {
        if (!this.pendingChoices.has(type)) {
            this.pendingChoices.set(type, []);
        }
        this.pendingChoices.get(type).push(choice);

        // Also add to ability choices if it's an ability choice
        if (type === 'ability') {
            this.pendingAbilityChoices.push(choice);
        }
    }

    /**
     * Gets simple pending ability choices
     * @returns {Array} Pending ability choices
     */
    getSimplePendingAbilityChoices() {
        return this.pendingAbilityChoices;
    }

    /**
     * Clears all pending ability choices
     */
    clearPendingAbilityChoices() {
        this.pendingAbilityChoices = [];
    }

    /**
     * Gets pending choices of a specific type
     * @param {string} type - Choice type to get
     * @returns {Array} Choices of the specified type
     */
    getPendingChoicesByType(type) {
        return this.pendingChoices.get(type) || [];
    }

    /**
     * Clears pending choices of a specific type or all types
     * @param {string} [type] - Choice type to clear (omit to clear all)
     */
    clearPendingChoicesByType(type) {
        if (type === 'ability') {
            // Clear ability choices array
            this.pendingAbilityChoices = [];
        } else if (type) {
            // Clear specific type from pendingChoices Map
            this.pendingChoices.delete(type);
        } else {
            // Clear all choices
            this.pendingChoices.clear();
            this.pendingAbilityChoices = [];
        }
    }

    /**
     * Adds a proficiency with its source
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @param {string} source - Source of the proficiency
     */
    addProficiency(type, proficiency, source) {
        // Ensure the proficiency array exists
        if (!this.proficiencies[type]) {
            this.proficiencies[type] = [];
        }

        // Add to proficiencies array if not already present
        if (!this.proficiencies[type].includes(proficiency)) {
            this.proficiencies[type].push(proficiency);
        }

        // Ensure the source tracking exists
        if (!this.proficiencySources[type]) {
            this.proficiencySources[type] = new Map();
        }
        if (!this.proficiencySources[type].has(proficiency)) {
            this.proficiencySources[type].set(proficiency, new Set());
        }

        // Add the source
        this.proficiencySources[type].get(proficiency).add(source);

        // Handle auto-refunding when adding a fixed proficiency
        // Skip if the source itself indicates it's from a choice
        if (type === 'skills' && !source.includes('Choice')) {
            this._refundOptionalSkillIfFixed(proficiency, source);
        }
    }

    /**
     * Automatically refund a skill selection if it's now granted as a fixed proficiency
     * @param {string} skill - The skill being added as a fixed proficiency
     * @param {string} source - The source adding the fixed proficiency
     * @private
     */
    _refundOptionalSkillIfFixed(skill, source) {
        // Don't refund if optional proficiencies aren't initialized yet
        if (!this.optionalProficiencies?.skills) return;

        // Normalize the skill name for case-insensitive comparison
        const normalizedSkill = skill.toLowerCase().trim();

        // Check each source of optional skill selections
        const sources = ['race', 'class', 'background'];
        let refunded = false;

        for (const src of sources) {
            // Skip the source that's adding the fixed proficiency
            if ((src === 'race' && source === 'Race') ||
                (src === 'class' && source === 'Class') ||
                (src === 'background' && source === 'Background')) {
                continue;
            }

            // Check if this skill is in the selected list for this source (case-insensitive)
            const selected = this.optionalProficiencies.skills[src]?.selected || [];
            const matchingSkill = selected.find(s => s.toLowerCase().trim() === normalizedSkill);

            if (matchingSkill) {
                // Remove from this source's selected list
                this.optionalProficiencies.skills[src].selected =
                    selected.filter(s => s !== matchingSkill);

                refunded = true;
            }
        }

        // If we refunded anything, update the combined selected list
        if (refunded) {
            const raceSelected = this.optionalProficiencies.skills.race?.selected || [];
            const classSelected = this.optionalProficiencies.skills.class?.selected || [];
            const backgroundSelected = this.optionalProficiencies.skills.background?.selected || [];

            this.optionalProficiencies.skills.selected =
                [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];

            // Dispatch an event to update the UI, but do it after a small delay
            // to ensure the DOM has updated with the new proficiency
            if (typeof document !== 'undefined') {
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('proficiencyChanged', {
                        detail: { triggerCleanup: true, refundedSkill: skill }
                    }));
                }, 50);
            }
        }
    }

    /**
     * Removes proficiencies from a specific source
     * @param {string} source - Source to remove proficiencies from
     */
    removeProficienciesBySource(source) {
        for (const type in this.proficiencySources) {
            for (const [proficiency, sources] of this.proficiencySources[type].entries()) {
                sources.delete(source);
                if (sources.size === 0) {
                    this.proficiencySources[type].delete(proficiency);
                    const index = this.proficiencies[type].indexOf(proficiency);
                    if (index > -1) {
                        this.proficiencies[type].splice(index, 1);
                    }
                }
            }
        }
    }

    /**
     * Adds a language proficiency
     * @param {string} language - Language name
     * @param {string} source - Source of the proficiency
     */
    addLanguage(language, source) {
        this.addProficiency('languages', language, source);
    }

    /**
     * Removes languages from a specific source
     * @param {string} source - Source to remove languages from
     */
    removeLanguagesBySource(source) {
        this.removeProficienciesBySource(source);
    }

    /**
     * Adds a damage resistance
     * @param {string} resistance - Resistance type
     * @param {string} source - Source of the resistance
     */
    addResistance(resistance, source) {
        this.features.resistances.add(resistance);
    }

    /**
     * Clears all resistances
     * @param {string} source - Source to clear resistances from
     */
    clearResistances(source) {
        this.features.resistances.clear();
    }

    /**
     * Adds a trait to the character
     * @param {string} name - Trait name
     * @param {string} description - Trait description
     * @param {string} source - Source of the trait
     */
    addTrait(name, description, source) {
        this.features.traits.set(name, { description, source });
    }

    /**
     * Clears traits from a specific source
     * @param {string} source - Source to clear traits from
     */
    clearTraits(source) {
        for (const [name, trait] of this.features.traits.entries()) {
            if (trait.source === source) {
                this.features.traits.delete(name);
            }
        }
    }

    /**
     * Adds an allowed source book
     * @param {string} source - Source book to allow
     */
    addAllowedSource(source) {
        if (source) {
            this.allowedSources.add(source.toUpperCase());
        }
    }

    /**
     * Removes an allowed source book
     * @param {string} source - Source book to disallow
     */
    removeAllowedSource(source) {
        if (source) {
            this.allowedSources.delete(source.toUpperCase());
        }
    }

    /**
     * Checks if a source book is allowed
     * @param {string} source - Source book to check
     * @returns {boolean} Whether the source is allowed
     */
    isSourceAllowed(source) {
        const isAllowed = source ? this.allowedSources.has(source.toUpperCase()) : false;
        return isAllowed;
    }

    /**
     * Sets the entire list of allowed source books
     * @param {Array<string>} sources - List of source books to allow
     */
    setAllowedSources(sources) {
        this.allowedSources = new Set(sources);
    }

    /**
     * Gets all allowed source books
     * @returns {Set<string>} Set of allowed source books
     */
    getAllowedSources() {
        return new Set(this.allowedSources);
    }

    /**
     * Creates a Character instance from JSON data
     * @param {Object} data - Serialized character data
     * @returns {Character} New Character instance
     * @static
     */
    static fromJSON(data) {
        return new Character(data);
    }

    /**
     * Converts the character to a JSON object for saving
     * @returns {Object} JSON representation of the character
     */
    toJSON() {
        // Helper function to safely convert a Map to an object
        const mapToObject = (map) => {
            if (!map || typeof map !== 'object') return {};

            try {
                return Object.fromEntries(
                    Array.from(map.entries()).map(([key, value]) => {
                        // Convert Set values to arrays
                        if (value instanceof Set) {
                            return [key, Array.from(value)];
                        }
                        return [key, value];
                    })
                );
            } catch (error) {
                return {}; // Return empty object on error
            }
        };

        // Helper function to ensure arrays are safe for serialization
        const safeArray = (arr) => {
            if (!arr) return [];
            if (Array.isArray(arr)) return [...arr];
            if (arr instanceof Set) return Array.from(arr);
            return [];
        };

        // Create a clean object with just the data we need
        const serializedData = {
            id: this.id,
            name: this.name,
            allowedSources: Array.from(this.allowedSources || []),
            playerName: this.playerName,
            level: this.level,
            lastModified: new Date().toISOString(),
            height: this.height || '',
            weight: this.weight || '',
            gender: this.gender || '',
            backstory: this.backstory || '',

            // Ability scores and bonuses
            abilityScores: { ...this.abilityScores },
            abilityBonuses: { ...this.abilityBonuses },

            // Race, class, background
            race: this.race ? { ...this.race } : { name: '', source: '', subrace: '' },
            class: this.class ? { ...this.class } : { level: 1 },
            subclass: this.subclass || '',
            background: this.background ? (typeof this.background === 'object' ? { ...this.background } : { name: this.background }) : {},

            // Size and speed
            size: this.size || 'M',
            speed: this.speed ? { ...this.speed } : { walk: 30 },

            // Features and proficiencies
            features: {
                darkvision: this.features?.darkvision || 0,
                resistances: Array.from(this.features?.resistances || []),
                traits: mapToObject(this.features?.traits)
            },

            proficiencies: {
                armor: safeArray(this.proficiencies?.armor),
                weapons: safeArray(this.proficiencies?.weapons),
                tools: safeArray(this.proficiencies?.tools),
                skills: safeArray(this.proficiencies?.skills),
                languages: safeArray(this.proficiencies?.languages),
                savingThrows: safeArray(this.proficiencies?.savingThrows)
            },

            // Proficiency sources (convert Maps to serializable objects)
            proficiencySources: {
                armor: mapToObject(this.proficiencySources?.armor),
                weapons: mapToObject(this.proficiencySources?.weapons),
                tools: mapToObject(this.proficiencySources?.tools),
                skills: mapToObject(this.proficiencySources?.skills),
                languages: mapToObject(this.proficiencySources?.languages),
                savingThrows: mapToObject(this.proficiencySources?.savingThrows)
            }
        };

        // Handle optional proficiencies separately with careful error handling
        try {
            if (this.optionalProficiencies) {
                serializedData.optionalProficiencies = {
                    // Simple types
                    armor: this.optionalProficiencies.armor ? {
                        allowed: this.optionalProficiencies.armor.allowed || 0,
                        selected: safeArray(this.optionalProficiencies.armor.selected)
                    } : { allowed: 0, selected: [] },

                    weapons: this.optionalProficiencies.weapons ? {
                        allowed: this.optionalProficiencies.weapons.allowed || 0,
                        selected: safeArray(this.optionalProficiencies.weapons.selected)
                    } : { allowed: 0, selected: [] },

                    savingThrows: this.optionalProficiencies.savingThrows ? {
                        allowed: this.optionalProficiencies.savingThrows.allowed || 0,
                        selected: safeArray(this.optionalProficiencies.savingThrows.selected)
                    } : { allowed: 0, selected: [] },

                    // Complex types with source-specific details
                    skills: this._serializeComplexProficiency('skills'),
                    languages: this._serializeComplexProficiency('languages'),
                    tools: this._serializeComplexProficiency('tools')
                };
            }
        } catch (error) {
            // Provide empty default structure
            serializedData.optionalProficiencies = {
                armor: { allowed: 0, selected: [] },
                weapons: { allowed: 0, selected: [] },
                savingThrows: { allowed: 0, selected: [] },
                skills: { allowed: 0, options: [], selected: [] },
                languages: { allowed: 0, options: [], selected: [] },
                tools: { allowed: 0, options: [], selected: [] }
            };
        }

        // Add pendingAbilityChoices if they exist
        if (this.pendingAbilityChoices && Array.isArray(this.pendingAbilityChoices)) {
            serializedData.pendingAbilityChoices = [...this.pendingAbilityChoices];
        } else {
            serializedData.pendingAbilityChoices = [];
        }

        // Add variant rules if they exist
        if (this.variantRules) {
            serializedData.variantRules = { ...this.variantRules };
        }

        return serializedData;
    }

    /**
     * Helper method to serialize complex proficiency types (skills, languages, tools)
     * @param {string} type - The proficiency type (skills, languages, tools)
     * @returns {Object} The serialized proficiency object
     * @private
     */
    _serializeComplexProficiency(type) {
        // Helper function to ensure arrays are safe for serialization
        const safeArray = (arr) => {
            if (!arr) return [];
            if (Array.isArray(arr)) return [...arr];
            if (arr instanceof Set) return Array.from(arr);
            return [];
        };

        if (!this.optionalProficiencies || !this.optionalProficiencies[type]) {
            // Return default structure if missing
            return {
                allowed: 0,
                options: [],
                selected: [],
                race: { allowed: 0, options: [], selected: [] },
                class: { allowed: 0, options: [], selected: [] },
                background: { allowed: 0, options: [], selected: [] }
            };
        }

        const result = {
            allowed: this.optionalProficiencies[type].allowed || 0,
            options: safeArray(this.optionalProficiencies[type].options),
            selected: safeArray(this.optionalProficiencies[type].selected)
        };

        // Add source-specific details
        for (const source of ['race', 'class', 'background']) {
            if (this.optionalProficiencies[type][source]) {
                result[source] = {
                    allowed: this.optionalProficiencies[type][source].allowed || 0,
                    options: safeArray(this.optionalProficiencies[type][source].options),
                    selected: safeArray(this.optionalProficiencies[type][source].selected)
                };
            } else {
                // Default empty structure
                result[source] = { allowed: 0, options: [], selected: [] };
            }
        }

        return result;
    }

    /**
     * Add a pending ability choice
     * @param {Object} choice - The ability choice object
     */
    addPendingAbilityChoice(choice) {
        this.pendingAbilityChoices.push(choice);
    }

    /**
     * Get all pending ability choices
     * @returns {Array} Array of pending ability choices
     */
    getPendingAbilityChoices() {
        return this.pendingAbilityChoices;
    }
} 