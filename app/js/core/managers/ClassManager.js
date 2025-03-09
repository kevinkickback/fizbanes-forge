// Class Manager for handling character class-related operations
import { Class } from '../models/Class.js';
import { Subclass } from '../models/Subclass.js';
import { Feature } from '../models/Feature.js';

export class ClassManager {
    constructor(character) {
        this.character = character;
        this.classCache = new Map();
        this.subclassCache = new Map();
        this.featureCache = new Map();
    }

    // Initialize class data and setup
    async initialize() {
        try {
            await this.loadClasses();
            return true;
        } catch (error) {
            console.error('Failed to initialize ClassManager:', error);
            return false;
        }
    }

    // Load and cache class data
    async loadClasses() {
        try {
            const classData = await window.dndDataLoader.loadClasses();
            for (const data of classData) {
                const classInstance = new Class(data);
                this.classCache.set(data.id, classInstance);
            }
            return Array.from(this.classCache.values());
        } catch (error) {
            console.error('Error loading class data:', error);
            throw error;
        }
    }

    // Load a specific class by ID
    async loadClass(classId) {
        // Check cache first
        if (this.classCache.has(classId)) {
            return this.classCache.get(classId);
        }

        // Load class data
        const classes = await window.dndDataLoader.loadClasses();
        const classData = classes.find(c => c.id === classId);

        if (!classData) {
            throw new Error(`Class ${classId} not found`);
        }

        // Create class instance
        const characterClass = new Class(classData);
        this.classCache.set(classId, characterClass);
        return characterClass;
    }

    // Load a specific subclass by ID
    async loadSubclass(subclassId, parentClassId) {
        // Check cache first
        const cacheKey = `${parentClassId}:${subclassId}`;
        if (this.subclassCache.has(cacheKey)) {
            return this.subclassCache.get(cacheKey);
        }

        // Load parent class first
        const parentClass = await this.loadClass(parentClassId);
        const subclassData = parentClass.subclasses?.find(s => s.id === subclassId);

        if (!subclassData) {
            throw new Error(`Subclass ${subclassId} not found`);
        }

        // Create subclass instance
        const subclass = new Subclass(subclassData, parentClass);
        this.subclassCache.set(cacheKey, subclass);
        return subclass;
    }

    // Get available subclasses for a class
    async getAvailableSubclasses(classId) {
        const characterClass = await this.loadClass(classId);
        return characterClass.subclasses.map(subclassData =>
            new Subclass(subclassData, characterClass)
        );
    }

    // Get a specific feature
    async getFeature(featureId, classId, subclassId = null) {
        const cacheKey = `${classId}:${subclassId || ''}:${featureId}`;
        if (this.featureCache.has(cacheKey)) {
            return this.featureCache.get(cacheKey);
        }

        let feature;
        if (subclassId) {
            const subclass = await this.loadSubclass(subclassId, classId);
            feature = subclass.getFeatureByName(featureId);
        } else {
            const characterClass = await this.loadClass(classId);
            feature = characterClass.getFeatureByName(featureId);
        }

        if (!feature) {
            throw new Error(`Feature ${featureId} not found`);
        }

        const featureInstance = new Feature(feature);
        this.featureCache.set(cacheKey, featureInstance);
        return featureInstance;
    }

    // Get features for a specific level
    async getFeaturesForLevel(classId, level, subclassId = null) {
        if (subclassId) {
            const subclass = await this.loadSubclass(subclassId, classId);
            return subclass.getFeatures(level).map(f => new Feature(f));
        }

        const characterClass = await this.loadClass(classId);
        return characterClass.getFeatures(level).map(f => new Feature(f));
    }

    // Set or update character's class
    async setClass(classId, level = 1, subclassId = null) {
        try {
            const classData = await this.loadClass(classId);
            if (!classData) {
                throw new Error(`Class ${classId} not found`);
            }

            // Clear existing class features at this level
            this.clearClassFeatures(level);

            // Get subclass data if applicable
            let subclassData = null;
            if (subclassId && level >= 3) {
                subclassData = await this.loadSubclass(subclassId, classId);
            }

            // Apply class features
            await this.applyClassFeatures(classData, level, subclassData);

            // Update character's class information
            this.updateCharacterClass(classData, level, subclassData);

            return true;
        } catch (error) {
            console.error('Error setting class:', error);
            return false;
        }
    }

    // Clear class features for a specific level
    clearClassFeatures(level) {
        if (!this.character.features) {
            this.character.features = [];
        }
        this.character.features = this.character.features.filter(f => f.level !== level);
    }

    // Apply class and subclass features
    async applyClassFeatures(classData, level, subclassData = null) {
        // Apply class features for this level
        const levelFeatures = classData.features.find(f => f.level === level);
        if (levelFeatures) {
            for (const feature of levelFeatures.features) {
                await this.addFeature(feature.name, feature.description, level, false);
            }
        }

        // Apply subclass features if applicable
        if (subclassData) {
            const subclassFeatures = subclassData.features.find(f => f.level === level);
            if (subclassFeatures) {
                for (const feature of subclassFeatures.features) {
                    await this.addFeature(feature.name, feature.description, level, true);
                }
            }
        }
    }

    // Add a feature to the character
    async addFeature(name, description, level, isSubclassFeature = false) {
        if (!this.character.features) {
            this.character.features = [];
        }

        this.character.features.push({
            name,
            description: await window.textProcessor.process(description),
            level,
            source: isSubclassFeature ? 'Subclass' : 'Class'
        });
    }

    // Update character's class information
    updateCharacterClass(classData, level, subclassData = null) {
        // Update basic class info
        this.character.class = {
            name: classData.name,
            level: level,
            hitDice: classData.hitDice,
            subclass: subclassData ? {
                name: subclassData.name,
                features: subclassData.features
            } : null
        };

        // Update proficiencies if this is the first level
        if (level === 1) {
            this.applyClassProficiencies(classData.proficiencies);
        } else if (level === 1 && classData.multiclassing) {
            this.applyMulticlassProficiencies(classData.multiclassing.proficiencies);
        }

        // Update spellcasting if applicable
        if (classData.spellcasting) {
            this.updateSpellcasting(classData.spellcasting, level);
        }
    }

    // Apply class proficiencies
    applyClassProficiencies(proficiencies) {
        // Add armor proficiencies
        for (const armor of proficiencies.armor) {
            this.character.addProficiency('armor', armor, 'Class');
        }

        // Add weapon proficiencies
        for (const weapon of proficiencies.weapons) {
            this.character.addProficiency('weapon', weapon, 'Class');
        }

        // Add tool proficiencies
        for (const tool of proficiencies.tools) {
            this.character.addProficiency('tool', tool, 'Class');
        }

        // Add saving throw proficiencies
        for (const save of proficiencies.savingThrows) {
            this.character.addSavingThrowProficiency(save);
        }

        // Store skill choices
        if (proficiencies.skills.choices > 0) {
            this.character.pendingSkillChoices = {
                count: proficiencies.skills.choices,
                from: proficiencies.skills.from
            };
        }
    }

    // Apply multiclass proficiencies
    applyMulticlassProficiencies(proficiencies) {
        for (const type in proficiencies) {
            for (const prof of proficiencies[type]) {
                this.character.addProficiency(type, prof, 'Multiclass');
            }
        }
    }

    // Update spellcasting information
    updateSpellcasting(spellcasting, level) {
        if (!this.character.spellcasting) {
            this.character.spellcasting = {};
        }

        // Set spellcasting ability if not already set
        if (!this.character.spellcasting.ability) {
            this.character.spellcasting.ability = spellcasting.ability;
        }

        // Update cantrips known
        this.character.spellcasting.cantripsKnown = spellcasting.cantripProgression[level - 1];

        // Update spells known if applicable
        if (spellcasting.spellsKnownProgression) {
            this.character.spellcasting.spellsKnown = spellcasting.spellsKnownProgression[level - 1];
        }

        // Update spell slots based on progression type
        if (window.SpellcastingService) {
            window.SpellcastingService.updateSpellSlots(spellcasting.progression, level);
        }
    }

    // Clear all caches
    clearCache() {
        this.classCache.clear();
        this.subclassCache.clear();
        this.featureCache.clear();
    }

    // Validate spellcasting capability
    async validateSpellcasting(classId, subclassId = null) {
        const characterClass = subclassId ?
            await this.loadSubclass(subclassId, classId) :
            await this.loadClass(classId);

        return characterClass.canCastSpells();
    }

    // Validate multiclassing requirements
    async validateMulticlassing(classId) {
        const characterClass = await this.loadClass(classId);
        const requirements = characterClass.getMulticlassingRequirements();

        for (const [ability, score] of Object.entries(requirements)) {
            if (this.character.getAbilityScore(ability) < score) {
                return false;
            }
        }

        return true;
    }
}

// Make ClassManager available globally
window.ClassManager = ClassManager; 