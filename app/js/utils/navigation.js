/**
 * navigation.js
 * Page navigation and routing
 * 
 * @typedef {Object} NavigationState
 * @property {string} currentPage - The currently active page
 * @property {boolean} _initialized - Whether the navigation system has been initialized
 * 
 * @typedef {Object} NavigationOptions
 * @property {boolean} [forceReload=false] - Whether to force reload the page content
 * @property {boolean} [skipAnimation=false] - Whether to skip transition animations
 */

import { showNotification } from './notifications.js';
import { characterHandler } from './characterHandler.js';
import { settingsManager } from '../managers/SettingsManager.js';

let instance = null;

export class Navigation {
    /**
     * Creates a new Navigation instance.
     * Private constructor enforcing the singleton pattern.
     * @throws {Error} If trying to instantiate more than once
     */
    constructor() {
        if (instance) {
            throw new Error('Navigation is a singleton. Use Navigation.getInstance() instead.');
        }
        instance = this;

        this.currentPage = 'home';
        this._initialized = false;
        this._CHARACTER_PAGES = Object.freeze(['build', 'equipment', 'details']);
    }

    /**
     * Gets the singleton instance of Navigation
     * @returns {Navigation} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new Navigation();
        }
        return instance;
    }

    /**
     * Initialize the navigation system
     * @returns {Promise<void>}
     */
    async initialize() {
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
                this.loadPage(page);
            });
        }

        // Load initial page
        this.loadPage('home');
        this._initialized = true;
    }

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
     * Loads and displays a specific page
     * @param {string} pageName - The name of the page to load
     * @returns {Promise<void>}
     */
    async loadPage(pageName) {
        // Prevent navigation to character pages if no character is selected
        if (this._requiresCharacter(pageName) && (!characterHandler.currentCharacter || !characterHandler.currentCharacter.id)) {
            showNotification('Please select or create a character first', 'warning');
            return;
        }

        // Save changes from current page before navigating away
        this._saveCurrentPageChanges();

        // Update navigation state
        this._updateNavigationState(pageName);

        // Load page content
        const pageContent = document.getElementById('pageContent');
        const template = document.getElementById(`${pageName}Page`);

        if (template) {
            pageContent.innerHTML = '';
            pageContent.appendChild(template.content.cloneNode(true));
            document.body.setAttribute('data-current-page', pageName);
            this.currentPage = pageName;
            this._initializePageContent(pageName);
        }
    }

    /**
     * Saves changes from the current page before navigating away
     * @private
     */
    _saveCurrentPageChanges() {
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
                const buildFields = characterHandler.getCharacterDetailFields();
                if (buildFields.raceSelect?.value) {
                    const [raceName, source] = buildFields.raceSelect.value.split('_');
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
                if (buildFields.subraceSelect?.value) {
                    if (characterHandler.currentCharacter.race?.subrace !== buildFields.subraceSelect.value) {
                        characterHandler.currentCharacter.race.subrace = buildFields.subraceSelect.value;
                        changesMade = true;
                    }
                }

                // Save class and subclass selections
                if (buildFields.classSelect?.value) {
                    const [className, source] = buildFields.classSelect.value.split('_');
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
                if (buildFields.subclassSelect?.value) {
                    if (characterHandler.currentCharacter.class?.subclass !== buildFields.subclassSelect.value) {
                        characterHandler.currentCharacter.class.subclass = buildFields.subclassSelect.value;
                        changesMade = true;
                    }
                }

                // Save background and variant selections
                if (buildFields.backgroundSelect?.value) {
                    const [backgroundName, source] = buildFields.backgroundSelect.value.split('_');
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
                if (buildFields.variantSelect?.value) {
                    if (characterHandler.currentCharacter.background?.variant !== buildFields.variantSelect.value) {
                        characterHandler.currentCharacter.background.variant = buildFields.variantSelect.value;
                        changesMade = true;
                    }
                }
                break;
            }
            // Add cases for other pages that have form inputs to save
            case 'equipment': {
                // Add code to save equipment page changes
                break;
            }
        }

        // Only show unsaved changes if actual changes were made
        if (changesMade) {
            characterHandler.showUnsavedChanges();
        }
    }

    /**
     * Updates the navigation state and UI
     * @param {string} pageName - The name of the current page
     * @private
     */
    _updateNavigationState(pageName) {
        const navLinks = document.querySelectorAll('.nav-link');
        for (const link of navLinks) {
            const page = link.getAttribute('data-page');
            link.classList.toggle('active', page === pageName);
            if (this._requiresCharacter(page)) {
                link.classList.toggle('disabled', !characterHandler.currentCharacter);
            }
        }
    }

    /**
     * Initializes the content for a specific page
     * @param {string} pageName - The name of the page to initialize
     * @returns {Promise<void>}
     * @private
     */
    async _initializePageContent(pageName) {
        const pageInitializers = {
            home: () => {
                characterHandler.loadCharacters();
                characterHandler.initializeEventListeners();
            },
            build: () => {
                if (characterHandler.currentCharacter) {
                    // All UI components are now initialized in _initializePageComponents

                    // Ensure race selection fields are properly initialized
                    const raceSelect = document.getElementById('raceSelect');
                    const subraceSelect = document.getElementById('subraceSelect');

                    if (raceSelect && characterHandler.currentCharacter.race &&
                        characterHandler.currentCharacter.race.name &&
                        characterHandler.currentCharacter.race.source) {
                        const raceValue = `${characterHandler.currentCharacter.race.name}_${characterHandler.currentCharacter.race.source}`;
                        // Set after a small delay to ensure the dropdown is fully initialized
                        setTimeout(() => {
                            if (raceSelect.querySelector(`option[value="${raceValue}"]`)) {
                                raceSelect.value = raceValue;
                                // Trigger change event to update subrace options
                                raceSelect.dispatchEvent(new Event('change'));
                            }
                        }, 100);
                    }

                    // Ensure class selection fields are properly initialized
                    const classSelect = document.getElementById('classSelect');
                    const subclassSelect = document.getElementById('subclassSelect');

                    if (classSelect && characterHandler.currentCharacter.class &&
                        characterHandler.currentCharacter.class.name &&
                        characterHandler.currentCharacter.class.source) {
                        const classValue = `${characterHandler.currentCharacter.class.name}_${characterHandler.currentCharacter.class.source}`;
                        // Set after a small delay to ensure the dropdown is fully initialized
                        setTimeout(() => {
                            if (classSelect.querySelector(`option[value="${classValue}"]`)) {
                                classSelect.value = classValue;
                                // Trigger change event to update subclass options
                                classSelect.dispatchEvent(new Event('change'));

                                // If there's a subclass, select it after a small delay
                                if (subclassSelect && characterHandler.currentCharacter.class.subclass) {
                                    setTimeout(() => {
                                        if (subclassSelect.querySelector(`option[value="${characterHandler.currentCharacter.class.subclass}"]`)) {
                                            subclassSelect.value = characterHandler.currentCharacter.class.subclass;
                                            subclassSelect.dispatchEvent(new Event('change'));
                                        }
                                    }, 100);
                                }
                            }
                        }, 150);
                    }

                    // Ensure background selection field is properly initialized
                    const backgroundSelect = document.getElementById('backgroundSelect');
                    const variantSelect = document.getElementById('variantSelect');

                    if (backgroundSelect && characterHandler.currentCharacter.background &&
                        characterHandler.currentCharacter.background.name &&
                        characterHandler.currentCharacter.background.source) {
                        const backgroundValue = `${characterHandler.currentCharacter.background.name}_${characterHandler.currentCharacter.background.source}`;
                        // Set after a small delay to ensure the dropdown is fully initialized
                        setTimeout(() => {
                            if (backgroundSelect.querySelector(`option[value="${backgroundValue}"]`)) {
                                backgroundSelect.value = backgroundValue;
                                // Trigger change event to update variant options
                                backgroundSelect.dispatchEvent(new Event('change'));

                                // If there's a variant, select it after a small delay
                                if (variantSelect && characterHandler.currentCharacter.background.variant) {
                                    setTimeout(() => {
                                        if (variantSelect.querySelector(`option[value="${characterHandler.currentCharacter.background.variant}"]`)) {
                                            variantSelect.value = characterHandler.currentCharacter.background.variant;
                                            variantSelect.dispatchEvent(new Event('change'));
                                        }
                                    }, 100);
                                }
                            }
                        }, 200);
                    }
                }
            },
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
            initializer();
        }

        // Initialize page-specific components
        this._initializePageComponents(pageName);
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
            console.error(`[Navigation] Error initializing components for "${pageName}" page:`, error);
        }
    }

    /**
     * Initialize the build page
     * @returns {Promise<void>}
     * @private
     */
    async _initializeBuildPage() {
        try {
            // Initialize the race card
            if (!this.raceCard) {
                const RaceCard = (await import('../ui/RaceCard.js')).RaceCard;
                this.raceCard = new RaceCard();
                await this.raceCard.initialize();
            }

            // Initialize the class card
            if (!this.classCard) {
                const ClassCard = (await import('../ui/ClassCard.js')).ClassCard;
                this.classCard = new ClassCard();
                await this.classCard.initialize();
            }

            // Initialize the background card
            if (!this.backgroundCard) {
                const BackgroundCard = (await import('../ui/BackgroundCard.js')).BackgroundCard;
                this.backgroundCard = new BackgroundCard();
                await this.backgroundCard.initialize();
            }

            // Initialize the ability score card
            if (!this.abilityScoreCard) {
                const AbilityScoreCard = (await import('../ui/AbilityScoreCard.js')).AbilityScoreCard;
                this.abilityScoreCard = new AbilityScoreCard();
                await this.abilityScoreCard.initialize();
            }

            // Initialize the proficiency card
            if (!this.proficiencyCard) {
                const ProficiencyCard = (await import('../ui/ProficiencyCard.js')).ProficiencyCard;
                this.proficiencyCard = new ProficiencyCard();
                await this.proficiencyCard.initialize();
            }

            // Note: We don't automatically show unsaved changes just for navigating to the build page
            // The individual components will show the indicator when actual changes are made
        } catch (error) {
            console.error('[Navigation] Error initializing build page components:', error);
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
}

/**
 * Export the singleton instance
 * @type {Navigation}
 */
export const navigation = Navigation.getInstance(); 