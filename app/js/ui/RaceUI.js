import { EntityCard } from './EntityCard.js';
import { RaceManager } from '../managers/RaceManager.js';
import { TextProcessor } from '../utils/TextProcessor.js';
import { showNotification } from '../utils/notifications.js';
import { characterInitializer } from '../utils/Initialize.js';

export class RaceUI {
    constructor(character) {
        this.character = character;
        this.raceManager = new RaceManager(character);
        this.textProcessor = characterInitializer.textProcessor;
        this.dataLoader = characterInitializer.dataLoader;

        // Add event listener for character changes
        document.addEventListener('characterLoaded', async () => {
            // Only refresh race list if we're on the build page
            if (document.body.getAttribute('data-current-page') === 'build') {
                await this.refreshRaceList();
            }
        });

        // Initialize when the DOM is ready and we're on the build page
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                if (document.body.getAttribute('data-current-page') === 'build') {
                    await this.initializeRaceSelection();
                }
            });
        } else {
            // DOM is already ready, initialize if on build page
            if (document.body.getAttribute('data-current-page') === 'build') {
                this.initializeRaceSelection();
            }
        }
    }

    /**
     * Initialize race selection
     */
    async initializeRaceSelection() {
        const raceSelect = document.getElementById('raceSelect');
        const subraceSelect = document.getElementById('subraceSelect');
        const raceDetails = document.getElementById('raceDetails');
        const raceQuickDesc = document.getElementById('raceQuickDesc');
        const raceImage = document.getElementById('raceImage');

        if (!raceSelect) {
            console.warn('Race select element not found on build page');
            return;
        }

        if (!raceDetails || !raceQuickDesc || !raceImage) {
            console.warn('Some race UI elements not found, but continuing with available elements');
        }

        // Initialize subrace select
        if (subraceSelect) {
            subraceSelect.disabled = true;
            subraceSelect.innerHTML = '<option value="">Select Race First</option>';
        }

        // Set initial placeholder content
        this.setRacePlaceholderContent();

        try {
            // Clear existing options
            raceSelect.innerHTML = '<option value="">Select a Race</option>';

            // Load and sort races
            const races = await this.dataLoader.loadRaces();
            races.sort((a, b) => a.name.localeCompare(b.name));

            // Add race options
            for (const race of races) {
                const option = document.createElement('option');
                option.value = race.id;
                const sourceDisplay = race.source === 'PHB' ? 'PHB\'14' :
                    race.source === 'XPHB' ? 'PHB\'24' :
                        race.source;
                option.textContent = `${race.name} (${sourceDisplay})`;
                raceSelect.appendChild(option);
            }

            // Set current race if one is selected
            if (this.character.race?.selectedRace) {
                raceSelect.value = this.character.race.selectedRace.id;
                await this.updateRaceDisplay(this.character.race.selectedRace.id);

                // Update subrace selection if applicable
                if (this.character.race.selectedSubrace) {
                    await this.updateSubraceSelect(this.character.race.selectedRace.id);
                    if (subraceSelect) {
                        subraceSelect.value = this.character.race.selectedSubrace.id;
                    }
                }
            }

            // Setup event listeners
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing race selection:', error);
            showNotification('Error loading races', 'error');
        }
    }

    /**
     * Refresh the race dropdown list
     */
    async refreshRaceList() {
        try {
            const raceSelect = document.getElementById('raceSelect');
            if (!raceSelect) {
                console.error('Race select element not found');
                return;
            }

            // Clear existing options
            raceSelect.innerHTML = '<option value="">Select a Race</option>';

            // Load and sort races
            const races = await this.dataLoader.loadRaces();
            races.sort((a, b) => a.name.localeCompare(b.name));

            // Add race options
            for (const race of races) {
                const option = document.createElement('option');
                option.value = race.id;
                const sourceDisplay = race.source === 'PHB' ? 'PHB\'14' :
                    race.source === 'XPHB' ? 'PHB\'24' :
                        race.source;
                option.textContent = `${race.name} (${sourceDisplay})`;
                raceSelect.appendChild(option);
            }

            // Set current race if one is selected
            if (this.character.race?.selectedRace) {
                raceSelect.value = this.character.race.selectedRace.id;
                await this.updateRaceDisplay(this.character.race.selectedRace.id);
            }
        } catch (error) {
            console.error('Error refreshing race list:', error);
            showNotification('Error loading races', 'danger');
        }
    }

    /**
     * Helper method to properly escape HTML content for tooltips
     */
    escapeHtml(html) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        return html.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
    }

    /**
     * Update race display
     */
    async updateRaceDisplay(raceId) {
        const raceDetails = document.getElementById('raceDetails');
        const raceQuickDesc = document.getElementById('raceQuickDesc');
        const raceImage = document.getElementById('raceImage');

        if (!raceDetails || !raceQuickDesc || !raceImage) {
            console.error('Required race UI elements not found for display update');
            return;
        }

        try {
            if (!raceId) {
                this.setRacePlaceholderContent();
                return;
            }

            const race = await this.raceManager.loadRace(raceId);
            if (!race) {
                console.error('Failed to load race details');
                this.setRacePlaceholderContent();
                return;
            }

            // Update quick description
            const quickDesc = this.getQuickDescription(race);
            raceQuickDesc.innerHTML = `
                <h6>Description</h6>
                <p>${quickDesc}</p>
            `;

            // Update race image
            if (race.imageUrl) {
                raceImage.innerHTML = `<img src="${race.imageUrl}" alt="${race.name}" class="race-image">`;
            } else {
                raceImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            }

            // Create race details in a standardized grid layout
            raceDetails.innerHTML = `
                <div class="race-details-grid">
                    <div class="detail-section">
                        <h6>Ability Score Increase</h6>
                        <ul class="mb-0">
                            ${this.formatAbilityScores(race.ability, race.source)}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Size</h6>
                        <ul class="mb-0">
                            <li>${Array.isArray(race.size) ? race.size.join(' or ') : race.size}</li>
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Speed</h6>
                        <ul class="mb-0">
                            ${this.formatSpeed(race.speed).split(', ').map(speed => `<li>${speed}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Languages</h6>
                        <ul class="mb-0">
                            ${race.source === 'XPHB' ?
                    `<li>Common</li>
                             <li>2 normal languages of your choice</li>` :
                    (race.languages?.length > 0 ?
                        race.languages.map(lang =>
                            `<li>${typeof lang === 'string' ? lang : Object.keys(lang)[0]}</li>`
                        ).join('') :
                        '<li class="placeholder-text">—</li>')}
                        </ul>
                    </div>
                </div>
                ${race.entries?.length > 0 ? `
                    <div class="detail-section traits-section mt-3">
                        <h6>Traits</h6>
                        <ul class="mb-0 traits-grid">
                            ${await Promise.all(race.entries
                            .filter(entry => entry.type === 'entries' && entry.name)
                            .map(async entry => {
                                const description = Array.isArray(entry.entries) ?
                                    entry.entries.join(' ') :
                                    entry.entries || '';
                                const processedDescription = await this.textProcessor.processText(description);
                                const encodedDescription = encodeURIComponent(processedDescription);
                                return `<li class="has-tooltip" data-tooltip="${encodedDescription}">${entry.name}</li>`;
                            })
                        ).then(results => results.join(''))}
                        </ul>
                    </div>` : ''}
            `;

            // Process tooltips for the newly added content
            const textToProcess = [raceQuickDesc, raceDetails];
            for (const element of textToProcess) {
                const textNodes = element.querySelectorAll('p, li:not(.has-tooltip)');
                for (const node of textNodes) {
                    const originalText = node.innerHTML;
                    const processedText = await this.textProcessor.processText(originalText);
                    node.innerHTML = processedText;
                }
            }

        } catch (error) {
            console.error('Error displaying race details:', error);
            showNotification('Error displaying race details', 'error');
        }
    }

    /**
     * Set placeholder content for race
     */
    setRacePlaceholderContent() {
        const raceImage = document.getElementById('raceImage');
        const raceQuickDesc = document.getElementById('raceQuickDesc');
        const raceDetails = document.getElementById('raceDetails');

        if (!raceImage || !raceQuickDesc || !raceDetails) return;

        // Set placeholder image
        raceImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';

        // Set placeholder quick description
        raceQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Race</h5>
                <p>Choose a race to see details about their traits, abilities, and other characteristics.</p>
            </div>`;

        // Set placeholder details
        raceDetails.innerHTML = `
            <div class="race-details-grid">
                <div class="detail-section">
                    <h6>Ability Score Increase</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Size</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Speed</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            </div>`;
    }

    /**
     * Check for and handle race ability score choices
     */
    checkRaceAbilityChoices() {
        if (!this.character.race.hasPendingChoices()) return;

        const choices = this.character.race.getPendingChoices();
        for (const [source, choice] of Object.entries(choices)) {
            this.showAbilityChoiceDialog(choice, source);
        }
    }

    /**
     * Show dialog for ability score choices
     */
    showAbilityChoiceDialog(choice, source) {
        // Create modal dynamically
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'abilityChoiceModal';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Choose Ability Scores</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Choose ${choice.count} abilities to increase by ${choice.amount}:</p>
                        <form id="abilityChoiceForm">
                            ${choice.from.map(ability => {
            const abilityMap = {
                'str': 'Strength',
                'dex': 'Dexterity',
                'con': 'Constitution',
                'int': 'Intelligence',
                'wis': 'Wisdom',
                'cha': 'Charisma'
            };
            const displayName = abilityMap[ability.toLowerCase()] || ability;
            return `
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" 
                                            name="ability" value="${ability}" id="ability_${ability}">
                                        <label class="form-check-label" for="ability_${ability}">
                                            ${displayName}
                                        </label>
                                    </div>
                                `;
        }).join('')}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="confirmAbilityChoices">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>`;

        // Add modal to document
        document.body.appendChild(modal);

        // Initialize Bootstrap modal
        const modalInstance = new bootstrap.Modal(modal);

        // Handle form submission
        const form = modal.querySelector('#abilityChoiceForm');
        const confirmBtn = modal.querySelector('#confirmAbilityChoices');

        confirmBtn.addEventListener('click', () => {
            const selected = Array.from(form.querySelectorAll('input:checked'))
                .map(input => input.value);

            if (selected.length !== choice.count) {
                showNotification(
                    `Please select exactly ${choice.count} abilities`,
                    'warning'
                );
                return;
            }

            // Create choices object
            const choices = {};
            const abilityMap = {
                'str': 'strength',
                'dex': 'dexterity',
                'con': 'constitution',
                'int': 'intelligence',
                'wis': 'wisdom',
                'cha': 'charisma'
            };

            for (const ability of selected) {
                const fullAbilityName = abilityMap[ability.toLowerCase()] || ability.toLowerCase();
                choices[fullAbilityName] = choice.amount;
            }

            // Apply choices
            if (this.character.race.applyAbilityChoices(choices, source)) {
                modalInstance.hide();
                modal.addEventListener('hidden.bs.modal', () => {
                    modal.remove();
                    // Update ability score card
                    const abilityScoreUI = new AbilityScoreUI(this.character);
                    abilityScoreUI.update();
                });
            }
        });

        // Show modal
        modalInstance.show();
    }

    // Helper methods for formatting race details
    getQuickDescription(race) {
        // First try to get description from fluff data
        if (race.fluff?.entries) {
            // Navigate through the nested structure
            const fluffEntry = race.fluff.entries[0];
            if (fluffEntry?.type === 'entries' && fluffEntry.entries) {
                const innerEntry = fluffEntry.entries[0];
                if (innerEntry?.type === 'entries' && Array.isArray(innerEntry.entries)) {
                    return innerEntry.entries.join(' ');
                }
            }
        }

        // Fallback to entries if no fluff is available
        if (race.entries) {
            // First look for an entry without a name that's either a string or has entries
            const desc = race.entries.find(entry =>
                (typeof entry === 'string') ||
                (typeof entry === 'object' && !entry.name && entry.entries)
            );

            if (desc) {
                if (typeof desc === 'string') {
                    return desc;
                } if (Array.isArray(desc.entries)) {
                    // If it's an array of entries, join them with spaces
                    return desc.entries.join(' ');
                } if (typeof desc.entries === 'string') {
                    return desc.entries;
                }
            }

            // If no unnamed entry is found, look for one with a type of 'entries' and a name
            const typedDesc = race.entries.find(entry =>
                entry.type === 'entries' && entry.name && entry.name.toLowerCase() === 'description'
            );

            if (typedDesc?.entries) {
                if (Array.isArray(typedDesc.entries)) {
                    return typedDesc.entries.join(' ');
                }
                return typedDesc.entries;
            }

            // If still no description found, use the first entry with actual content
            for (const entry of race.entries) {
                if (typeof entry === 'string' && entry.trim()) {
                    return entry;
                } if (entry.entries && Array.isArray(entry.entries) && entry.entries.length > 0) {
                    return entry.entries[0];
                }
            }
        }

        // Fallback to a generic description
        return `${race.name} racial traits and abilities.`;
    }

    /**
     * Format ability scores for display
     */
    formatAbilityScores(ability, source) {
        // Handle PHB Human's implicit +1 to all abilities
        if ((!ability || ability.length === 0) && source === 'PHB') {
            return '<li>+1 to all ability scores</li>';
        }

        if (!ability || !Array.isArray(ability)) {
            return '<li class="placeholder-text">—</li>';
        }

        const formatBonus = (amount) => amount >= 0 ? `+${amount}` : amount;

        const scores = ability.map(score => {
            // Handle ability score choices
            if (typeof score === 'object') {
                if (score.choose) {
                    const count = score.choose.count || 1;
                    const from = score.choose.from || [];
                    const amount = score.choose.amount || 1;
                    return `<li>Choose ${count} from: ${from.map(a => a.toUpperCase()).join(', ')} (${formatBonus(amount)})</li>`;
                } if (score.mode === 'choose') {
                    return `<li>Choose ${score.count} from: ${score.from.map(a => a.toUpperCase()).join(', ')} (${formatBonus(score.amount)})</li>`;
                } if (score.mode === 'fixed') {
                    return score.scores.map(ability =>
                        `<li>${ability.toUpperCase()} ${formatBonus(score.amount)}</li>`
                    ).join('');
                }
                // Handle direct ability score bonuses
                const entries = Object.entries(score)
                    .filter(([key, value]) => key !== 'choose' && typeof value === 'number')
                    .map(([key, value]) => `<li>${key.toUpperCase()} ${formatBonus(value)}</li>`);
                return entries.join('');
            } if (typeof score === 'string') {
                // Handle simple string entries (like "choose any")
                return `<li>${score}</li>`;
            }
            return '';
        }).filter(score => score); // Remove empty entries

        return scores.length > 0 ? scores.join('') : '<li class="placeholder-text">—</li>';
    }

    /**
     * Format speed for display
     */
    formatSpeed(speed) {
        if (typeof speed === 'number') return `${speed} feet`;
        if (typeof speed === 'object') {
            return Object.entries(speed)
                .map(([type, value]) => {
                    const speedValue = typeof value === 'number' ? value : value.number;
                    return `${type === 'walk' ? '' : `${type} `}${speedValue} feet`;
                })
                .join(', ');
        }
        return '30 feet';
    }

    /**
     * Update subrace select options based on selected race
     */
    async updateSubraceSelect(raceId) {
        const subraceSelect = document.getElementById('subraceSelect');
        if (!subraceSelect) return;

        try {
            const subraces = await this.raceManager.getAvailableSubraces(raceId);

            if (subraces.length > 0) {
                subraceSelect.disabled = false;
                subraceSelect.innerHTML = '<option value="">Select a Subrace</option>';

                for (const subrace of subraces) {
                    const option = document.createElement('option');
                    option.value = subrace.id;
                    option.textContent = subrace.name;
                    subraceSelect.appendChild(option);
                }
            } else {
                subraceSelect.disabled = true;
                subraceSelect.innerHTML = '<option value="">No Subraces Available</option>';
            }
        } catch (error) {
            console.error('Error updating subrace select:', error);
            subraceSelect.disabled = true;
            subraceSelect.innerHTML = '<option value="">Error Loading Subraces</option>';
        }
    }

    setupEventListeners() {
        const raceSelect = document.getElementById('raceSelect');
        const subraceSelect = document.getElementById('subraceSelect');

        if (!raceSelect) {
            console.error('Race selection element not found');
            return;
        }

        // Handle race selection
        raceSelect.addEventListener('change', async () => {
            const raceId = raceSelect.value;

            if (!raceId) {
                // Clear race selection and show skeleton preview
                await this.raceManager.setRace(null);
                this.setRacePlaceholderContent();
                if (subraceSelect) {
                    subraceSelect.disabled = true;
                    subraceSelect.innerHTML = '<option value="">Select Race First</option>';
                }
                return;
            }

            try {
                // Get selected race using RaceManager
                const race = await this.raceManager.loadRace(raceId);
                if (!race) {
                    this.setRacePlaceholderContent();
                    return;
                }

                // Update subrace select
                await this.updateSubraceSelect(raceId);

                // Set race without subrace initially
                await this.raceManager.setRace(raceId);
                await this.updateRaceDisplay(raceId);

                // Show ability score choices if any
                this.checkRaceAbilityChoices();
            } catch (error) {
                console.error('Error handling race selection:', error);
                showNotification('Error updating race details', 'error');
            }
        });

        // Handle subrace selection
        if (subraceSelect) {
            subraceSelect.addEventListener('change', async () => {
                const raceId = raceSelect.value;
                const subraceId = subraceSelect.value;

                if (!raceId) return;

                try {
                    await this.raceManager.setRace(raceId, subraceId);
                    await this.updateRaceDisplay(raceId, subraceId);
                    this.checkRaceAbilityChoices();
                } catch (error) {
                    console.error('Error handling subrace selection:', error);
                    showNotification('Error updating subrace details', 'error');
                }
            });
        }
    }
} 