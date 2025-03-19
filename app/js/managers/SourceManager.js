/**
 * SourceManager.js
 * Manages source book selection and filtering for character creation and data loading
 * 
 * @typedef {Object} SourceDetails
 * @property {string} name - Full name of the source book
 * @property {string} abbreviation - Short code for the source book
 * @property {boolean} isCore - Whether this is a core rulebook
 * @property {string} group - The group/category of the source book
 * @property {string} version - Version of the source book
 * @property {boolean} hasErrata - Whether the source has errata
 * @property {string} targetLanguage - Target language of the source
 * @property {string} url - URL to the source
 * @property {string} description - Description of the source
 * @property {Array} contents - Contents of the source
 * @property {boolean} isDefault - Whether this is a default source
 */

import { showNotification } from '../utils/notifications.js';
import { SourceLoader } from '../dataloaders/SourceLoader.js';

/**
 * Manages source book selection and filtering for character creation and data loading
 */
export class SourceManager {
    constructor() {
        this.dataLoader = new SourceLoader();
        this.allowedSources = new Set(['PHB']);
        this.availableSources = new Map();
        this.coreSources = new Set();
        this.sources = new Set();
        this.defaultSources = new Set();
        this._initialized = false;
        this.characterHandler = null;

        // List of banned sources
        this.bannedSources = new Set([
            'MPMM',  // Mordenkainen Presents: Monsters of the Multiverse
            'AAG',   // Astral Adventurer's Guide
            'BGG',   // Bigby Presents: Glory of the Giants
            'SATO',  // Sigil and the Outlands
            'BMT',   // The Book of Many Things
            'MOT',   // Mythic Odysseys of Theros
            'MMPM'   // Mordenkainen's Monsters of the Multiverse
        ]);
    }

    /**
     * Set the character handler and initialize listeners
     * @param {CharacterHandler} handler - The character handler instance
     */
    setCharacterHandler(handler) {
        this.characterHandler = handler;
        // Subscribe to character changes
        this.characterHandler.addCharacterListener(this.handleCharacterChange.bind(this));
    }

    /**
     * Handles character changes
     * @param {Character|null} character - The new character
     * @private
     */
    handleCharacterChange(character) {
        console.log('[SourceManager] Character changed:', character ? 'new character' : 'null');
        if (!character) {
            this.allowedSources = new Set(['PHB']);
            console.log('[SourceManager] Reset to default PHB source');
            return;
        }

        // Update allowed sources from character
        console.log('[SourceManager] Character allowed sources:', Array.from(character.allowedSources || ['PHB']));
        this.allowedSources = new Set(character.allowedSources || ['PHB']);
        console.log('[SourceManager] Updated allowed sources:', Array.from(this.allowedSources));
    }

    /**
     * Initialize the source manager with data from the loader
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            console.log('[SourceManager] Already initialized');
            return;
        }

        try {
            console.log('[SourceManager] Starting initialization');
            const sources = await this.dataLoader.loadSources();
            console.log('[SourceManager] Loaded sources from data loader');

            if (sources.source && Array.isArray(sources.source)) {
                // Filter and sort sources
                const validSources = sources.source
                    .filter(source => {
                        // Filter out banned sources (case insensitive)
                        if (this.bannedSources.has(source.id.toUpperCase())) {
                            console.log('[SourceManager] Filtered out banned source:', source.id);
                            return false;
                        }

                        // Then check if it has player options
                        const hasOptions = source.contents?.some(content => {
                            // Check the section name
                            if (['Races', 'Classes', 'Backgrounds', 'Feats', 'Spells',
                                'Equipment', 'Magic Items', 'Subclasses', 'Subraces',
                                'Class Options', 'Character Options', 'Customization Options',
                                'Multiclassing', 'Personality and Background'].some(keyword =>
                                    content.name.toLowerCase().includes(keyword.toLowerCase()))) {
                                return true;
                            }

                            // Check headers if they exist
                            if (content.headers && Array.isArray(content.headers)) {
                                const hasPlayerHeader = content.headers.some(header => {
                                    // Handle both string and object headers
                                    const headerText = typeof header === 'string' ? header : header.header;
                                    if (!headerText) return false;

                                    return ['Races', 'Classes', 'Backgrounds', 'Feats', 'Spells',
                                        'Equipment', 'Magic Items', 'Subclasses', 'Subraces',
                                        'Class Options', 'Character Options', 'Customization Options',
                                        'Multiclassing', 'Personality and Background'].some(keyword =>
                                            headerText.toLowerCase().includes(keyword.toLowerCase())
                                        );
                                });

                                if (hasPlayerHeader) return true;
                            }

                            return false;
                        });

                        if (!hasOptions) {
                            console.log('[SourceManager] Filtered out source without player options:', source.id);
                        }
                        return hasOptions;
                    })
                    .sort((a, b) => {
                        // PHB and XPHB always first
                        if (a.id === 'PHB') return -1;
                        if (b.id === 'PHB') return 1;
                        if (a.id === 'XPHB') return -1;
                        if (b.id === 'XPHB') return 1;

                        // Then sort by group priority: core > setting > supplement
                        const groupPriority = { core: 0, setting: 1, supplement: 2 };
                        return groupPriority[a.group] - groupPriority[b.group];
                    });

                console.log('[SourceManager] Valid sources after filtering:', validSources.map(s => s.id));

                // Initialize available sources
                for (const source of validSources) {
                    this.availableSources.set(source.id, {
                        name: source.name,
                        abbreviation: source.abbreviation,
                        isCore: source.isCore || false,
                        group: source.group,
                        version: source.version,
                        hasErrata: source.hasErrata,
                        targetLanguage: source.targetLanguage,
                        url: source.url,
                        description: source.description,
                        contents: source.contents,
                        isDefault: source.isDefault
                    });

                    if (source.isCore) {
                        this.coreSources.add(source.id);
                    }
                }

                // Set default sources (PHB, DMG, MM)
                this.defaultSources = new Set(['PHB', 'DMG', 'MM']);
                this._initialized = true;
                console.log('[SourceManager] Initialization complete');
            } else {
                console.error('[SourceManager] Invalid source data format:', sources);
                showNotification('Error loading source books: Invalid data format', 'error');
            }
        } catch (error) {
            console.error('[SourceManager] Error during initialization:', error);
            showNotification('Error loading source books', 'error');
        }
    }

    /**
     * Get available sources
     * @returns {Array<string>} Array of available source codes
     */
    getAvailableSources() {
        console.log('[SourceManager] Getting available sources:', Array.from(this.availableSources.keys()));
        return Array.from(this.availableSources.keys());
    }

    /**
     * Get the set of core source books
     * @returns {Set<string>} Set of core source book abbreviations
     */
    getCoreSources() {
        return this.coreSources;
    }

    /**
     * Check if a source is valid
     * @param {string} source - Source code to validate
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
     * @param {Array<Object>} data - Array of data objects to filter
     * @param {Set<string>} allowedSources - Set of allowed source abbreviations
     * @returns {Array<Object>} Filtered array of data objects
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
     * Get source details
     * @param {string} source - Source code to get details for
     * @returns {SourceDetails|null} Source details or null if not found
     */
    getSourceDetails(source) {
        const details = this.availableSources.get(source?.toUpperCase());
        console.log('[SourceManager] Getting details for source:', source, details ? 'found' : 'not found');
        return details;
    }

    /**
     * Format source name for display
     * @param {string} source - Source abbreviation
     * @returns {string} Formatted source name
     */
    formatSourceName(source) {
        const details = this.getSourceDetails(source);
        return details ? details.name : source;
    }

    /**
     * Validate source selection
     * @param {Set<string>} sources - Set of selected sources
     * @returns {boolean} True if selection is valid
     */
    validateSourceSelection(sources) {
        console.log('[SourceManager] Validating source selection:', Array.from(sources));

        // Convert sources to uppercase for comparison
        const upperSources = new Set(Array.from(sources).map(s => s.toUpperCase()));

        // Check if either PHB or XPHB is selected
        const hasCoreSource = upperSources.has('PHB') || upperSources.has('XPHB');

        if (!hasCoreSource) {
            console.log('[SourceManager] No core source selected');
            showNotification('Please select either PHB\'14 or PHB\'24', 'warning');
            return false;
        }

        console.log('[SourceManager] Source selection validated successfully');
        return true;
    }

    /**
     * Update allowed sources
     * @param {Set<string>} sources - New set of allowed sources
     * @returns {boolean} True if sources were updated successfully
     */
    updateAllowedSources(sources) {
        console.log('[SourceManager] Updating allowed sources:', Array.from(sources));

        // Convert sources to uppercase for validation
        const upperSources = new Set(Array.from(sources).map(s => s.toUpperCase()));

        if (!this.validateSourceSelection(upperSources)) {
            console.log('[SourceManager] Source selection validation failed');
            return false;
        }

        const character = this.characterHandler.currentCharacter;
        if (!character) {
            console.log('[SourceManager] No current character found');
            return false;
        }

        console.log('[SourceManager] Setting allowed sources for character:', character.id);
        character.setAllowedSources(upperSources);
        this.allowedSources = new Set(upperSources);
        console.log('[SourceManager] Allowed sources updated successfully');
        return true;
    }

    /**
     * Get the current allowed sources
     * @returns {Set<string>} Set of allowed source codes
     */
    getAllowedSources() {
        console.log('[SourceManager] Getting allowed sources:', Array.from(this.allowedSources));
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

    /**
     * Load source data
     * @returns {Promise<Array>} Array of source data
     */
    async loadSources() {
        try {
            return await this.dataLoader.loadSources();
        } catch (error) {
            console.error('Error loading sources:', error);
            showNotification('Error loading sources', 'error');
            return [];
        }
    }

    /**
     * Add a source to allowed sources
     * @param {string} sourceId - Source identifier to add
     */
    addSource(sourceId) {
        console.log('[SourceManager] Adding source:', sourceId);
        this.allowedSources.add(sourceId);
        console.log('[SourceManager] Current allowed sources:', Array.from(this.allowedSources));
    }

    /**
     * Remove a source from allowed sources
     * @param {string} sourceId - Source identifier to remove
     * @returns {boolean} True if source was removed
     */
    removeSource(sourceId) {
        console.log('[SourceManager] Removing source:', sourceId);
        const removed = this.allowedSources.delete(sourceId);
        console.log('[SourceManager] Source removed:', removed);
        console.log('[SourceManager] Current allowed sources:', Array.from(this.allowedSources));
        return removed;
    }

    /**
     * Clear all sources except PHB
     */
    clearSources() {
        this.allowedSources = new Set(['PHB']);
    }

    /**
     * Clear the data loader cache
     */
    clearCache() {
        if (this.dataLoader) {
            this.dataLoader.clearCache();
        }
    }

    /**
     * Check if a source contains player options
     * @param {string} source - Source abbreviation
     * @returns {boolean} Whether the source contains player options
     */
    hasPlayerOptions(source) {
        const details = this.getSourceDetails(source);
        if (!details || !details.contents) return false;

        // Keywords that indicate player options
        const playerOptionKeywords = [
            'Races',
            'Classes',
            'Backgrounds',
            'Feats',
            'Spells',
            'Equipment',
            'Magic Items',
            'Subclasses',
            'Subraces',
            'Class Options',
            'Character Options',
            'Customization Options',
            'Multiclassing',
            'Personality and Background'
        ];

        // Check each content section for player option keywords
        return details.contents.some(content => {
            // Check the section name
            if (playerOptionKeywords.some(keyword =>
                content.name.toLowerCase().includes(keyword.toLowerCase()))) {
                return true;
            }

            // Check headers if they exist
            if (content.headers && Array.isArray(content.headers)) {
                return content.headers.some(header =>
                    playerOptionKeywords.some(keyword =>
                        header.toLowerCase().includes(keyword.toLowerCase())
                    )
                );
            }

            return false;
        });
    }
} 