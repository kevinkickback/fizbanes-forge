/**
 * Initialize.js
 * Core initialization utilities for the D&D Character Creator application
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
 */

// Core imports
import { navigation } from './navigation.js';
import { tooltipManager } from '../managers/TooltipManager.js';
import { characterHandler } from './characterHandler.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { textProcessor } from './TextProcessor.js';

/**
 * Initializes all core components of the application in the correct order
 * @param {InitializationOptions} [options] - Initialization options
 * @returns {Promise<InitializationResult>} The result of initialization
 * @throws {Error} If initialization fails
 */
export async function initializeAll(options = {}) {
    try {
        // Initialize data loaders and reference resolver
        try {
            await Promise.all([
                dataLoader.loadSpells().catch(error => {
                    console.warn('Failed to load spells:', error);
                    return null;
                }),
                dataLoader.loadSources().catch(error => {
                    console.warn('Failed to load sources:', error);
                    return null;
                }),
                dataLoader.loadFeatures().catch(error => {
                    console.warn('Failed to load features:', error);
                    return null;
                }),
                dataLoader.loadDeities().catch(error => {
                    console.warn('Failed to load deities:', error);
                    return null;
                }),
                dataLoader.loadClasses().catch(error => {
                    console.warn('Failed to load classes:', error);
                    return null;
                }),
                dataLoader.loadBackgrounds().catch(error => {
                    console.warn('Failed to load backgrounds:', error);
                    return null;
                }),
                dataLoader.loadItems().catch(error => {
                    console.warn('Failed to load items:', error);
                    return null;
                }),
                dataLoader.loadRaces().catch(error => {
                    console.warn('Failed to load races:', error);
                    return null;
                }),
                dataLoader.loadConditions().catch(error => {
                    console.warn('Failed to load conditions:', error);
                    return null;
                }),
                dataLoader.loadActions().catch(error => {
                    console.warn('Failed to load actions:', error);
                    return null;
                }),
                dataLoader.loadVariantRules().catch(error => {
                    console.warn('Failed to load variant rules:', error);
                    return null;
                })
            ]);
        } catch (error) {
            console.error('Error initializing data loaders:', error);
            throw error;
        }

        // Initialize tooltip manager
        try {
            await tooltipManager.initialize();
        } catch (error) {
            console.error('Error initializing tooltip manager:', error);
            throw error;
        }

        // Initialize text processor
        try {
            await textProcessor.initialize();
        } catch (error) {
            console.error('Error initializing text processor:', error);
            throw error;
        }

        // Initialize character handler
        try {
            await characterHandler.initialize();
        } catch (error) {
            console.error('Error initializing character handler:', error);
            throw error;
        }

        // Initialize navigation
        try {
            await navigation.initialize();
        } catch (error) {
            console.error('Error initializing navigation:', error);
            throw error;
        }

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        throw error;
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeAll().catch(error => {
        console.error('Error during initialization:', error);
    });
});