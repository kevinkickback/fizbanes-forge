// Class Manager for handling character class-related operations
import { Class } from '../models/Class.js';
import { Subclass } from '../models/Subclass.js';
import { Feature } from '../models/Feature.js';
import { characterInitializer } from '../utils/Initialize.js';
import { showNotification } from '../utils/notifications.js';
import { markUnsavedChanges } from '../utils/characterHandler.js';

export class ClassManager {
    constructor(character) {
        this.character = character;
        this.dataLoader = characterInitializer.dataLoader;
        this.textProcessor = characterInitializer.textProcessor;
        this.spellcastingService = characterInitializer.spellcastingService;
        this.classes = new Map();
        this.subclasses = new Map();
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
            const classes = await this.dataLoader.loadClasses();
            for (const classData of classes) {
                this.classes.set(classData.id, classData);
            }
            return Array.from(this.classes.values());
        } catch (error) {
            console.error('Error loading classes:', error);
            showNotification('Error loading classes', 'error');
            return [];
        }
    }

    // Load a specific class by ID
    async loadClass(classId) {
        try {
            const classes = await this.loadClasses();
            return classes.find(c => c.id === classId);
        } catch (error) {
            console.error('Error loading class:', error);
            showNotification('Error loading class', 'error');
            return null;
        }
    }

    // Load a specific subclass by ID
    async loadSubclass(subclassId, parentClassId) {
        // Check cache first
        const cacheKey = `${parentClassId}:${subclassId}`;
        if (this.subclasses.has(cacheKey)) {
            return this.subclasses.get(cacheKey);
        }

        // Load parent class first
        const parentClass = await this.loadClass(parentClassId);
        const subclassData = parentClass.subclasses?.find(s => s.id === subclassId);

        if (!subclassData) {
            throw new Error(`Subclass ${subclassId} not found`);
        }

        // Create subclass instance
        const subclass = new Subclass(subclassData, parentClass);
        this.subclasses.set(cacheKey, subclass);
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
    async setClass(classId) {
        try {
            const classData = await this.loadClass(classId);
            if (!classData) {
                showNotification('Class not found', 'error');
                return false;
            }

            this.character.class = classData;
            markUnsavedChanges();

            // Update spellcasting if applicable
            if (classData.spellcasting) {
                this.spellcastingService.updateSpellSlots(
                    classData.spellcasting.progression,
                    this.character.level
                );
            }

            return true;
        } catch (error) {
            console.error('Error setting class:', error);
            showNotification('Error setting class', 'error');
            return false;
        }
    }

    // Clear all caches
    clearCache() {
        this.classes.clear();
        this.subclasses.clear();
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