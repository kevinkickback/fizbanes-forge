/**
 * navigation.js
 * Handles page navigation, routing, and page component initialization
 * 
 * @typedef {Object} NavigationState
 * @property {string} currentPage - The currently active page
 * @property {boolean} initialized - Whether the navigation system has been initialized
 * 
 * @typedef {Object} NavigationOptions
 * @property {boolean} [forceReload=false] - Whether to force reload the page content
 * @property {boolean} [skipAnimation=false] - Whether to skip transition animations
 */

import { showNotification } from './notifications.js';
import { characterHandler } from './characterHandler.js';
import { settingsManager } from '../managers/SettingsManager.js';

/**
 * Singleton instance for Navigation class
 * @type {Navigation|null}
 * @private
 */
let _instance = null;

/**
 * Navigation class for managing page navigation and component loading
 */
export class Navigation {
    /**
     * Creates a new Navigation instance.
     * Private constructor enforcing the singleton pattern.
     * @throws {Error} If trying to instantiate more than once
     * @private
     */
    constructor() {
        if (_instance) {
            throw new Error('Navigation is a singleton. Use Navigation.getInstance() instead.');
        }

        /**
         * Currently active page
         * @type {string}
         */
        this.currentPage = 'home';

        /**
         * Whether navigation has been initialized
         * @type {boolean}
         * @private
         */
        this._initialized = false;

        /**
         * Pages that require a character to be selected
         * @type {readonly string[]}
         * @private
         */
        this._CHARACTER_PAGES = Object.freeze(['build', 'equipment', 'details']);

        /**
         * UI card components for different pages
         * @type {Object}
         * @private 
         */
        this._uiComponents = {
            raceCard: null,
            classCard: null,
            backgroundCard: null,
            abilityScoreCard: null,
            proficiencyCard: null
        };

        _instance = this;
    }

    //-------------------------------------------------------------------------
    // Core Navigation Methods
    //-------------------------------------------------------------------------

    /**
     * Initialize the navigation system
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            if (this._initialized) return;

            // Set up navigation buttons
            const navButtons = document.querySelectorAll('.nav-link');
            for (const button of navButtons) {
                button.addEventListener('click', (e) => {
                    if (button.classList.contains('disabled')) {
                        e.preventDefault();
                        showNotification('Please select or create a character first', 'warning');
                        return;
                    }

                    const page = button.getAttribute('data-page');
                    this.navigateTo(page);
                });
            }

            // Load initial page
            this.navigateTo('home');
            this._initialized = true;

            console.debug('Navigation system initialized');
        } catch (error) {
            console.error('Error initializing navigation:', error);
        }
    }

    /**
     * Navigates to a specific page
     * @param {string} pageName - The name of the page to load
     * @returns {Promise<void>}
     */
    async navigateTo(pageName) {
        try {
            // Alias for backward compatibility
            return this.loadPage(pageName);
        } catch (error) {
            console.error(`Error navigating to ${pageName}:`, error);
        }
    }

    /**
     * Loads and displays a specific page
     * @param {string} pageName - The name of the page to load
     * @returns {Promise<void>}
     */
    async loadPage(pageName) {
        try {
            console.debug(`Loading page: ${pageName}`);

            // Prevent navigation to character pages if no character is selected
            if (this._requiresCharacter(pageName) && (!characterHandler.currentCharacter || !characterHandler.currentCharacter.id)) {
                showNotification('Please select or create a character first', 'warning');
                return;
            }

            // Save changes from current page before navigating away
            await this._saveCurrentPageChanges();

            // Update navigation state
            this._updateNavigationState(pageName);

            // Load page content
            const pageContent = document.getElementById('pageContent');
            const template = document.getElementById(`${pageName}Page`);

            if (!template) {
                console.error(`Template for page "${pageName}" not found`);
                return;
            }

            pageContent.innerHTML = '';
            pageContent.appendChild(template.content.cloneNode(true));
            document.body.setAttribute('data-current-page', pageName);
            this.currentPage = pageName;

            // Initialize page content and components
            await this._initializePageContent(pageName);

            console.debug(`Page "${pageName}" loaded successfully`);
        } catch (error) {
            console.error(`Error loading page "${pageName}":`, error);
            showNotification(`Failed to load page: ${error.message}`, 'error');
        }
    }

    /**
     * Gets the current page name
     * @returns {string} Name of the current page
     */
    getCurrentPage() {
        return this.currentPage;
    }

    //-------------------------------------------------------------------------
    // Page State Management
    //-------------------------------------------------------------------------

    /**
     * Checks if a page requires a character to be selected
     * @param {string} pageName - The name of the page to check
     * @returns {boolean} Whether the page requires a character
     * @private
     */
    _requiresCharacter(pageName) {
        return this._CHARACTER_PAGES.includes(pageName);
    }

    /**
     * Saves changes from the current page before navigating away
     * @returns {Promise<void>}
     * @private
     */
    async _saveCurrentPageChanges() {
        try {
            if (!characterHandler.currentCharacter) return;

            // Track if any actual changes were made
            let changesMade = false;

            // Save changes based on the current page
            switch (this.currentPage) {
                case 'details': {
                    // Save character details without triggering a full save operation
                    characterHandler.updateCharacterDetails(true);
                    break;
                }
                case 'build': {
                    // Save race and other build page data
                    const buildFields = characterHandler._getCharacterDetailFields();

                    // Handle race selection
                    if (this._processRaceSelection(buildFields)) {
                        changesMade = true;
                    }

                    // Handle class selection
                    if (this._processClassSelection(buildFields)) {
                        changesMade = true;
                    }

                    // Handle background selection
                    if (this._processBackgroundSelection(buildFields)) {
                        changesMade = true;
                    }
                    break;
                }
                case 'equipment': {
                    // Add code to save equipment page changes
                    break;
                }
            }

            // Only show unsaved changes if actual changes were made
            if (changesMade) {
                characterHandler.showUnsavedChanges();
            }
        } catch (error) {
            console.error('Error saving current page changes:', error);
        }
    }

    /**
     * Processes race selection from form fields
     * @param {Object} buildFields - Form fields from the build page
     * @returns {boolean} Whether changes were made
     * @private
     */
    _processRaceSelection(buildFields) {
        let changesMade = false;
        try {
            const raceSelect = document.getElementById('raceSelect');
            const subraceSelect = document.getElementById('subraceSelect');

            if (raceSelect?.value) {
                const [raceName, source] = raceSelect.value.split('_');
                // Only update if the values are different
                if (characterHandler.currentCharacter.race?.name !== raceName ||
                    characterHandler.currentCharacter.race?.source !== source) {
                    characterHandler.currentCharacter.race = {
                        ...characterHandler.currentCharacter.race,
                        name: raceName,
                        source: source
                    };
                    changesMade = true;
                }
            }

            if (subraceSelect?.value) {
                if (characterHandler.currentCharacter.race?.subrace !== subraceSelect.value) {
                    characterHandler.currentCharacter.race.subrace = subraceSelect.value;
                    changesMade = true;
                }
            }
        } catch (error) {
            console.error('Error processing race selection:', error);
        }
        return changesMade;
    }

    /**
     * Processes class selection from form fields
     * @param {Object} buildFields - Form fields from the build page
     * @returns {boolean} Whether changes were made
     * @private
     */
    _processClassSelection(buildFields) {
        let changesMade = false;
        try {
            const classSelect = document.getElementById('classSelect');
            const subclassSelect = document.getElementById('subclassSelect');

            if (classSelect?.value) {
                const [className, source] = classSelect.value.split('_');
                if (characterHandler.currentCharacter.class?.name !== className ||
                    characterHandler.currentCharacter.class?.source !== source) {
                    characterHandler.currentCharacter.class = {
                        ...characterHandler.currentCharacter.class,
                        name: className,
                        source: source
                    };
                    changesMade = true;
                }
            }

            if (subclassSelect?.value) {
                if (characterHandler.currentCharacter.class?.subclass !== subclassSelect.value) {
                    characterHandler.currentCharacter.class.subclass = subclassSelect.value;
                    changesMade = true;
                }
            }
        } catch (error) {
            console.error('Error processing class selection:', error);
        }
        return changesMade;
    }

    /**
     * Processes background selection from form fields
     * @param {Object} buildFields - Form fields from the build page
     * @returns {boolean} Whether changes were made
     * @private
     */
    _processBackgroundSelection(buildFields) {
        let changesMade = false;
        try {
            const backgroundSelect = document.getElementById('backgroundSelect');
            const variantSelect = document.getElementById('variantSelect');

            if (backgroundSelect?.value) {
                const [backgroundName, source] = backgroundSelect.value.split('_');
                if (characterHandler.currentCharacter.background?.name !== backgroundName ||
                    characterHandler.currentCharacter.background?.source !== source) {
                    characterHandler.currentCharacter.background = {
                        ...characterHandler.currentCharacter.background,
                        name: backgroundName,
                        source: source
                    };
                    changesMade = true;
                }
            }

            if (variantSelect?.value) {
                if (characterHandler.currentCharacter.background?.variant !== variantSelect.value) {
                    characterHandler.currentCharacter.background.variant = variantSelect.value;
                    changesMade = true;
                }
            }
        } catch (error) {
            console.error('Error processing background selection:', error);
        }
        return changesMade;
    }

    /**
     * Updates the navigation state and UI
     * @param {string} pageName - The name of the current page
     * @private
     */
    _updateNavigationState(pageName) {
        try {
            const navLinks = document.querySelectorAll('.nav-link');
            for (const link of navLinks) {
                const page = link.getAttribute('data-page');
                link.classList.toggle('active', page === pageName);
                if (this._requiresCharacter(page)) {
                    link.classList.toggle('disabled', !characterHandler.currentCharacter);
                }
            }
        } catch (error) {
            console.error('Error updating navigation state:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Page Content Initialization
    //-------------------------------------------------------------------------

    /**
     * Initializes the content for a specific page
     * @param {string} pageName - The name of the page to initialize
     * @returns {Promise<void>}
     * @private
     */
    async _initializePageContent(pageName) {
        try {
            const pageInitializers = {
                home: () => {
                    characterHandler.loadCharacters();
                    characterHandler.initializeEventListeners();
                },
                build: () => this._initializeBuildPageFields(),
                equipment: () => {
                    // Initialize equipment page
                },
                details: () => {
                    characterHandler.populateDetailsPage();
                },
                tooltipTest: () => {
                    // Initialize tooltip test page
                },
                settings: () => {
                    settingsManager.updateSavePathDisplay();
                }
            };

            const initializer = pageInitializers[pageName];
            if (initializer) {
                await initializer();
            }

            // Initialize page-specific components
            await this._initializePageComponents(pageName);
        } catch (error) {
            console.error(`Error initializing content for page "${pageName}":`, error);
        }
    }

    /**
     * Initialize the build page form fields with character data
     * @returns {Promise<void>}
     * @private
     */
    async _initializeBuildPageFields() {
        try {
            if (!characterHandler.currentCharacter) return;

            // Initialize race selection
            await this._initializeFormSelection(
                'raceSelect',
                characterHandler.currentCharacter.race,
                'subraceSelect',
                100
            );

            // Initialize class selection
            await this._initializeFormSelection(
                'classSelect',
                characterHandler.currentCharacter.class,
                'subclassSelect',
                150
            );

            // Initialize background selection
            await this._initializeFormSelection(
                'backgroundSelect',
                characterHandler.currentCharacter.background,
                'variantSelect',
                200
            );
        } catch (error) {
            console.error('Error initializing build page fields:', error);
        }
    }

    /**
     * Initialize a form selection with character data
     * @param {string} selectId - ID of the select element
     * @param {Object} characterData - Data to set in the form
     * @param {string} subSelectId - ID of the sub-selection element
     * @param {number} delay - Delay in ms before setting the value
     * @returns {Promise<void>}
     * @private
     */
    async _initializeFormSelection(selectId, characterData, subSelectId, delay) {
        return new Promise(resolve => {
            try {
                const selectElement = document.getElementById(selectId);
                const subSelectElement = document.getElementById(subSelectId);

                if (!selectElement || !characterData || !characterData.name || !characterData.source) {
                    resolve();
                    return;
                }

                const value = `${characterData.name}_${characterData.source}`;

                // Set after a small delay to ensure the dropdown is fully initialized
                setTimeout(() => {
                    try {
                        if (selectElement.querySelector(`option[value="${value}"]`)) {
                            selectElement.value = value;
                            // Trigger change event to update sub-options
                            selectElement.dispatchEvent(new Event('change'));

                            // If there's a sub-selection, set it after a small delay
                            if (subSelectElement && characterData[subSelectId.replace('Select', '')]) {
                                const subValue = characterData[subSelectId.replace('Select', '')];
                                setTimeout(() => {
                                    try {
                                        if (subSelectElement.querySelector(`option[value="${subValue}"]`)) {
                                            subSelectElement.value = subValue;
                                            subSelectElement.dispatchEvent(new Event('change'));
                                        }
                                    } catch (error) {
                                        console.error(`Error setting sub-selection for ${selectId}:`, error);
                                    }
                                    resolve();
                                }, 100);
                            } else {
                                resolve();
                            }
                        } else {
                            resolve();
                        }
                    } catch (error) {
                        console.error(`Error setting selection for ${selectId}:`, error);
                        resolve();
                    }
                }, delay);
            } catch (error) {
                console.error(`Error initializing form selection for ${selectId}:`, error);
                resolve();
            }
        });
    }

    /**
     * Initialize page-specific components
     * @param {string} pageName - The name of the page
     * @returns {Promise<void>}
     * @private
     */
    async _initializePageComponents(pageName) {
        try {
            switch (pageName) {
                case 'home':
                    await this._initializeHomePage();
                    break;
                case 'build':
                    await this._initializeBuildPage();
                    break;
                case 'equipment':
                    await this._initializeEquipmentPage();
                    break;
                case 'details':
                    await this._initializeDetailsPage();
                    break;
                case 'tooltipTest':
                    await this._initializeTooltipTestPage();
                    break;
                case 'settings':
                    await this._initializeSettingsPage();
                    break;
            }
        } catch (error) {
            console.error(`Error initializing components for page "${pageName}":`, error);
        }
    }

    //-------------------------------------------------------------------------
    // Page-Specific Initialization
    //-------------------------------------------------------------------------

    /**
     * Initialize the build page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeBuildPage() {
        try {
            // Initialize the race card
            if (!this._uiComponents.raceCard) {
                const RaceCard = (await import('../ui/RaceCard.js')).RaceCard;
                this._uiComponents.raceCard = new RaceCard();
                await this._uiComponents.raceCard.initialize();
            }

            // Initialize the class card
            if (!this._uiComponents.classCard) {
                const ClassCard = (await import('../ui/ClassCard.js')).ClassCard;
                this._uiComponents.classCard = new ClassCard();
                await this._uiComponents.classCard.initialize();
            }

            // Initialize the background card
            if (!this._uiComponents.backgroundCard) {
                const BackgroundCard = (await import('../ui/BackgroundCard.js')).BackgroundCard;
                this._uiComponents.backgroundCard = new BackgroundCard();
                await this._uiComponents.backgroundCard.initialize();
            }

            // Initialize the ability score card
            if (!this._uiComponents.abilityScoreCard) {
                const AbilityScoreCard = (await import('../ui/AbilityScoreCard.js')).AbilityScoreCard;
                this._uiComponents.abilityScoreCard = new AbilityScoreCard();
                await this._uiComponents.abilityScoreCard.initialize();
            }

            // Initialize the proficiency card
            if (!this._uiComponents.proficiencyCard) {
                const ProficiencyCard = (await import('../ui/ProficiencyCard.js')).ProficiencyCard;
                this._uiComponents.proficiencyCard = new ProficiencyCard();
                await this._uiComponents.proficiencyCard.initialize();
            }
        } catch (error) {
            console.error('Error initializing build page components:', error);
        }
    }

    /**
     * Initialize the home page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeHomePage() {
        // No special components to initialize for home page yet
    }

    /**
     * Initialize the equipment page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeEquipmentPage() {
        // Equipment page components will be initialized here
    }

    /**
     * Initialize the details page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeDetailsPage() {
        // Details page components will be initialized here
    }

    /**
     * Initialize the tooltip test page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeTooltipTestPage() {
        // Tooltip test page components will be initialized here
    }

    /**
     * Initialize the settings page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeSettingsPage() {
        // Settings page components will be initialized here
    }

    /**
     * Gets the singleton instance of Navigation
     * @returns {Navigation} The singleton instance
     * @static
     */
    static getInstance() {
        if (!_instance) {
            _instance = new Navigation();
        }
        return _instance;
    }
}

/**
 * Export the singleton instance
 * @type {Navigation}
 */
export const navigation = Navigation.getInstance(); 