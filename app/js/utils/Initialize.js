// Core imports
import { navigation } from './navigation.js';
import { tooltipManager } from '../managers/TooltipManager.js';
import { characterHandler } from './characterHandler.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { textProcessor } from './TextProcessor.js';

/**
 * Initialize the application in the correct order
 */
export async function initializeAll() {
    try {
        // Initialize data loaders and reference resolver
        try {
            const loadingPromises = [
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
                })
            ];

            const results = await Promise.all(loadingPromises);
            const loadedData = results.filter(result => result !== null);
            console.log(`Data loaders initialized successfully (${loadedData.length} of ${loadingPromises.length} loaders)`);
        } catch (error) {
            console.error('Error initializing data loaders:', error);
        }

        // Initialize character handler
        await characterHandler.initialize();
        console.log('Character handler initialized successfully');

        // Initialize navigation
        navigation.initialize();
        console.log('Navigation initialized successfully');

        // Initialize tooltips
        tooltipManager.initialize();
        console.log('Tooltip manager initialized successfully');

        // Initialize text processor
        textProcessor.initialize();
        console.log('Text processor initialized successfully');

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
        throw error;
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeAll().catch(error => {
        console.error('Error during initialization:', error);
    });
});