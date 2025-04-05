/**
 * Initialize.js
 * Core initialization utilities
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
import { navigation } from './navigation.js';
import { tooltipManager } from '../managers/TooltipManager.js';
import { characterHandler } from './characterHandler.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { textProcessor } from './TextProcessor.js';

/**
 * Wrapper for data loader calls that handles errors consistently
 * @param {Promise<any>} promise - The data loader promise to execute
 * @param {string} component - The name of the component being loaded (for error reporting)
 * @returns {Promise<any|null>} The loaded data or null if loading failed
 * @private
 */
async function loadDataWithErrorHandling(promise, component) {
    try {
        return await promise;
    } catch (error) {
        console.warn(`Failed to load ${component}:`, error);
        return null;
    }
}

/**
 * Initializes all core components of the application in the correct order
 * @param {InitializationOptions} [options] - Initialization options (currently reserved for future use)
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
        // Initialize data loaders and reference resolver
        try {
            const dataLoadPromises = [
                loadDataWithErrorHandling(dataLoader.loadSpells(), 'spells'),
                loadDataWithErrorHandling(dataLoader.loadSources(), 'sources'),
                loadDataWithErrorHandling(dataLoader.loadFeatures(), 'features'),
                loadDataWithErrorHandling(dataLoader.loadDeities(), 'deities'),
                loadDataWithErrorHandling(dataLoader.loadClasses(), 'classes'),
                loadDataWithErrorHandling(dataLoader.loadBackgrounds(), 'backgrounds'),
                loadDataWithErrorHandling(dataLoader.loadItems(), 'items'),
                loadDataWithErrorHandling(dataLoader.loadRaces(), 'races'),
                loadDataWithErrorHandling(dataLoader.loadConditions(), 'conditions'),
                loadDataWithErrorHandling(dataLoader.loadActions(), 'actions'),
                loadDataWithErrorHandling(dataLoader.loadVariantRules(), 'variant rules')
            ];

            await Promise.all(dataLoadPromises);
        } catch (error) {
            console.error('Error initializing data loaders:', error);
            result.errors.push(error);
        }

        // Initialize core components
        const components = [
            { name: 'tooltip manager', init: () => tooltipManager.initialize() },
            { name: 'text processor', init: () => textProcessor.initialize() },
            { name: 'character handler', init: () => characterHandler.initialize() },
            { name: 'navigation', init: () => navigation.initialize() }
        ];

        for (const component of components) {
            try {
                await component.init();
                result.loadedComponents.push(component.name);
            } catch (error) {
                console.error(`Error initializing ${component.name}:`, error);
                result.errors.push(error);
            }
        }

        // Set overall success based on whether any critical errors occurred
        result.success = result.errors.length === 0;

        if (result.success) {
            // console.log('Application initialized successfully');
        } else {
            console.warn('Application initialized with some errors:', result.errors);
        }

        return result;
    } catch (error) {
        console.error('Failed to initialize application:', error);
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