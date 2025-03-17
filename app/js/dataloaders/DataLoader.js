/**
 * DataLoader.js
 * Central data loading service that manages all individual data loaders
 * 
 * @typedef {Object} DataLoaderInstance
 * @property {SpellLoader} spellLoader - Loader for spell data
 * @property {SourceLoader} sourceLoader - Loader for source book data
 * @property {FeatureLoader} featureLoader - Loader for feature data
 * @property {DeityLoader} deityLoader - Loader for deity data
 * @property {ClassLoader} classLoader - Loader for class data
 * @property {BackgroundLoader} backgroundLoader - Loader for background data
 * @property {ItemLoader} itemLoader - Loader for item data
 * @property {RaceLoader} raceLoader - Loader for race data
 * @property {ConditionLoader} conditionLoader - Loader for condition data
 * @property {ActionLoader} actionLoader - Loader for action data
 */

import { SpellLoader } from './SpellLoader.js';
import { SourceLoader } from './SourceLoader.js';
import { FeatureLoader } from './FeatureLoader.js';
import { DeityLoader } from './DeityLoader.js';
import { ClassLoader } from './ClassLoader.js';
import { BackgroundLoader } from './BackgroundLoader.js';
import { ItemLoader } from './ItemLoader.js';
import { RaceLoader } from './RaceLoader.js';
import { ConditionLoader } from './ConditionLoader.js';
import { ActionLoader } from './ActionLoader.js';
import { VariantRuleLoader } from './VariantRuleLoader.js';

let instance = null;

export class DataLoader {
    constructor() {
        if (instance) {
            throw new Error('DataLoader is a singleton. Use DataLoader.getInstance() instead.');
        }

        // Initialize all loaders
        this.spellLoader = new SpellLoader();
        this.sourceLoader = new SourceLoader();
        this.featureLoader = new FeatureLoader();
        this.deityLoader = new DeityLoader();
        this.classLoader = new ClassLoader();
        this.backgroundLoader = new BackgroundLoader();
        this.itemLoader = new ItemLoader();
        this.raceLoader = new RaceLoader();
        this.conditionLoader = new ConditionLoader();
        this.actionLoader = new ActionLoader();
        this.variantRuleLoader = new VariantRuleLoader();

        instance = this;
    }

    // Proxy methods to individual loaders
    async loadSpells() {
        return this.spellLoader.loadSpells();
    }

    async loadSources() {
        return this.sourceLoader.loadSources();
    }

    async loadFeatures() {
        return this.featureLoader.loadFeatures();
    }

    async loadDeities() {
        return this.deityLoader.loadDeities();
    }

    async loadClasses() {
        return this.classLoader.loadClasses();
    }

    async loadBackgrounds() {
        return this.backgroundLoader.loadBackgrounds();
    }

    async loadItems() {
        return this.itemLoader.loadItems();
    }

    async loadRaces() {
        return this.raceLoader.loadRaces();
    }

    async loadConditions() {
        return this.conditionLoader.loadConditions();
    }

    async loadActions() {
        return this.actionLoader.loadActions();
    }

    async loadVariantRules() {
        return this.variantRuleLoader.loadVariantRules();
    }

    static getInstance() {
        if (!instance) {
            instance = new DataLoader();
        }
        return instance;
    }
}

export const dataLoader = DataLoader.getInstance(); 