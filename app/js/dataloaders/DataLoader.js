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
 * @property {VariantRuleLoader} variantRuleLoader - Loader for variant rule data
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

/**
 * Singleton instance for DataLoader
 * @type {DataLoader|null}
 * @private
 */
let _instance = null;

/**
 * Main class that manages and orchestrates all data loaders
 */
export class DataLoader {
    /**
     * Initializes a new DataLoader instance with all individual loaders
     * @private
     */
    constructor() {
        if (_instance) {
            throw new Error('DataLoader is a singleton. Use DataLoader.getInstance() instead.');
        }

        this._initializeLoaders();

        _instance = this;
    }

    /**
     * Initializes all individual data loaders
     * @private
     */
    _initializeLoaders() {
        try {
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

        } catch (error) {
            console.error('Failed to initialize data loaders:', error);
        }
    }

    /**
     * Loads class data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined class data
     */
    async loadClasses() {
        try {
            return await this.classLoader.loadClasses();
        } catch (error) {
            console.error('Error loading class data:', error);
            return {};
        }
    }

    /**
     * Loads race data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined race data
     */
    async loadRaces() {
        try {
            return await this.raceLoader.loadRaces();
        } catch (error) {
            console.error('Error loading race data:', error);
            return {};
        }
    }

    /**
     * Loads background data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined background data
     */
    async loadBackgrounds() {
        try {
            return await this.backgroundLoader.loadBackgrounds();
        } catch (error) {
            console.error('Error loading background data:', error);
            return {};
        }
    }

    /**
     * Loads deity data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined deity data
     */
    async loadDeities() {
        try {
            return await this.deityLoader.loadDeities();
        } catch (error) {
            console.error('Error loading deity data:', error);
            return {};
        }
    }

    /**
     * Loads feature data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined feature data
     */
    async loadFeatures() {
        try {
            return await this.featureLoader.loadFeatures();
        } catch (error) {
            console.error('Error loading feature data:', error);
            return {};
        }
    }

    //-------------------------------------------------------------------------
    // Equipment Data Loaders
    //-------------------------------------------------------------------------

    /**
     * Loads item data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined item data
     */
    async loadItems() {
        try {
            return await this.itemLoader.loadItems();
        } catch (error) {
            console.error('Error loading item data:', error);
            return {};
        }
    }

    //-------------------------------------------------------------------------
    // Reference Data Loaders
    //-------------------------------------------------------------------------

    /**
     * Loads spell data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined spell data
     */
    async loadSpells() {
        try {
            return await this.spellLoader.loadSpells();
        } catch (error) {
            console.error('Error loading spell data:', error);
            return {};
        }
    }

    /**
     * Loads source book data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined source data
     */
    async loadSources() {
        try {
            return await this.sourceLoader.loadSources();
        } catch (error) {
            console.error('Error loading source data:', error);
            return {};
        }
    }

    /**
     * Loads condition data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined condition data
     */
    async loadConditions() {
        try {
            return await this.conditionLoader.loadConditions();
        } catch (error) {
            console.error('Error loading condition data:', error);
            return {};
        }
    }

    /**
     * Loads action data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined action data
     */
    async loadActions() {
        try {
            return await this.actionLoader.loadActions();
        } catch (error) {
            console.error('Error loading action data:', error);
            return {};
        }
    }

    /**
     * Loads variant rule data from JSON files
     * @returns {Promise<Object>} Promise resolving to combined variant rule data
     */
    async loadVariantRules() {
        try {
            return await this.variantRuleLoader.loadVariantRules();
        } catch (error) {
            console.error('Error loading variant rule data:', error);
            return {};
        }
    }

    /**
     * Gets the singleton instance of DataLoader
     * @returns {DataLoader} The singleton instance
     * @static
     */
    static getInstance() {
        if (!_instance) {
            _instance = new DataLoader();
        }
        return _instance;
    }
}

// Export a singleton instance
export const dataLoader = DataLoader.getInstance(); 