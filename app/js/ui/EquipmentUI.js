import { EntityCard } from './EntityCard.js';

export class EquipmentUI {
    constructor(character) {
        this.character = character;
    }

    // Initialize equipment page
    async initializeEquipmentPage() {
        if (!this.character) return;

        // Initialize equipment sections
        const sections = {
            inventory: document.createElement('div'),
            equipped: document.createElement('div'),
            attuned: document.createElement('div')
        };

        sections.inventory.id = 'inventorySection';
        sections.equipped.id = 'equippedSection';
        sections.attuned.id = 'attunedSection';

        // Create tabs for different sections
        const tabContainer = document.createElement('div');
        tabContainer.className = 'nav nav-tabs mb-3';
        tabContainer.innerHTML = `
            <button class="nav-link active" data-bs-toggle="tab" data-section="inventory">Inventory</button>
            <button class="nav-link" data-bs-toggle="tab" data-section="equipped">Equipped</button>
            <button class="nav-link" data-bs-toggle="tab" data-section="attuned">Attuned</button>
        `;

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'tab-content';

        // Add sections to content container
        for (const section of Object.values(sections)) {
            section.className = 'equipment-grid tab-pane fade';
            contentContainer.appendChild(section);
        }
        sections.inventory.classList.add('show', 'active');

        // Get the equipment page container
        const container = document.querySelector('#pageContent');
        if (!container) return;

        // Clear and set up the page
        container.innerHTML = '';
        container.appendChild(tabContainer);
        container.appendChild(contentContainer);

        // Set up event listeners
        this.setupEquipmentEventListeners();

        // Update the equipment display
        await this.updateEquipmentSections(sections);
    }

    // Update equipment sections with current items
    async updateEquipmentSections(sections) {
        if (!this.character?.equipment) return;

        // Update inventory section
        sections.inventory.innerHTML = '';
        const inventoryItems = this.character.equipment.getAllItems();
        for (const item of inventoryItems) {
            sections.inventory.appendChild(new EntityCard(item).render());
        }

        // Update equipped section
        sections.equipped.innerHTML = '';
        const equippedItems = this.character.equipment.getEquippedItems();
        for (const item of equippedItems) {
            sections.equipped.appendChild(new EntityCard(item).render());
        }

        // Update attuned section
        sections.attuned.innerHTML = '';
        const attunedItems = this.character.equipment.getAttunedItems();
        for (const item of attunedItems) {
            sections.attuned.appendChild(new EntityCard(item).render());
        }
    }

    // Set up equipment page event listeners
    setupEquipmentEventListeners() {
        // Tab switching
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

        // Update UI after equipment changes
        const observer = new MutationObserver(() => {
            const sections = {
                inventory: document.getElementById('inventorySection'),
                equipped: document.getElementById('equippedSection'),
                attuned: document.getElementById('attunedSection')
            };
            if (Object.values(sections).every(Boolean)) {
                this.updateEquipmentSections(sections);
            }
        });

        observer.observe(document.querySelector('#pageContent'), {
            childList: true,
            subtree: true
        });
    }
} 