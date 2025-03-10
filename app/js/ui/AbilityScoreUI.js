export class AbilityScoreUI {
    constructor(character) {
        this.character = character;
        this.container = document.querySelector('.ability-score-container');
        this.bonusesContainer = document.getElementById('abilityBonusesNotes');
        this.abilityScores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        this.initialize();
    }

    initialize() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = this.abilityScores.map(ability => `
            <div class="ability-score-box" data-ability="${ability}">
                <h6>${ability.toUpperCase()}</h6>
                <div class="score">${this.character.getAbilityScore(ability) || 10}</div>
                <div class="modifier">${this.formatModifier(this.character.getAbilityScore(ability) || 10)}</div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-light me-1" data-action="decrease">-</button>
                    <button class="btn btn-sm btn-light" data-action="increase">+</button>
                </div>
                ${this.renderBonus(ability)}
            </div>
        `).join('');

        this.updateBonusesNotes();
    }

    renderBonus(ability) {
        const bonuses = this.character.abilityBonuses?.[ability] || [];
        if (!bonuses.length) return '';

        const totalBonus = bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
        const bonusClass = totalBonus >= 0 ? 'bonus' : 'bonus negative';
        return `<div class="${bonusClass}">${totalBonus >= 0 ? '+' : ''}${totalBonus}</div>`;
    }

    updateBonusesNotes() {
        if (!this.bonusesContainer) return;

        const bonusNotes = [];
        for (const ability of this.abilityScores) {
            const bonuses = this.character.abilityBonuses?.[ability] || [];
            if (bonuses.length) {
                bonusNotes.push(`<div class="bonus-note">
                    <strong>${ability.toUpperCase()}</strong>: ${bonuses.map(bonus =>
                    `${bonus.value >= 0 ? '+' : ''}${bonus.value} (${bonus.source})`
                ).join(', ')}
                </div>`);
            }
        }

        this.bonusesContainer.innerHTML = bonusNotes.length
            ? bonusNotes.join('')
            : '<div class="text-muted">No ability score bonuses applied.</div>';
    }

    setupEventListeners() {
        if (!this.container) return;

        this.container.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const abilityBox = button.closest('.ability-score-box');
            if (!abilityBox) return;

            const ability = abilityBox.dataset.ability;
            const action = button.dataset.action;

            if (action === 'increase') {
                this.increaseScore(ability);
            } else if (action === 'decrease') {
                this.decreaseScore(ability);
            }
        });
    }

    increaseScore(ability) {
        const currentScore = this.character.getAbilityScore(ability) || 10;
        if (currentScore < 20) {
            this.character.abilityScores = this.character.abilityScores || {};
            this.character.abilityScores[ability] = currentScore + 1;
            this.render();
            window.markUnsavedChanges();
        }
    }

    decreaseScore(ability) {
        const currentScore = this.character.getAbilityScore(ability) || 10;
        if (currentScore > 1) {
            this.character.abilityScores = this.character.abilityScores || {};
            this.character.abilityScores[ability] = currentScore - 1;
            this.render();
            window.markUnsavedChanges();
        }
    }

    formatModifier(score) {
        const modifier = Math.floor((score - 10) / 2);
        return modifier >= 0 ? `+${modifier}` : modifier.toString();
    }

    update() {
        this.render();
    }
} 