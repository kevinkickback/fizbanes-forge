import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderAbility.js
 * Central source of truth for ability scores, skills, and proficiency-related data
 */
export class DataLoaderAbility extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        // Core data file
        this.dataFiles = {
            skills: 'skills.json'
        };

        // Core ability score definitions
        this.abilityScores = {
            str: {
                name: 'Strength',
                abbreviation: 'STR',
                description: 'Measuring physical power, athletic training, and raw physical force',
                skills: ['Athletics'],
                savingThrows: ['Lifting', 'Breaking', 'Pushing']
            },
            dex: {
                name: 'Dexterity',
                abbreviation: 'DEX',
                description: 'Measuring agility, reflexes, balance, and coordination',
                skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
                savingThrows: ['Dodging', 'Balancing', 'Hiding']
            },
            con: {
                name: 'Constitution',
                abbreviation: 'CON',
                description: 'Measuring health, stamina, vital force, and endurance',
                skills: [],
                savingThrows: ['Enduring', 'Resisting', 'Recovering']
            },
            int: {
                name: 'Intelligence',
                abbreviation: 'INT',
                description: 'Measuring mental acuity, information recall, and analytical skill',
                skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
                savingThrows: ['Recalling', 'Analyzing', 'Deducing']
            },
            wis: {
                name: 'Wisdom',
                abbreviation: 'WIS',
                description: 'Measuring awareness, intuition, insight, and perceptiveness',
                skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
                savingThrows: ['Noticing', 'Intuiting', 'Surviving']
            },
            cha: {
                name: 'Charisma',
                abbreviation: 'CHA',
                description: 'Measuring force of personality, persuasiveness, and leadership',
                skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'],
                savingThrows: ['Influencing', 'Commanding', 'Performing']
            }
        };

        // Proficiency categories
        this.proficiencyTypes = {
            armor: ['light', 'medium', 'heavy', 'shields'],
            weapons: ['simple', 'martial'],
            tools: ['artisan', 'gaming', 'musical', 'thieves', 'vehicles'],
            skills: Object.values(this.abilityScores).flatMap(ability => ability.skills),
            saves: Object.keys(this.abilityScores)
        };
    }

    /**
     * Load skill data with improved caching and error handling
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed skill data
     */
    async loadSkills(options = {}) {
        return this.getOrLoadData('skills', async () => {
            try {
                const skillData = await this.loadJsonFile(this.dataFiles.skills, {
                    ...options,
                    maxRetries: 3
                });

                return this.processSkillData(skillData);
            } catch (error) {
                console.error('Error loading skills:', error);
                throw new Error(`Failed to load skill data: ${error.message}`);
            }
        }, options);
    }

    /**
     * Process skill data into standardized format
     * @private
     */
    processSkillData(skillData) {
        if (!skillData.skill) return [];

        const allowedSources = this.getAllowedSources();
        return skillData.skill
            .filter(skill => allowedSources.has(skill.source))
            .map(skill => ({
                id: `${skill.name.toLowerCase()}_${skill.source.toLowerCase()}`,
                name: skill.name,
                source: skill.source,
                page: skill.page || null,
                ability: skill.ability || this.getAbilityForSkill(skill.name),
                description: this.processDescription(skill.entries),
                variants: skill.variants || [],
                untrained: skill.untrained !== false,
                // New fields from skills.json
                srd: skill.srd || false,
                basicRules: skill.basicRules || false,
                reprintedAs: skill.reprintedAs || [],
                // Source-specific processing
                isNewEdition: this.isNewEditionSource(skill.source),
                // Get original version if this is a reprint
                originalSource: this.getOriginalSource(skill, skillData.skill)
            }));
    }

    /**
     * Check if a source is from the new edition
     * @private
     */
    isNewEditionSource(source) {
        return source === 'XPHB';
    }

    /**
     * Get the original source version of a skill
     * @private
     */
    getOriginalSource(skill, allSkills) {
        // If this is a PHB skill, it's original
        if (skill.source === 'PHB') return null;

        // If this is a reprint, find the original
        const originalSkill = allSkills.find(s =>
            s.reprintedAs?.some(reprint => {
                const [name, source] = reprint.split('|');
                return name === skill.name && source === skill.source;
            })
        );

        return originalSkill ? {
            name: originalSkill.name,
            source: originalSkill.source,
            page: originalSkill.page
        } : null;
    }

    /**
     * Get all versions of a skill by name
     * @param {string} skillName - Name of the skill
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of skill versions
     */
    async getSkillVersions(skillName, options = {}) {
        const cacheKey = `skill_versions_${skillName.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSkills(options);
            return data.filter(skill =>
                skill.name.toLowerCase() === skillName.toLowerCase()
            );
        }, options);
    }

    /**
     * Get skill by name and source
     * @param {string} skillName - Name of the skill
     * @param {string} source - Source of the skill
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Skill data or null if not found
     */
    async getSkill(skillName, source = 'PHB', options = {}) {
        const cacheKey = `skill_${skillName.toLowerCase()}_${source.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSkills(options);
            return data.find(skill =>
                skill.name.toLowerCase() === skillName.toLowerCase() &&
                skill.source.toLowerCase() === source.toLowerCase()
            ) || null;
        }, options);
    }

    /**
     * Get ability score information
     * @param {string} abilityId - Ability score identifier (e.g., 'str', 'dex')
     * @returns {Object|null} Ability score data or null if not found
     */
    getAbilityScore(abilityId) {
        const ability = this.abilityScores[abilityId.toLowerCase()];
        return ability ? { ...ability } : null;
    }

    /**
     * Get all ability scores
     * @returns {Object} Object containing all ability score data
     */
    getAllAbilityScores() {
        return { ...this.abilityScores };
    }

    /**
     * Get skills for a specific ability
     * @param {string} abilityId - Ability score identifier
     * @returns {string[]} Array of skill names
     */
    getSkillsForAbility(abilityId) {
        const ability = this.getAbilityScore(abilityId);
        return ability ? [...ability.skills] : [];
    }

    /**
     * Get the ability associated with a skill
     * @param {string} skillName - Name of the skill
     * @returns {string|null} Ability abbreviation or null if not found
     */
    getAbilityForSkill(skillName) {
        for (const [id, ability] of Object.entries(this.abilityScores)) {
            if (ability.skills.includes(skillName)) {
                return ability.abbreviation;
            }
        }
        return null;
    }

    /**
     * Get proficiency types for a category
     * @param {string} category - Proficiency category
     * @returns {string[]} Array of proficiency types
     */
    getProficiencyTypes(category) {
        return [...(this.proficiencyTypes[category.toLowerCase()] || [])];
    }

    /**
     * Calculate ability modifier
     * @param {number} score - Ability score
     * @returns {number} Ability modifier
     */
    calculateModifier(score) {
        return Math.floor((score - 10) / 2);
    }

    /**
     * Get proficiency bonus based on level
     * @param {number} level - Character level
     * @returns {number} Proficiency bonus
     */
    getProficiencyBonus(level) {
        return Math.floor((level - 1) / 4) + 2;
    }

    /**
     * Process description entries into a formatted string
     * @private
     */
    processDescription(entries) {
        if (!entries) return '';
        if (typeof entries === 'string') return entries;

        return entries
            .map(entry => {
                if (typeof entry === 'string') return entry;
                if (entry.type === 'list') {
                    return entry.items.map(item => `• ${item}`).join('\n');
                }
                if (entry.entries) {
                    return this.processDescription(entry.entries);
                }
                return '';
            })
            .filter(Boolean)
            .join('\n\n');
    }

    /**
     * Validate ability score bonuses
     * @param {Array|Object} bonuses - Ability score bonuses to validate
     * @returns {boolean} Whether the bonuses are valid
     */
    validateAbilityBonuses(bonuses) {
        if (!bonuses) return false;

        const validateBonus = (bonus) => {
            if (!bonus.ability || !bonus.bonus) return false;
            const abilityKey = bonus.ability.toLowerCase();
            return Object.prototype.hasOwnProperty.call(this.abilityScores, abilityKey) &&
                typeof bonus.bonus === 'number';
        };

        return Array.isArray(bonuses)
            ? bonuses.every(validateBonus)
            : validateBonus(bonuses);
    }

    /**
     * Validate proficiency
     * @param {string} category - Proficiency category
     * @param {string} type - Proficiency type
     * @returns {boolean} Whether the proficiency is valid
     */
    validateProficiency(category, type) {
        const categoryKey = category.toLowerCase();
        const typeKey = type.toLowerCase();

        return Object.prototype.hasOwnProperty.call(this.proficiencyTypes, categoryKey) &&
            this.proficiencyTypes[categoryKey].includes(typeKey);
    }
} 