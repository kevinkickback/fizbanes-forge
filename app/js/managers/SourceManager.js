import { characterInitializer } from '../utils/Initialize.js';
import { showNotification } from '../utils/notifications.js';

/**
 * Manages source book selection and filtering for character creation and data loading
 */
export class SourceManager {
    constructor() {
        this.dataLoader = characterInitializer.dataLoader;
        this.allowedSources = new Set(['PHB']);

        // Core rulebooks that are always available
        this.coreSources = new Set(['PHB', 'DMG', 'MM']);

        // All available source books
        this.availableSources = new Map([
            ['PHB', { name: "Player's Handbook (2014)", abbreviation: 'PHB', isCore: true }],
            ['XPHB', { name: "Player's Handbook (2024)", abbreviation: 'XPHB', isCore: false }],
            ['DMG', { name: "Dungeon Master's Guide", abbreviation: 'DMG', isCore: true }],
            ['MM', { name: "Monster Manual", abbreviation: 'MM', isCore: true }],
            ['SCAG', { name: "Sword Coast Adventurer's Guide", abbreviation: 'SCAG', isCore: false }],
            ['VGM', { name: "Volo's Guide to Monsters", abbreviation: 'VGM', isCore: false }],
            ['MTF', { name: "Mordenkainen's Tome of Foes", abbreviation: 'MTF', isCore: false }],
            ['TCE', { name: "Tasha's Cauldron of Everything", abbreviation: 'TCE', isCore: false }],
            ['MPMM', { name: "Mordenkainen Presents: Monsters of the Multiverse", abbreviation: 'MPMM', isCore: false }],
            ['VRGR', { name: "Van Richten's Guide to Ravenloft", abbreviation: 'VRGR', isCore: false }],
            ['ERLW', { name: "Eberron: Rising from the Last War", abbreviation: 'ERLW', isCore: false }]
        ]);

        this.sources = new Set();
        this.defaultSources = new Set(['PHB', 'DMG', 'MM', 'XGE', 'TCE', 'SCAG']);
    }

    /**
     * Get all available source books
     * @returns {Map} Map of source books
     */
    getAvailableSources() {
        return this.availableSources;
    }

    /**
     * Get core source books
     * @returns {Set} Set of core source book abbreviations
     */
    getCoreSources() {
        return this.coreSources;
    }

    /**
     * Check if a source is valid
     * @param {string} source - Source abbreviation
     * @returns {boolean} Whether the source is valid
     */
    isValidSource(source) {
        return this.availableSources.has(source?.toUpperCase());
    }

    /**
     * Check if either PHB version is selected
     * @returns {boolean} Whether either PHB version is selected
     */
    hasPhbSource() {
        const allowedSources = this.getAllowedSources();
        return allowedSources.has('PHB') || allowedSources.has('XPHB');
    }

    /**
     * Filter data based on allowed sources
     * @param {Array} data - Array of data objects
     * @param {Set} allowedSources - Set of allowed source abbreviations
     * @returns {Array} Filtered data
     */
    filterBySource(data, allowedSources) {
        if (!Array.isArray(data)) return [];
        if (!allowedSources || allowedSources.size === 0) return [];

        return data.filter(item => {
            const itemSource = item.source?.toUpperCase();
            return itemSource && allowedSources.has(itemSource);
        });
    }

    /**
     * Get source book details
     * @param {string} source - Source abbreviation
     * @returns {Object|null} Source book details
     */
    getSourceDetails(source) {
        return this.availableSources.get(source?.toUpperCase()) || null;
    }

    /**
     * Format source name for display
     * @param {string} source - Source abbreviation
     * @returns {string} Formatted source name
     */
    formatSourceName(source) {
        const details = this.getSourceDetails(source);
        return details ? `${details.name} (${details.abbreviation})` : source;
    }

    /**
     * Validate source selection
     * @param {Set<string>} sources - Set of source codes to validate
     * @returns {boolean} - True if the selection is valid
     */
    validateSourceSelection(sources) {
        const hasPhb14 = sources.has('PHB');
        const hasPhb24 = sources.has('XPHB');

        if (!hasPhb14 && !hasPhb24) {
            showNotification('Please select either PHB\'14 or PHB\'24', 'warning');
            return false;
        }

        return true;
    }

    /**
     * Update allowed sources
     * @param {Set<string>} sources - New set of allowed sources
     * @returns {boolean} - True if sources were updated successfully
     */
    updateAllowedSources(sources) {
        if (!this.validateSourceSelection(sources)) {
            return false;
        }

        this.allowedSources = new Set(sources);

        // Clear data loader cache when sources change
        if (this.dataLoader) {
            this.dataLoader.clearCache();
        }

        return true;
    }

    /**
     * Get the current allowed sources
     * @returns {Set<string>} Set of allowed source codes
     */
    getAllowedSources() {
        return new Set(this.allowedSources);
    }

    /**
     * Check if a source is allowed
     * @param {string} source - Source code to check
     * @returns {boolean} True if the source is allowed
     */
    isSourceAllowed(source) {
        return this.allowedSources.has(source);
    }

    async loadSources() {
        try {
            return await this.dataLoader.loadSources();
        } catch (error) {
            console.error('Error loading sources:', error);
            showNotification('Error loading sources', 'error');
            return [];
        }
    }

    addSource(sourceId) {
        this.allowedSources.add(sourceId);
    }

    removeSource(sourceId) {
        if (sourceId === 'PHB') {
            showNotification('Cannot remove Player\'s Handbook', 'warning');
            return false;
        }
        return this.allowedSources.delete(sourceId);
    }

    clearSources() {
        this.allowedSources = new Set(['PHB']);
    }

    clearCache() {
        if (this.dataLoader) {
            this.dataLoader.clearCache();
        }
    }
} 