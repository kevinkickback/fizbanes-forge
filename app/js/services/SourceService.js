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

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from '../application/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { showNotification } from '../utils/Notifications.js';
import { DataLoader } from '../utils/DataLoader.js';

/**
 * Manages source book selection and filtering for character creation and data loading
 */
export class SourceService {
    /**
     * Create a new SourceManager instance
     */
    constructor() {
        this.availableSources = new Map();
        this.coreSources = new Set();
        this.sources = new Set();
        this._initialized = false;
        this.characterHandler = null;

        /**
         * @type {Set<string>} Sources that are allowed for the current character
         * @description Default to PHB as the minimum allowed source
         */
        this.allowedSources = new Set(['PHB']);

        /**
         * @type {Set<string>} Default sources that every character begins with
         * @description These sources are core rulebooks required for character creation
         * @private
         */
        this._defaultSources = new Set(['PHB', 'DMG', 'MM']);

        /**
         * @type {Set<string>} Sources that are banned from selection
         * @description These sources are excluded because they contain content
         * that is not compatible with the character creator
         * @private
         */
        this._bannedSources = new Set([
            'MPMM',  // Mordenkainen Presents: Monsters of the Multiverse
            'AAG',   // Astral Adventurer's Guide
            'BGG',   // Bigby Presents: Glory of the Giants
            'SATO',  // Sigil and the Outlands
            'BMT',   // The Book of Many Things
            'MOT',   // Mythic Odysseys of Theros
            'MMPM'   // Mordenkainen's Monsters of the Multiverse
        ]);

        // Setup event handlers
        this._setupEventListeners();
    }

    /**
     * Set up event listeners
     * @private
     */
    _setupEventListeners() {
        // Set up listeners for relevant application events
        eventBus.on(EVENTS.CHARACTER_LOADED, this._handleCharacterChange.bind(this));
        eventBus.on(EVENTS.CHARACTER_CREATED, this._handleCharacterChange.bind(this));
    }

    /**
     * Set the character lifecycle and initialize listeners
     * @param {CharacterLifecycle} handler - The character lifecycle instance
     */
    setCharacterHandler(handler) {
        this.characterHandler = handler;
        // Subscribe to character changes
        this.characterHandler.addCharacterListener(this._handleCharacterChange.bind(this));
    }

    /**
     * Handles character changes
     * @param {Character|null} character - The new character
     * @private
     */
    _handleCharacterChange(character) {
        if (!character) {
            this.allowedSources = new Set(['PHB']);
            return;
        }

        // Update allowed sources from character
        this.allowedSources = new Set(character.allowedSources || ['PHB']);

        // Notify that allowed sources have changed
        eventEmitter.emit('sources:allowed-changed', Array.from(this.allowedSources));
    }

    /**
     * Initialize the source manager with data from the loader
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            return;
        }

        try {
            Logger.info('SourceService', 'Starting initialization');
            const sources = await DataLoader.loadSources();

            if (sources.book && Array.isArray(sources.book)) {
                // Filter and sort sources
                const validSources = sources.book
                    .filter(source => {
                        // Filter out banned sources (case insensitive)
                        if (this.isBannedSource(source.id)) {
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

                Logger.debug('SourceService', 'Valid sources after filtering', { sources: validSources.map(s => s.id) });

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

                this._initialized = true;
                Logger.info('SourceService', 'Initialization complete', { sourceCount: this.availableSources.size });

                // Emit initialization complete event
                eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'source', this);
            } else {
                Logger.error('SourceService', 'Invalid source data format', sources);
                showNotification('Error loading source books: Invalid data format', 'error');
            }
        } catch (error) {
            Logger.error('SourceService', 'Error during initialization', error);
            showNotification('Error loading source books', 'error');
            throw error;
        }
    }

    /**
     * Check if a source is banned
     * @param {string} sourceId - Source ID to check
     * @returns {boolean} True if the source is banned
     */
    isBannedSource(sourceId) {
        return this._bannedSources.has(sourceId.toUpperCase());
    }

    /**
     * Get the default sources that all characters begin with
     * @returns {string[]} Array of default source IDs
     */
    getDefaultSources() {
        return Array.from(this._defaultSources);
    }

    /**
     * Get available sources
     * @returns {Array<string>} Array of available source codes
     */
    getAvailableSources() {
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
        return this.availableSources.has(source);
    }

    /**
     * Check if a source is allowed for the current character
     * @param {string} source - Source code to check
     * @returns {boolean} Whether the source is allowed
     */
    isSourceAllowed(source) {
        return this.allowedSources.has(source);
    }

    /**
     * Get details for a specific source
     * @param {string} source - Source code
     * @returns {SourceDetails|null} Source details or null if not found
     */
    getSourceDetails(source) {
        return this.availableSources.get(source) || null;
    }

    /**
     * Get the list of allowed sources for the current character
     * @returns {Array<string>} Array of allowed source codes
     */
    getAllowedSources() {
        return Array.from(this.allowedSources);
    }

    /**
     * Add a source to the allowed sources for the current character
     * @param {string} source - Source code to add
     * @returns {boolean} Whether the source was added
     */
    addAllowedSource(source) {
        if (!this.isValidSource(source)) {
            return false;
        }

        const added = !this.allowedSources.has(source);
        if (added) {
            this.allowedSources.add(source);

            // Notify that allowed sources have changed
            eventEmitter.emit('sources:allowed-changed', Array.from(this.allowedSources));

            // Update character if available
            if (this.characterHandler?.getCurrentCharacter()) {
                this.characterHandler.getCurrentCharacter().allowedSources = new Set(this.allowedSources);
            }
        }

        return added;
    }

    /**
     * Remove a source from the allowed sources for the current character
     * @param {string} source - Source code to remove
     * @returns {boolean} Whether the source was removed
     */
    removeAllowedSource(source) {
        // Don't allow removing PHB
        if (source === 'PHB') {
            return false;
        }

        const removed = this.allowedSources.has(source);
        if (removed) {
            this.allowedSources.delete(source);

            // Notify that allowed sources have changed
            eventEmitter.emit('sources:allowed-changed', Array.from(this.allowedSources));

            // Update character if available
            if (this.characterHandler?.getCurrentCharacter()) {
                this.characterHandler.getCurrentCharacter().allowedSources = new Set(this.allowedSources);
            }
        }

        return removed;
    }

    /**
     * Check if a source is a core rulebook
     * @param {string} source - Source code to check
     * @returns {boolean} Whether the source is a core rulebook
     */
    isCoreSource(source) {
        return this.coreSources.has(source);
    }

    /**
     * Reset the allowed sources to the defaults (PHB)
     */
    resetAllowedSources() {
        this.allowedSources = new Set(['PHB']);

        // Notify that allowed sources have changed
        eventEmitter.emit('sources:allowed-changed', Array.from(this.allowedSources));

        // Update character if available
        if (this.characterHandler?.getCurrentCharacter()) {
            this.characterHandler.getCurrentCharacter().allowedSources = new Set(this.allowedSources);
        }
    }

    /**
     * Formats a source code into a readable name
     * @param {string} source - Source code to format
     * @returns {string} Formatted source name
     */
    formatSourceName(source) {
        // First check if we have this source in our available sources
        if (this.availableSources.has(source)) {
            return this.availableSources.get(source).name;
        }

        // Fall back to known abbreviations
        const sourceMap = {
            'PHB': "Player's Handbook",
            'XPHB': "Player's Handbook (2024)",
            'DMG': "Dungeon Master's Guide",
            'MM': "Monster Manual",
            'XGE': "Xanathar's Guide to Everything",
            'TCE': "Tasha's Cauldron of Everything",
            'VGM': "Volo's Guide to Monsters",
            'MTF': "Mordenkainen's Tome of Foes",
            'SCAG': "Sword Coast Adventurer's Guide",
            'ERLW': "Eberron: Rising from the Last War",
            'EGW': "Explorer's Guide to Wildemount"
        };

        // Return the mapped name or the original source code with better formatting
        return sourceMap[source] || source.replace(/([A-Z])/g, ' $1').trim();
    }

    /**
     * Check if the source manager is initialized
     * @returns {boolean} Whether the source manager is initialized
     */
    isInitialized() {
        return this._initialized;
    }
}

/**
 * Export a singleton instance of the SourceManager
 * @type {SourceManager}
 */
export const sourceService = new SourceService(); 
