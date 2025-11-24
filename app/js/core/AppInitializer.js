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

// Core imports - NEW ARCHITECTURE
import { Logger } from '../infrastructure/Logger.js';
import { AppState } from '../application/AppState.js';
import { NavigationController } from '../presentation/NavigationController.js';
import { CharacterManager } from '../application/CharacterManager.js';

// Service imports
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
        Logger.info('AppInitializer', 'Initializing core components with NEW architecture');

        // Define components and their initialization sequence
        const components = [
            { name: 'text processor', init: () => textProcessor.initialize() },
            { name: 'navigation controller', init: () => NavigationController.initialize() },
            { name: 'settings service', init: () => settingsService.initialize() }
        ];

        // Initialize each component in sequence
        for (const component of components) {
            const initResult = await _initializeComponent(component.name, component.init);

            if (initResult.success) {
                result.loadedComponents.push(component.name);
                Logger.info('AppInitializer', `✓ ${component.name} initialized`);
            } else {
                result.errors.push(initResult.error);
                Logger.error('AppInitializer', `✗ ${component.name} failed`, initResult.error);
            }
        }

        // Set overall success based on whether any critical errors occurred
        result.success = result.errors.length === 0;

        Logger.info('AppInitializer', 'Core components initialized', {
            success: result.success,
            loaded: result.loadedComponents.length,
            errors: result.errors.length
        });

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
}//-------------------------------------------------------------------------
// Console Forwarding Setup
//-------------------------------------------------------------------------

// Set up console forwarding FIRST
const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
};

// Helper to extract stack trace information
function getStackInfo() {
    try {
        const stack = new Error().stack;
        if (!stack) return null;

        const lines = stack.split('\n');
        // Find the first line that's not part of this forwarding code
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip lines containing 'getStackInfo', 'console', or 'AppInitializer'
            if (line.includes('getStackInfo') ||
                line.includes('at console.') ||
                line.includes('AppInitializer.js')) {
                continue;
            }

            // Extract file:line:column from stack trace
            const match = line.match(/\((.*):(\d+):(\d+)\)|at (.*):(\d+):(\d+)/);
            if (match) {
                const file = match[1] || match[4];
                const lineNum = match[2] || match[5];
                const column = match[3] || match[6];

                if (file) {
                    // Get just the filename, not full path
                    const filename = file.split('/').pop().split('\\').pop();
                    return `${filename}:${lineNum}:${column}`;
                }
            }
        }

        return null;
    } catch (err) {
        return null;
    }
}

['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
    console[method] = function (...args) {
        originalConsole[method](...args);

        // Get stack trace info
        const location = getStackInfo();

        try {
            window.electron.ipc.send('renderer-console', {
                level: method,
                timestamp: new Date().toISOString(),
                location: location,
                args: args.map(arg => {
                    try {
                        if (arg instanceof Error) {
                            return {
                                type: 'Error',
                                name: arg.name,
                                message: arg.message,
                                stack: arg.stack
                            };
                        }
                        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch {
                        return String(arg);
                    }
                })
            });
        } catch (err) {
            originalConsole.error('Console forward failed:', err);
        }
    };
});


// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeAll().catch(error => {
        console.error('Error during initialization:', error);
    });
});

export class AppInitializer {
    // ...
}
