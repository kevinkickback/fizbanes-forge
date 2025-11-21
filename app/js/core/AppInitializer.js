/**
 * AppInitializer.js
 * Core initialization utilities for application bootstrap process.
 * Manages the initialization sequence of all critical application components.
 * 
 * @typedef {Object} InitializationOptions
 * @property {boolean} [loadAllData=true] - Whether to load all data sources
 * @property {boolean} [skipCharacterLoad=false] - Whether to skip loading characters
 * @property {boolean} [forceRefresh=false] - Whether to force refresh cached data
 * 
 * @typedef {Object} InitializationResult
 * @property {boolean} success - Whether initialization was successful
 * @property {Array<string>} loadedComponents - List of successfully loaded components
 * @property {Array<Error>} errors - List of errors encountered during initialization
 * 
 * @typedef {Object} DataLoadResult
 * @property {any} data - The loaded data or null if loading failed
 * @property {Error|null} error - The error that occurred during loading, if any
 */

// Core imports
import { navigation } from './Navigation.js';
import { characterLifecycle } from './CharacterLifecycle.js';
import { textProcessor } from '../utils/TextProcessor.js';
import { settingsService } from '../services/SettingsService.js';
import { spellService } from '../services/SpellService.js';
import { itemService } from '../services/ItemService.js';
import { classService } from '../services/ClassService.js';
import { raceService } from '../services/RaceService.js';
import { backgroundService } from '../services/BackgroundService.js';

/**
 * Wrapper for data loader calls that handles errors consistently
 * @param {Promise<any>} promise - The data loader promise to execute
 * @param {string} component - The name of the component being loaded (for error reporting)
 * @returns {Promise<any|null>} The loaded data or null if loading failed
 * @private
 */
async function _loadDataWithErrorHandling(promise, component) {
    try {
        const result = await promise;
        return result;
    } catch (error) {
        console.warn(`Failed to load ${component} data:`, error);
        return null;
    }
}

/**
 * Loads all required game data in parallel
 * @returns {Promise<{success: boolean, errors: Array<Error>}>} Result of data loading operations
 * @private
 */
async function _loadAllGameData() {
    const errors = [];
    try {
        // Initialize all services in parallel
        const dataLoadPromises = [
            _loadDataWithErrorHandling(spellService.initialize(), 'spells'),
            _loadDataWithErrorHandling(itemService.initialize(), 'items'),
            _loadDataWithErrorHandling(classService.initialize(), 'classes'),
            _loadDataWithErrorHandling(raceService.initialize(), 'races'),
            _loadDataWithErrorHandling(backgroundService.initialize(), 'backgrounds')
        ];

        await Promise.all(dataLoadPromises);
        return { success: true, errors };
    } catch (error) {
        console.error('Error during game data loading:', error);
        errors.push(error);
        return { success: false, errors };
    }
}

/**
 * Initializes a single core component with error handling
 * @param {string} name - The name of the component
 * @param {Function} initFunction - The initialization function to call
 * @returns {Promise<{success: boolean, error: Error|null}>} Result of the initialization
 * @private
 */
async function _initializeComponent(name, initFunction) {
    try {
        await initFunction();
        return { success: true, error: null };
    } catch (error) {
        console.error(`Error initializing ${name}:`, error);
        return { success: false, error };
    }
}

/**
 * Initializes all core application components in the correct sequence
 * @returns {Promise<{success: boolean, loadedComponents: Array<string>, errors: Array<Error>}>} Result of component initialization
 * @private
 */
async function _initializeCoreComponents() {
    const result = {
        success: true,
        loadedComponents: [],
        errors: []
    };

    try {
        // Define components and their initialization sequence
        const components = [
            { name: 'text processor', init: () => textProcessor.initialize() },
            { name: 'character lifecycle', init: () => characterLifecycle.initialize() },
            { name: 'settings service', init: () => settingsService.initialize() },
            { name: 'navigation', init: () => navigation.initialize() }
        ];

        // Initialize each component in sequence
        for (const component of components) {
            const initResult = await _initializeComponent(component.name, component.init);

            if (initResult.success) {
                result.loadedComponents.push(component.name);
            } else {
                result.errors.push(initResult.error);
            }
        }

        // Set overall success based on whether any critical errors occurred
        result.success = result.errors.length === 0;
        return result;
    } catch (error) {
        console.error('Unexpected error during core component initialization:', error);
        result.success = false;
        result.errors.push(error);
        return result;
    }
}

//-------------------------------------------------------------------------
// Public API
//-------------------------------------------------------------------------

/**
 * Initializes all core components of the application in the correct order
 * @param {InitializationOptions} [options={}] - Initialization options
 * @returns {Promise<InitializationResult>} The result of initialization
 * @throws {Error} If initialization fails catastrophically
 */
export async function initializeAll(options = {}) {

    const result = {
        success: true,
        loadedComponents: [],
        errors: []
    };

    try {
        // Step 1: Load all game data
        const dataLoadResult = await _loadAllGameData();
        if (!dataLoadResult.success) {
            result.errors.push(...dataLoadResult.errors);
        }

        // Step 2: Initialize core components
        const componentsResult = await _initializeCoreComponents();
        result.loadedComponents = componentsResult.loadedComponents;
        result.errors.push(...componentsResult.errors);

        // Set overall success based on whether any critical errors occurred
        result.success = result.errors.length === 0;

        if (!result.success) {
            console.warn('Application initialized with errors:', result.errors);
        }

        return result;
    } catch (error) {
        console.error('Fatal error during application initialization:', error);
        result.success = false;
        result.errors.push(error);
        throw error;
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeAll().catch(error => {
        console.error('Error during initialization:', error);
    });
});
