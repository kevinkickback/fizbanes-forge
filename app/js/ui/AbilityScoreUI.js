export class AbilityScoreUI {
    constructor(character) {
        this.character = character;
        this.container = document.querySelector('.ability-score-container');
        this.bonusesContainer = document.getElementById('abilityBonusesNotes');
        this.abilityScores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        this.abilityChoices = new Map(); // Store current ability choices
        this.initialize();
    }

    initialize() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        if (!this.container) {
            return; // Silently return if container is not found (expected on pages without ability scores)
        }

        let content = '';

        // Add ability score boxes first
        content += '<div class="ability-score-grid">';
        content += this.abilityScores.map(ability => {
            const score = this.character.getAbilityScore(ability);
            return `
                <div class="ability-score-box" data-ability="${ability}">
                    <h6>${ability.toUpperCase()}</h6>
                    <div class="score">${score}</div>
                    <div class="modifier">${this.formatModifier(score)}</div>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-light me-1" data-action="decrease">-</button>
                        <button class="btn btn-sm btn-light" data-action="increase">+</button>
                    </div>
                    ${this.renderBonus(ability)}
                </div>
            `;
        }).join('');
        content += '</div>';

        // Add ability choices if any
        const pendingChoices = this.character.getPendingAbilityChoices()
            .filter(choice => choice.type === 'ability');

        if (pendingChoices.length > 0) {
            content += '<div class="ability-choices">';
            for (const [index, choice] of pendingChoices.entries()) {
                const availableAbilities = this.getAvailableAbilities(index);
                const selectedAbility = this.abilityChoices.get(index);

                content += `
                    <div class="ability-choice-group">
                        <label class="form-label">+${choice.amount} bonus (${choice.source} ${index + 1})</label>
                        <select class="form-select form-select-sm ability-choice-select" data-choice-index="${index}" data-bonus="${choice.amount}" data-source="${choice.source}">
                            <option value="">Choose...</option>
                            ${availableAbilities.map(ability => `
                                <option value="${ability}" ${selectedAbility === ability ? 'selected' : ''}>
                                    ${ability.charAt(0).toUpperCase() + ability.slice(1)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            }
            content += '</div>';
        }

        this.container.innerHTML = content;

        // Add event listeners to new dropdowns
        const dropdowns = this.container.querySelectorAll('.ability-choice-select');
        for (const dropdown of dropdowns) {
            dropdown.addEventListener('change', (e) => this.handleAbilityChoice(e));
        }

        // Handle bonuses container content
        if (this.bonusesContainer) {
            let bonusContent = '';

            // Create bonus notes
            const sourceMap = new Map();
            for (const ability of this.abilityScores) {
                const bonuses = this.character.abilityBonuses?.[ability] || [];
                if (bonuses.length) {
                    for (const bonus of bonuses) {
                        if (!sourceMap.has(bonus.source)) {
                            sourceMap.set(bonus.source, []);
                        }
                        sourceMap.get(bonus.source).push({
                            ability: ability,
                            value: bonus.value
                        });
                    }
                }
            }

            // Group race-related bonuses
            const raceSourcePrefixes = ['Race', 'Race Choice', 'Subrace'];
            const groupedSourceMap = new Map();

            for (const [source, bonusList] of sourceMap) {
                if (raceSourcePrefixes.some(prefix => source.startsWith(prefix))) {
                    if (!groupedSourceMap.has('Race')) {
                        groupedSourceMap.set('Race', []);
                    }
                    groupedSourceMap.get('Race').push(...bonusList.map(b => ({
                        ...b,
                        isChoice: source.includes('Choice')
                    })));
                } else {
                    groupedSourceMap.set(source, bonusList);
                }
            }

            // Create bonus notes
            if (groupedSourceMap.size > 0) {
                bonusContent += '<h6 class="mb-2">Ability Score Bonuses</h6>';
                for (const [source, bonusList] of groupedSourceMap) {
                    if (source === 'Race') {
                        const fixedBonuses = bonusList.filter(b => !b.isChoice);
                        const choiceBonuses = bonusList.filter(b => b.isChoice);

                        const fixedText = fixedBonuses.map(b =>
                            `${b.value >= 0 ? '+' : ''}${b.value} ${b.ability.toUpperCase()}`
                        ).join(', ');

                        const choiceText = choiceBonuses.map(b =>
                            `${b.value >= 0 ? '+' : ''}${b.value} ${b.ability.toUpperCase()} (selected)`
                        ).join(', ');

                        const allBonusText = [fixedText, choiceText].filter(Boolean).join(', ');

                        if (allBonusText) {
                            bonusContent += `<div class="bonus-note">
                                <strong>${source}</strong>: ${allBonusText}
                            </div>`;
                        }
                    } else {
                        const bonusText = bonusList.map(b =>
                            `${b.value >= 0 ? '+' : ''}${b.value} ${b.ability.toUpperCase()}`
                        ).join(', ');
                        bonusContent += `<div class="bonus-note">
                            <strong>${source}</strong>: ${bonusText}
                        </div>`;
                    }
                }
            } else {
                bonusContent += '<div class="text-muted">No ability score bonuses applied.</div>';
            }

            this.bonusesContainer.innerHTML = bonusContent;
        }
    }

    getAvailableAbilities(currentChoiceIndex) {
        const allAbilities = [...this.abilityScores];
        const selectedAbilities = new Set();

        // Collect all selected abilities except the current one
        for (const [index, ability] of this.abilityChoices.entries()) {
            if (index !== currentChoiceIndex && ability) {
                selectedAbilities.add(ability);
            }
        }

        // Get abilities that already have racial bonuses
        const abilitiesWithRacialBonuses = new Set();
        for (const ability of this.abilityScores) {
            const bonuses = this.character.abilityBonuses?.[ability] || [];
            for (const bonus of bonuses) {
                // Check if the bonus is from a racial source (Race, Subrace, but not Race Choice)
                if ((bonus.source === 'Race' || bonus.source === 'Subrace') && !bonus.source.includes('Choice')) {
                    abilitiesWithRacialBonuses.add(ability);
                }
            }
        }

        // Return abilities that:
        // 1. Haven't been selected by other choices
        // 2. Don't already have racial bonuses
        return allAbilities.filter(ability =>
            !selectedAbilities.has(ability) &&
            !abilitiesWithRacialBonuses.has(ability)
        );
    }

    handleAbilityChoice(event) {
        const select = event.target;
        const choiceIndex = Number.parseInt(select.dataset.choiceIndex, 10);
        const bonus = Number.parseInt(select.dataset.bonus, 10);
        const source = select.dataset.source;
        const selectedAbility = select.value;
        const previousAbility = this.abilityChoices.get(choiceIndex);

        // Clear the specific choice's bonus
        this.character.clearAbilityBonuses(source);

        // Update stored choices
        if (selectedAbility) {
            this.abilityChoices.set(choiceIndex, selectedAbility);
            this.character.addAbilityBonus(selectedAbility, bonus, source);
        } else {
            this.abilityChoices.delete(choiceIndex);
        }

        // Re-render the UI to update other dropdowns' available options
        this.render();
    }

    applyAbilityChoices() {
        // Clear previous choice-based bonuses
        this.character.clearAbilityBonuses('Half-Elf Choice');
        this.character.clearAbilityBonuses('Race Choice');

        // Apply current choices
        for (const [index, ability] of this.abilityChoices.entries()) {
            if (ability) {
                const select = this.container.querySelector(`[data-choice-index="${index}"]`);
                const bonus = Number.parseInt(select.dataset.bonus, 10);
                const source = select.dataset.source;
                this.character.addAbilityBonus(ability, bonus, source);
            }
        }
    }

    renderBonus(ability) {
        const bonuses = this.character.abilityBonuses?.[ability] || [];
        if (!bonuses.length) return '';

        const totalBonus = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const bonusClass = totalBonus >= 0 ? 'bonus' : 'bonus negative';
        return `<div class="${bonusClass}">${totalBonus >= 0 ? '+' : ''}${totalBonus}</div>`;
    }

    formatModifier(score) {
        const modifier = Math.floor((score - 10) / 2);
        return modifier >= 0 ? `+${modifier}` : `${modifier}`;
    }

    setupEventListeners() {
        if (!this.container) return;

        this.container.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const abilityBox = button.closest('.ability-score-box');
            if (!abilityBox) return;

            const ability = abilityBox.dataset.ability;
            const baseScore = this.character.abilityScores[ability] || 10;

            if (action === 'increase') {
                // Base score cannot exceed 20
                if (baseScore < 20) {
                    this.character.abilityScores[ability] = baseScore + 1;
                    this.render();
                }
            } else if (action === 'decrease') {
                // Base score cannot go below 3
                if (baseScore > 3) {
                    this.character.abilityScores[ability] = baseScore - 1;
                    this.render();
                }
            }
        });
    }

    update() {
        this.render();
    }
} 