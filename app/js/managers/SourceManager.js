/**
 * Manages source book selection and filtering for character creation and data loading
 */
export class SourceManager {
    constructor() {
        // Core rulebooks that are always available
        this.coreSources = new Set(['PHB', 'DMG', 'MM']);

        // All available source books
        this.availableSources = new Map([
            ['PHB', { name: "Player's Handbook", abbreviation: 'PHB', isCore: true }],
            ['DMG', { name: "Dungeon Master's Guide", abbreviation: 'DMG', isCore: true }],
            ['MM', { name: "Monster Manual", abbreviation: 'MM', isCore: true }],
            ['XPHB', { name: "Player's Handbook (2024)", abbreviation: 'XPHB', isCore: false }],
            ['SCAG', { name: "Sword Coast Adventurer's Guide", abbreviation: 'SCAG', isCore: false }],
            ['VGM', { name: "Volo's Guide to Monsters", abbreviation: 'VGM', isCore: false }],
            ['MTF', { name: "Mordenkainen's Tome of Foes", abbreviation: 'MTF', isCore: false }],
            ['TCE', { name: "Tasha's Cauldron of Everything", abbreviation: 'TCE', isCore: false }],
            ['MPMM', { name: "Mordenkainen Presents: Monsters of the Multiverse", abbreviation: 'MPMM', isCore: false }],
            ['VRGR', { name: "Van Richten's Guide to Ravenloft", abbreviation: 'VRGR', isCore: false }],
            ['ERLW', { name: "Eberron: Rising from the Last War", abbreviation: 'ERLW', isCore: false }]
        ]);
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
} 