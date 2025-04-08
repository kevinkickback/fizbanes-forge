/**
 * EquipmentCard.js
 * UI component that manages the display of character equipment and inventory.
 * Handles equipment display and interaction in three categories: inventory, equipped, and attuned items.
 */

import { EntityCard } from './EntityCard.js';

/**
 * Manages the equipment card UI component and related functionality
 */
export class EquipmentCard {
    /**
     * Creates a new EquipmentCard instance
     * @param {Character} character - The character whose equipment to display
     */
    constructor(character) {
        /**
         * Reference to the character
         * @type {Character}
         * @private
         */
        this._character = character;
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initialize the equipment page UI and structure
     * @returns {Promise<void>}
     */
    async initializeEquipmentPage() {
        try {
            if (!this._character) {
                console.error('No character provided');
                return;
            }

            // Initialize equipment sections
            const sections = this._createEquipmentSections();

            // Create tabs for different sections
            const tabContainer = this._createTabContainer();

            // Create content container
            const contentContainer = this._createContentContainer(sections);

            // Get the equipment page container
            const container = document.querySelector('#pageContent');
            if (!container) {
                console.error('Page content container not found');
                return;
            }

            // Clear and set up the page
            container.innerHTML = '';
            container.appendChild(tabContainer);
            container.appendChild(contentContainer);

            // Set up event listeners
            this._setupEquipmentEventListeners();

            // Update the equipment display
            await this._updateEquipmentSections(sections);
        } catch (error) {
            console.error('Error initializing equipment page:', error);
        }
    }

    /**
     * Create the equipment section containers
     * @returns {Object} Object containing the three section DOM elements
     * @private
     */
    _createEquipmentSections() {
        const sections = {
            inventory: document.createElement('div'),
            equipped: document.createElement('div'),
            attuned: document.createElement('div')
        };

        sections.inventory.id = 'inventorySection';
        sections.equipped.id = 'equippedSection';
        sections.attuned.id = 'attunedSection';

        return sections;
    }

    /**
     * Create the tab container with tab buttons
     * @returns {HTMLElement} The tab container DOM element
     * @private
     */
    _createTabContainer() {
        const tabContainer = document.createElement('div');
        tabContainer.className = 'nav nav-tabs mb-3';
        tabContainer.innerHTML = `
            <button class="nav-link active" data-bs-toggle="tab" data-section="inventory">Inventory</button>
            <button class="nav-link" data-bs-toggle="tab" data-section="equipped">Equipped</button>
            <button class="nav-link" data-bs-toggle="tab" data-section="attuned">Attuned</button>
        `;
        return tabContainer;
    }

    /**
     * Create the content container and add sections to it
     * @param {Object} sections - The equipment section DOM elements
     * @returns {HTMLElement} The content container DOM element
     * @private
     */
    _createContentContainer(sections) {
        const contentContainer = document.createElement('div');
        contentContainer.className = 'tab-content';

        // Add sections to content container
        for (const section of Object.values(sections)) {
            section.className = 'equipment-grid tab-pane fade';
            contentContainer.appendChild(section);
        }
        sections.inventory.classList.add('show', 'active');

        return contentContainer;
    }

    //-------------------------------------------------------------------------
    // Equipment Display Methods
    //-------------------------------------------------------------------------

    /**
     * Update equipment sections with current character items
     * @param {Object} sections - Object containing the section DOM elements to update
     * @returns {Promise<void>}
     * @private
     */
    async _updateEquipmentSections(sections) {
        try {
            if (!this._character?.equipment) {
                console.warn('Character equipment not available');
                return;
            }

            // Update inventory section
            this._updateInventorySection(sections.inventory);

            // Update equipped section
            this._updateEquippedSection(sections.equipped);

            // Update attuned section
            this._updateAttunedSection(sections.attuned);
        } catch (error) {
            console.error('Error updating equipment sections:', error);
        }
    }

    /**
     * Update the inventory section with all character items
     * @param {HTMLElement} container - The inventory section container to update
     * @private
     */
    _updateInventorySection(container) {
        if (!container) return;

        container.innerHTML = '';
        const inventoryItems = this._character.equipment.getAllItems();
        for (const item of inventoryItems) {
            container.appendChild(new EntityCard(item).render());
        }
    }

    /**
     * Update the equipped section with equipped character items
     * @param {HTMLElement} container - The equipped section container to update
     * @private
     */
    _updateEquippedSection(container) {
        if (!container) return;

        container.innerHTML = '';
        const equippedItems = this._character.equipment.getEquippedItems();
        for (const item of equippedItems) {
            container.appendChild(new EntityCard(item).render());
        }
    }

    /**
     * Update the attuned section with attuned character items
     * @param {HTMLElement} container - The attuned section container to update
     * @private
     */
    _updateAttunedSection(container) {
        if (!container) return;

        container.innerHTML = '';
        const attunedItems = this._character.equipment.getAttunedItems();
        for (const item of attunedItems) {
            container.appendChild(new EntityCard(item).render());
        }
    }

    //-------------------------------------------------------------------------
    // Event Handling Methods
    //-------------------------------------------------------------------------

    /**
     * Set up equipment page event listeners
     * @private
     */
    _setupEquipmentEventListeners() {
        try {
            // Tab switching
            this._setupTabEventListeners();

            // Update UI after equipment changes
            this._setupEquipmentChangeObserver();
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Set up tab switching event listeners
     * @private
     */
    _setupTabEventListeners() {
        const tabs = document.querySelectorAll('.nav-link[data-section]');

        for (const tab of tabs) {
            tab.addEventListener('click', (e) => {
                // Remove active class from all tabs and sections
                for (const t of tabs) {
                    t.classList.remove('active');
                }
                for (const s of document.querySelectorAll('.tab-pane')) {
                    s.classList.remove('show', 'active');
                }

                // Add active class to clicked tab and its section
                const section = e.target.dataset.section;
                e.target.classList.add('active');
                document.getElementById(`${section}Section`).classList.add('show', 'active');
            });
        }
    }

    /**
     * Set up an observer to update the UI when equipment changes
     * @private
     */
    _setupEquipmentChangeObserver() {
        const observer = new MutationObserver(() => {
            const sections = {
                inventory: document.getElementById('inventorySection'),
                equipped: document.getElementById('equippedSection'),
                attuned: document.getElementById('attunedSection')
            };
            if (Object.values(sections).every(Boolean)) {
                this._updateEquipmentSections(sections);
            }
        });

        const pageContent = document.querySelector('#pageContent');
        if (pageContent) {
            observer.observe(pageContent, {
                childList: true,
                subtree: true
            });
        }
    }
} 