import { Class } from '../models/Class.js';
import { Subclass } from '../models/Subclass.js';
import { Feature } from '../models/Feature.js';

export class ClassService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.classCache = new Map();
        this.subclassCache = new Map();
        this.featureCache = new Map();
    }

    async loadClass(classId) {
        // Check cache first
        if (this.classCache.has(classId)) {
            return this.classCache.get(classId);
        }

        // Load class data
        const classes = await this.dataLoader.loadClasses();
        const classData = classes.find(c => c.id === classId);

        if (!classData) {
            throw new Error(`Class not found: ${classId}`);
        }

        // Create class instance
        const characterClass = new Class(classData);
        this.classCache.set(classId, characterClass);
        return characterClass;
    }

    async loadSubclass(subclassId, parentClassId) {
        // Check cache first
        const cacheKey = `${parentClassId}:${subclassId}`;
        if (this.subclassCache.has(cacheKey)) {
            return this.subclassCache.get(cacheKey);
        }

        // Load parent class first
        const parentClass = await this.loadClass(parentClassId);
        const subclassData = parentClass.subclasses.find(s => s.id === subclassId);

        if (!subclassData) {
            throw new Error(`Subclass not found: ${subclassId}`);
        }

        // Create subclass instance
        const subclass = new Subclass(subclassData, parentClass);
        this.subclassCache.set(cacheKey, subclass);
        return subclass;
    }

    async getAvailableClasses() {
        const classes = await this.dataLoader.loadClasses();
        return classes.map(classData => new Class(classData));
    }

    async getAvailableSubclasses(classId) {
        const characterClass = await this.loadClass(classId);
        return characterClass.subclasses.map(subclassData =>
            new Subclass(subclassData, characterClass)
        );
    }

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
            throw new Error(`Feature not found: ${featureId}`);
        }

        const featureInstance = new Feature(feature);
        this.featureCache.set(cacheKey, featureInstance);
        return featureInstance;
    }

    async getFeaturesForLevel(classId, level, subclassId = null) {
        if (subclassId) {
            const subclass = await this.loadSubclass(subclassId, classId);
            return subclass.getFeatures(level).map(f => new Feature(f));
        }

        const characterClass = await this.loadClass(classId);
        return characterClass.getFeatures(level).map(f => new Feature(f));
    }

    clearCache() {
        this.classCache.clear();
        this.subclassCache.clear();
        this.featureCache.clear();
    }

    // Spellcasting validation
    async validateSpellcasting(classId, subclassId = null) {
        const characterClass = subclassId ?
            await this.loadSubclass(subclassId, classId) :
            await this.loadClass(classId);

        return characterClass.canCastSpells();
    }

    // Multiclassing validation
    async validateMulticlassing(classId, character) {
        const characterClass = await this.loadClass(classId);
        const requirements = characterClass.getMulticlassingRequirements();

        for (const [ability, score] of Object.entries(requirements)) {
            if (character.getAbilityScore(ability) < score) {
                return false;
            }
        }

        return true;
    }
} 