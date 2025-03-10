import { EntityCard } from './EntityCard.js';

export class RaceUI {
    constructor(character) {
        this.character = character;
    }

    /**
     * Initialize race selection
     */
    async initializeRaceSelection() {
        const raceSelect = document.getElementById('raceSelect');
        const subraceSelect = document.getElementById('subraceSelect');

        if (!raceSelect || !subraceSelect) return;

        try {
            // Load races using RaceManager
            const races = await this.character.race.getAvailableRaces();

            // Populate race select
            raceSelect.innerHTML = `
                <option value="">Choose a race...</option>
                ${races.map(race => `
                    <option value="${race.id}">${race.name}</option>
                `).join('')}
            `;

            // Show initial skeleton preview if no race is selected
            if (!this.character.race.selectedRace) {
                this.setRacePlaceholderContent();
            }

            // Handle race selection
            raceSelect.addEventListener('change', async () => {
                const raceId = raceSelect.value;

                // Clear and disable subrace selection by default
                subraceSelect.innerHTML = '<option value="">Choose a subrace...</option>';
                subraceSelect.disabled = true;

                if (!raceId) {
                    // Clear race selection and show skeleton preview
                    await this.character.race.setRace(null);
                    this.setRacePlaceholderContent();
                    return;
                }

                // Get selected race using RaceManager
                const race = await this.character.race.loadRace(raceId);
                if (!race) {
                    this.setRacePlaceholderContent();
                    return;
                }

                // Update subrace options if available
                const subraces = await this.character.race.getAvailableSubraces(raceId);
                if (subraces && subraces.length > 0) {
                    subraceSelect.innerHTML = `
                        <option value="">Choose a subrace...</option>
                        ${subraces.map(subrace => `
                            <option value="${subrace.id}">${subrace.name}</option>
                        `).join('')}
                    `;
                    subraceSelect.disabled = false;
                } else {
                    // If no subraces, set a "None" option and keep disabled
                    subraceSelect.innerHTML = '<option value="">No subraces available</option>';
                    subraceSelect.disabled = true;
                }

                // Set race without subrace initially
                await this.character.race.setRace(raceId);
                this.updateRaceDisplay();

                // Show ability score choices if any
                this.checkRaceAbilityChoices();
            });

            // Handle subrace selection
            subraceSelect.addEventListener('change', async () => {
                const raceId = raceSelect.value;
                const subraceId = subraceSelect.value;

                if (!raceId) {
                    this.setRacePlaceholderContent();
                    return;
                }

                // Set race with subrace
                await this.character.race.setRace(raceId, subraceId);
                this.updateRaceDisplay();

                // Show ability score choices if any
                this.checkRaceAbilityChoices();
            });

            // Initialize with current race if any
            if (this.character.race && this.character.race.selectedRace) {
                const race = await this.character.race.loadRace(this.character.race.selectedRace.id);
                if (race) {
                    raceSelect.value = race.id;

                    const subraces = await this.character.race.getAvailableSubraces(race.id);
                    if (subraces.length > 0) {
                        subraceSelect.innerHTML = `
                            <option value="">Choose a subrace...</option>
                            ${subraces.map(subrace => `
                                <option value="${subrace.id}">${subrace.name}</option>
                            `).join('')}
                        `;
                        subraceSelect.disabled = false;

                        if (this.character.race.selectedSubrace) {
                            subraceSelect.value = this.character.race.selectedSubrace.id;
                        }
                    }
                    this.updateRaceDisplay();
                } else {
                    this.setRacePlaceholderContent();
                }
            } else {
                this.setRacePlaceholderContent();
            }
        } catch (error) {
            console.error('Error initializing race selection:', error);
            window.showNotification('Error loading races', 'danger');
            this.setRacePlaceholderContent();
        }
    }

    /**
     * Update race display
     */
    async updateRaceDisplay() {
        const raceDetails = document.getElementById('raceDetails');
        const raceQuickDesc = document.getElementById('raceQuickDesc');
        const raceImage = document.getElementById('raceImage');

        if (!raceDetails || !raceQuickDesc || !raceImage) return;

        try {
            if (!this.character.race || !this.character.race.selectedRace) {
                this.setRacePlaceholderContent();
                return;
            }

            const race = this.character.race.selectedRace;

            // Update quick description
            raceQuickDesc.innerHTML = `
                <h6>Quick Info</h6>
                <p>${this.getQuickDescription(race)}</p>
            `;

            // Update race image
            if (race.imageUrl) {
                raceImage.innerHTML = `<img src="${race.imageUrl}" alt="${race.name}" class="race-image">`;
            } else {
                raceImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            }

            // Create race details
            let detailsHtml = '';

            // Add size and speed info
            detailsHtml += `
                <div class="detail-section">
                    <h6>Basic Traits</h6>
                    <ul>
                        <li><strong>Size:</strong> ${Array.isArray(race.size) ? race.size[0] : race.size}</li>
                        <li><strong>Speed:</strong> ${this.formatSpeed(race.speed)}</li>
                        ${race.darkvision ? `<li><strong>Darkvision:</strong> ${race.darkvision} feet</li>` : ''}
                    </ul>
                </div>
            `;

            // Add ability score increases
            if (race.ability && race.ability.length > 0) {
                detailsHtml += `
                    <div class="detail-section">
                        <h6>Ability Score Increase</h6>
                        ${this.formatAbilityScores(race.ability)}
                    </div>
                `;
            }

            // Add racial traits
            if (race.entries && race.entries.length > 0) {
                detailsHtml += `
                    <div class="detail-section">
                        <h6>Racial Traits</h6>
                        ${this.formatEntries(race.entries)}
                    </div>
                `;
            }

            // Add languages
            if (race.languageProficiencies && race.languageProficiencies.length > 0) {
                detailsHtml += `
                    <div class="detail-section">
                        <h6>Languages</h6>
                        ${this.formatLanguages(race.languageProficiencies)}
                    </div>
                `;
            }

            raceDetails.innerHTML = detailsHtml;

            // Show subrace details if selected
            if (this.character.race.selectedSubrace) {
                const subrace = this.character.race.selectedSubrace;
                let subraceHtml = `
                    <div class="detail-section subrace-section">
                        <h6>${subrace.name} Traits</h6>
                `;

                // Add subrace ability scores
                if (subrace.ability && subrace.ability.length > 0) {
                    subraceHtml += this.formatAbilityScores(subrace.ability);
                }

                // Add subrace traits
                if (subrace.entries && subrace.entries.length > 0) {
                    subraceHtml += this.formatEntries(subrace.entries);
                }

                subraceHtml += '</div>';
                raceDetails.innerHTML += subraceHtml;
            }

            // Process tooltips for the newly added content
            const textToProcess = [raceQuickDesc, raceDetails];
            for (const element of textToProcess) {
                const textNodes = element.querySelectorAll('p, li');
                for (const node of textNodes) {
                    const originalText = node.innerHTML;
                    const processedText = await window.dndTextProcessor.processText(originalText);
                    node.innerHTML = processedText;
                }
            }

        } catch (error) {
            console.error('Error updating race display:', error);
            window.showNotification('Error displaying race details', 'danger');
            this.setRacePlaceholderContent();
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
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Size</h6>
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Speed</h6>
                    <p class="placeholder-text">—</p>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Traits</h6>
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
                            ${choice.from.map(ability => `
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" 
                                        name="ability" value="${ability}" id="ability_${ability}">
                                    <label class="form-check-label" for="ability_${ability}">
                                        ${ability}
                                    </label>
                                </div>
                            `).join('')}
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
                window.showNotification(
                    `Please select exactly ${choice.count} abilities`,
                    'warning'
                );
                return;
            }

            // Create choices object
            const choices = {};
            for (const ability of selected) {
                choices[ability] = choice.amount;
            }

            // Apply choices
            if (this.character.race.applyAbilityChoices(choices, source)) {
                modalInstance.hide();
                modal.addEventListener('hidden.bs.modal', () => {
                    modal.remove();
                });
            }
        });

        // Show modal
        modalInstance.show();
    }

    // Helper methods for formatting race details
    getQuickDescription(race) {
        // Try to find a description in the entries
        if (race.entries) {
            // First look for an entry without a name that's either a string or has entries
            const desc = race.entries.find(entry =>
                (typeof entry === 'string') ||
                (typeof entry === 'object' && !entry.name && entry.entries)
            );

            if (desc) {
                if (typeof desc === 'string') {
                    return desc;
                } else if (Array.isArray(desc.entries)) {
                    // If it's an array of entries, join them with spaces
                    return desc.entries.join(' ');
                } else if (typeof desc.entries === 'string') {
                    return desc.entries;
                }
            }

            // If no unnamed entry is found, look for one with a type of 'entries' and a name
            const typedDesc = race.entries.find(entry =>
                entry.type === 'entries' && entry.name && entry.name.toLowerCase() === 'description'
            );

            if (typedDesc && typedDesc.entries) {
                if (Array.isArray(typedDesc.entries)) {
                    return typedDesc.entries.join(' ');
                } else {
                    return typedDesc.entries;
                }
            }

            // If still no description found, use the first entry with actual content
            for (const entry of race.entries) {
                if (typeof entry === 'string' && entry.trim()) {
                    return entry;
                } else if (entry.entries && Array.isArray(entry.entries) && entry.entries.length > 0) {
                    return entry.entries[0];
                }
            }
        }

        // Fallback to a generic description
        return `${race.name} racial traits and abilities.`;
    }

    formatSpeed(speed) {
        if (typeof speed === 'number') return `${speed} feet`;
        if (typeof speed === 'object') {
            return Object.entries(speed)
                .map(([type, value]) => `${type} ${value} feet`)
                .join(', ');
        }
        return '30 feet';
    }

    formatAbilityScores(abilities) {
        let html = '<ul>';
        for (const ability of abilities) {
            if (ability.mode === 'fixed') {
                html += `<li>${ability.scores.join(', ')} +${ability.amount}</li>`;
            } else if (ability.mode === 'choose') {
                html += `<li>Choose ${ability.count} from ${ability.from.join(', ')}: +${ability.amount}</li>`;
            } else {
                // Handle old format
                for (const [abil, amount] of Object.entries(ability)) {
                    if (abil !== 'choose' && typeof amount === 'number') {
                        html += `<li>${abil.toUpperCase()} +${amount}</li>`;
                    }
                }
            }
        }
        return html + '</ul>';
    }

    formatEntries(entries) {
        let html = '<ul>';
        for (const entry of entries) {
            if (typeof entry === 'string') {
                html += `<li>${entry}</li>`;
            } else if (typeof entry === 'object') {
                if (entry.name) {
                    html += `<li><strong>${entry.name}.</strong> `;
                    if (Array.isArray(entry.entries)) {
                        html += entry.entries.join(' ');
                    } else {
                        html += entry.entries;
                    }
                    html += '</li>';
                } else if (Array.isArray(entry.entries)) {
                    html += `<li>${entry.entries.join(' ')}</li>`;
                }
            }
        }
        return html + '</ul>';
    }

    formatLanguages(languages) {
        let html = '<ul>';
        for (const lang of languages) {
            if (typeof lang === 'string') {
                html += `<li>${lang.charAt(0).toUpperCase() + lang.slice(1)}</li>`;
            } else if (typeof lang === 'object') {
                for (const [name, hasProf] of Object.entries(lang)) {
                    if (hasProf === true) {
                        html += `<li>${name.charAt(0).toUpperCase() + name.slice(1)}</li>`;
                    }
                }
            }
        }
        return html + '</ul>';
    }
} 