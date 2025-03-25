export class Character {
    constructor() {
        this.id = null;
        this.name = '';
        this.playerName = '';
        this.race = {
            name: '',
            source: '',
            subrace: ''
        }; // Store race info as an object with name and source

        this.class = {
            level: 1
        };
        this.subclass = '';
        this.background = '';
        this.level = 1;
        this.allowedSources = new Set(['PHB']); // Initialize with PHB as default
        this.abilityScores = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };
        this.abilityBonuses = {
            strength: [],
            dexterity: [],
            constitution: [],
            intelligence: [],
            wisdom: [],
            charisma: []
        };
        this.size = 'M';
        this.speed = { walk: 30 };
        this.features = {
            darkvision: 0,
            resistances: new Set(),
            traits: new Map()  // Map of trait name to { description, source }
        };
        this.proficiencies = {
            armor: [],
            weapons: [],
            tools: [],
            skills: [],
            languages: [],
            savingThrows: []
        };
        this.proficiencySources = {
            armor: new Map(),
            weapons: new Map(),
            tools: new Map(),
            skills: new Map(),
            languages: new Map(),
            savingThrows: new Map()
        };
        // Add structure for optional proficiencies
        this.optionalProficiencies = {
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
        this.pendingChoices = new Map(); // Map to store pending choices
        this.height = '';
        this.weight = '';
        this.gender = '';
        this.backstory = '';
        this.equipment = {
            weapons: [],
            armor: [],
            items: []
        };
        this.pendingAbilityChoices = []; // Array to store pending ability choices

        // Add Common as a default language
        this.addLanguage('Common', 'Default');
    }

    // Methods for ability scores
    getAbilityScore(ability) {
        // Simple getter without manager dependency
        return this.abilityScores[ability] || 0;
    }

    getAbilityModifier(ability) {
        const score = this.getAbilityScore(ability);
        return Math.floor((score - 10) / 2);
    }

    /**
     * Add an ability score bonus
     * @param {string} ability - The ability to add the bonus to
     * @param {number} value - The bonus value
     * @param {string} source - The source of the bonus
     */
    addAbilityBonus(ability, value, source) {
        console.log(`[Character] Adding ability bonus: ${ability} +${value} from ${source}`);

        // Normalize the ability name
        const normalizedAbility = ability.toLowerCase()
            .replace(/^str$/, 'strength')
            .replace(/^dex$/, 'dexterity')
            .replace(/^con$/, 'constitution')
            .replace(/^int$/, 'intelligence')
            .replace(/^wis$/, 'wisdom')
            .replace(/^cha$/, 'charisma');

        console.log(`[Character] Normalized ability name: ${normalizedAbility}`);

        if (!this.abilityBonuses[normalizedAbility]) {
            this.abilityBonuses[normalizedAbility] = [];
        }

        // Check if a bonus from this source already exists
        const existingBonus = this.abilityBonuses[normalizedAbility].find(bonus => bonus.source === source);
        if (existingBonus) {
            // Update existing bonus
            console.log(`[Character] Updating existing bonus for ${normalizedAbility} from ${source}: ${existingBonus.value} -> ${value}`);
            existingBonus.value = value;
        } else {
            // Add new bonus
            console.log(`[Character] Adding new bonus for ${normalizedAbility} from ${source}: +${value}`);
            this.abilityBonuses[normalizedAbility].push({ value, source });
        }

        console.log(`[Character] Current ability bonuses for ${normalizedAbility}:`, this.abilityBonuses[normalizedAbility]);
    }

    clearAbilityBonuses(source) {
        for (const ability in this.abilityBonuses) {
            this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
                bonus => bonus.source !== source
            );
        }
    }

    // Methods for pending choices
    addPendingChoice(type, choice) {
        console.log("[Character] Adding pending choice:", { type, choice });
        if (!this.pendingChoices.has(type)) {
            this.pendingChoices.set(type, []);
        }
        this.pendingChoices.get(type).push(choice);

        // Also add to ability choices if it's an ability choice
        if (type === 'ability') {
            this.pendingAbilityChoices.push(choice);
        }
    }

    getSimplePendingAbilityChoices() {
        return this.pendingAbilityChoices;
    }

    clearPendingAbilityChoices() {
        console.log('[Character] Clearing pending ability choices');
        this.pendingAbilityChoices = [];
    }

    // Rename the duplicate methods to be more specific
    getPendingChoicesByType(type) {
        return this.pendingChoices.get(type) || [];
    }

    clearPendingChoicesByType(type) {
        if (type) {
            this.pendingChoices.delete(type);
        } else {
            this.pendingChoices.clear();
        }
    }

    // Methods for proficiencies
    addProficiency(type, proficiency, source) {
        // Special debug for skills from background
        if (type === 'skills' && source === 'Background') {
            console.log(`[Character] ADDING BACKGROUND SKILL: ${proficiency}`);

            // Check if this skill is already selected as an optional skill
            const raceSelected = this.optionalProficiencies?.skills?.race?.selected || [];
            const classSelected = this.optionalProficiencies?.skills?.class?.selected || [];
            const backgroundSelected = this.optionalProficiencies?.skills?.background?.selected || [];

            // Log any potential conflicts (case insensitive)
            const normalizedSkill = proficiency.toLowerCase().trim();
            const conflicts = [];

            for (const s of raceSelected) {
                if (s.toLowerCase().trim() === normalizedSkill) {
                    conflicts.push({ source: 'race', skill: s });
                }
            }

            for (const s of classSelected) {
                if (s.toLowerCase().trim() === normalizedSkill) {
                    conflicts.push({ source: 'class', skill: s });
                }
            }

            for (const s of backgroundSelected) {
                if (s.toLowerCase().trim() === normalizedSkill) {
                    conflicts.push({ source: 'background', skill: s });
                }
            }

            if (conflicts.length > 0) {
                console.log(`[Character] CONFLICT DETECTED: ${proficiency} conflicts with: `, conflicts);
            }
        }

        console.log(`[Character] Adding proficiency: ${type} - ${proficiency} from ${source}`);

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

        // Debug log proficiency sources for weapons and armor
        if (type === 'weapons' || type === 'armor') {
            console.log(`[Character] Current ${type} proficiency sources:`,
                Array.from(this.proficiencySources[type].entries()).map(([prof, sources]) =>
                    `${prof}: [${Array.from(sources).join(', ')}]`
                ).join(', ')
            );
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

        console.log(`[Character] Checking if ${skill} needs to be refunded (normalized: ${normalizedSkill})`);

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
                console.log(`[Character] Auto-refunding ${matchingSkill} from ${src} (now granted by ${source})`);

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

    // Methods for languages
    addLanguage(language, source) {
        this.addProficiency('languages', language, source);
    }

    removeLanguagesBySource(source) {
        this.removeProficienciesBySource(source);
    }

    // Methods for resistances
    addResistance(resistance, source) {
        this.features.resistances.add(resistance);
    }

    clearResistances(source) {
        this.features.resistances.clear();
    }

    // Methods for traits
    addTrait(name, description, source) {
        this.features.traits.set(name, { description, source });
    }

    clearTraits(source) {
        for (const [name, trait] of this.features.traits.entries()) {
            if (trait.source === source) {
                this.features.traits.delete(name);
            }
        }
    }

    // Methods for source management
    addAllowedSource(source) {
        console.log('[Character] Adding allowed source:', source);
        if (source) {
            this.allowedSources.add(source.toUpperCase());
            console.log('[Character] Current allowed sources:', Array.from(this.allowedSources));
        }
    }

    removeAllowedSource(source) {
        console.log('[Character] Removing allowed source:', source);
        if (source) {
            this.allowedSources.delete(source.toUpperCase());
            console.log('[Character] Current allowed sources:', Array.from(this.allowedSources));
        }
    }

    isSourceAllowed(source) {
        const isAllowed = source ? this.allowedSources.has(source.toUpperCase()) : false;
        console.log('[Character] Checking if source is allowed:', source, isAllowed);
        return isAllowed;
    }

    setAllowedSources(sources) {
        console.log('[Character] Setting allowed sources:', Array.from(sources));
        this.allowedSources = new Set(sources);
        console.log('[Character] Allowed sources after setting:', Array.from(this.allowedSources));
    }

    getAllowedSources() {
        console.log('[Character] Getting allowed sources:', Array.from(this.allowedSources));
        return new Set(this.allowedSources);
    }

    // Static method to create a Character instance from JSON data
    static fromJSON(data) {
        console.log('[Character] Creating from JSON, allowedSources:', data.allowedSources);
        const character = new Character();

        // Copy basic properties
        character.id = data.id;
        character.name = data.name;
        character.playerName = data.playerName;
        character.level = data.level;
        character.lastModified = data.lastModified;
        character.height = data.height;
        character.weight = data.weight;
        character.gender = data.gender;
        character.backstory = data.backstory;

        // Set allowed sources from data
        if (data.allowedSources) {
            // Handle both Set and Array formats
            const sources = Array.isArray(data.allowedSources)
                ? data.allowedSources
                : Array.from(data.allowedSources);

            // Ensure all sources are uppercase
            character.allowedSources = new Set(sources.map(source => source.toUpperCase()));
            console.log('[Character] Set allowed sources from data:', Array.from(character.allowedSources));
        } else {
            character.allowedSources = new Set(['PHB']);
            console.log('[Character] Using default PHB source:', Array.from(character.allowedSources));
        }

        // Copy ability scores and bonuses
        if (data.abilityScores) {
            character.abilityScores = { ...data.abilityScores };
        }
        if (data.abilityBonuses) {
            character.abilityBonuses = { ...data.abilityBonuses };
        }

        // Copy size and speed
        character.size = data.size || 'M';
        character.speed = { ...data.speed } || { walk: 30 };

        // Copy features
        character.features = {
            darkvision: data.features?.darkvision || 0,
            resistances: new Set(Array.isArray(data.features?.resistances) ? data.features.resistances : []),
            traits: new Map(Object.entries(data.features?.traits || {}))
        };

        // Copy proficiencies
        character.proficiencies = {
            armor: Array.isArray(data.proficiencies?.armor) ? [...data.proficiencies.armor] : [],
            weapons: Array.isArray(data.proficiencies?.weapons) ? [...data.proficiencies.weapons] : [],
            tools: Array.isArray(data.proficiencies?.tools) ? [...data.proficiencies.tools] : [],
            skills: Array.isArray(data.proficiencies?.skills) ? [...data.proficiencies.skills] : [],
            languages: Array.isArray(data.proficiencies?.languages) ? [...data.proficiencies.languages] : ['Common'],
            savingThrows: Array.isArray(data.proficiencies?.savingThrows) ? [...data.proficiencies.savingThrows] : []
        };

        // Copy race information
        character.race = {
            name: data.race?.name || '',
            source: data.race?.source || '',
            subrace: data.race?.subrace || ''
        };

        // Copy class information
        character.class = data.class || { level: 1 };
        character.subclass = data.subclass || '';
        character.background = data.background || '';

        return character;
    }

    /**
     * Convert the character to a JSON object for saving
     * @returns {Object} JSON representation of the character
     */
    toJSON() {
        console.log('[Character] Converting to JSON, allowedSources:', Array.from(this.allowedSources));
        return {
            id: this.id,
            name: this.name,
            allowedSources: Array.from(this.allowedSources),
            playerName: this.playerName,
            level: this.level,
            lastModified: new Date().toISOString(),
            height: this.height,
            weight: this.weight,
            gender: this.gender,
            backstory: this.backstory,

            // Ability scores and bonuses
            abilityScores: { ...this.abilityScores },
            abilityBonuses: { ...this.abilityBonuses },

            // Race, class, background
            race: { ...this.race },
            class: { ...this.class },
            subclass: this.subclass,
            background: this.background,

            // Size and speed
            size: this.size,
            speed: { ...this.speed },

            // Features and proficiencies
            features: {
                darkvision: this.features.darkvision,
                resistances: Array.from(this.features.resistances),
                traits: Object.fromEntries(this.features.traits)
            },
            proficiencies: {
                armor: [...this.proficiencies.armor],
                weapons: [...this.proficiencies.weapons],
                tools: [...this.proficiencies.tools],
                skills: [...this.proficiencies.skills],
                languages: [...this.proficiencies.languages],
                savingThrows: [...this.proficiencies.savingThrows]
            },

            // Variant rules
            variantRules: { ...this.variantRules }
        };
    }

    /**
     * Add a pending ability choice
     * @param {Object} choice - The ability choice object
     */
    addPendingAbilityChoice(choice) {
        console.log('[Character] Adding pending ability choice:', choice);
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