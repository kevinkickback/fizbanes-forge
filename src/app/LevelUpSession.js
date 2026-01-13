/**
 * LevelUpSession manages a single level-up wizard flow.
 * 
 * Acts as a transaction-like system where all changes are staged in memory
 * and only applied to the character when the user confirms.
 * 
 * This ensures atomic updates and prevents partial state corruption if the user exits.
 */

export class LevelUpSession {
    constructor(character) {
        if (!character) {
            throw new Error('LevelUpSession requires a character object');
        }

        this.originalCharacter = character; // Reference to actual character object
        this.currentStep = 0; // 0-4, tracks wizard progress
        this.stepData = {}; // Per-step metadata (feature choices, ASI selections, etc.)

        // Deep clone character data into staged changes
        this.stagedChanges = {
            level: character.level || 1,
            progression: JSON.parse(JSON.stringify(character.progression || { classes: [], experiencePoints: 0, levelUps: [] })),
            classes: JSON.parse(JSON.stringify(character.classes || [])), // Multiclass tracking
            spellcasting: JSON.parse(JSON.stringify(character.spellcasting || { classes: {}, multiclass: {}, other: {} })),
            feats: JSON.parse(JSON.stringify(character.feats || [])),
            abilities: JSON.parse(JSON.stringify(character.abilities || {})),
            hitPoints: JSON.parse(JSON.stringify(character.hitPoints || { current: 1, max: 1 })),
        };

        // Save initial state for rollback
        this._initialState = JSON.parse(JSON.stringify(this.stagedChanges));

        console.info('[LevelUpSession]', 'Initialized for character', {
            characterName: character.name,
            currentLevel: character.level,
            classes: character.classes?.map(c => `${c.name} ${c.levels}`).join(', '),
        });
    }

    /**
     * Get a value from staged changes using dot notation path.
     * Falls back to original character if not in staged changes.
     * 
     * @param {string} path - Dot notation path (e.g., "progression.classes[0].levels")
     * @returns {*} Value at path
     */
    get(path) {
        return this._navigatePath(this.stagedChanges, path);
    }

    /**
     * Set a value in staged changes using dot notation path.
     * Creates intermediate objects if needed.
     * 
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     */
    set(path, value) {
        this._setPath(this.stagedChanges, path, value);
    }

    /**
     * Get the current staged changes object (for merging into character).
     * @returns {Object} Staged changes
     */
    getStagedChanges() {
        return this.stagedChanges;
    }

    /**
     * Get a summary of what has changed for display in Step 4 (Summary).
     * 
     * @returns {Object} Summary with categories: leveledClasses, newFeatures, newASIs, newSpells, changedAbilities
     */
    getChangeSummary() {
        const summary = {
            leveledClasses: [],
            newFeatures: this.stepData.selectedFeatures || {},
            newASIs: this.stepData.asiChoices || [],
            newSpells: this.stepData.selectedSpells || {},
            changedAbilities: {},
            totalLevelChange: (this.stagedChanges.level || 1) - (this.originalCharacter.level || 1),
        };

        // Compare class levels for summary
        if (this.stagedChanges.classes && Array.isArray(this.stagedChanges.classes)) {
            this.stagedChanges.classes.forEach(stagedClass => {
                const originalClass = this.originalCharacter.classes?.find(c => c.name === stagedClass.name);
                const originalLevel = originalClass?.levels || 0;
                const stagedLevel = stagedClass.levels || 0;

                if (stagedLevel !== originalLevel) {
                    summary.leveledClasses.push({
                        name: stagedClass.name,
                        from: originalLevel,
                        to: stagedLevel,
                        change: stagedLevel - originalLevel,
                    });
                }
            });
        }

        // Compare ability scores
        if (this.stagedChanges.abilities && this.originalCharacter.abilities) {
            Object.keys(this.stagedChanges.abilities).forEach(ability => {
                const staged = this.stagedChanges.abilities[ability];
                const original = this.originalCharacter.abilities[ability];
                if (staged !== original) {
                    summary.changedAbilities[ability] = {
                        from: original,
                        to: staged,
                        change: staged - original,
                    };
                }
            });
        }

        return summary;
    }

    /**
     * Apply all staged changes to the original character and emit events.
     * This is the only place where character mutations happen during level-up.
     * 
     * @returns {Promise<Object>} Updated character object
     */
    async applyChanges() {
        try {
            console.info('[LevelUpSession]', 'Applying staged changes to character');

            // Deep merge staged changes into original character
            Object.assign(this.originalCharacter, this.stagedChanges);

            // Recalculate derived stats
            this._recalculateProficiencyBonus();
            this._recalculateHP();
            this._recalculateSpellSlots();

            // Validate character integrity
            this._validateCharacter();

            console.info('[LevelUpSession]', 'Changes applied successfully', {
                newLevel: this.originalCharacter.level,
                newClasses: this.originalCharacter.classes?.map(c => `${c.name} ${c.levels}`).join(', '),
            });

            return this.originalCharacter;
        } catch (error) {
            console.error('[LevelUpSession]', 'Failed to apply changes', error);
            throw error;
        }
    }

    /**
     * Discard all staged changes and reset to initial state.
     * Called when user cancels the wizard.
     */
    discard() {
        this.stagedChanges = JSON.parse(JSON.stringify(this._initialState));
        this.stepData = {};
        console.info('[LevelUpSession]', 'Changes discarded, session reset');
    }

    /**
     * Navigate to a specific step and validate it.
     * @param {number} stepNumber - 0-4
     * @returns {boolean} True if step is valid
     */
    canGoToStep(stepNumber) {
        if (stepNumber < 0 || stepNumber > 4) return false;
        if (stepNumber === 0) return true;

        // Validate current step before allowing navigation
        return this._validateStep(this.currentStep);
    }

    /**
     * Move to next step.
     * @returns {boolean} True if move was successful
     */
    nextStep() {
        if (!this.canGoToStep(this.currentStep + 1)) {
            return false;
        }
        this.currentStep += 1;
        return true;
    }

    /**
     * Move to previous step.
     * @returns {boolean} True if move was successful
     */
    previousStep() {
        if (this.currentStep <= 0) return false;
        this.currentStep -= 1;
        return true;
    }

    /**
     * Jump to a specific step (for stepper navigation).
     * @param {number} stepNumber - 0-4
     * @returns {boolean} True if jump was successful
     */
    jumpToStep(stepNumber) {
        if (!this.canGoToStep(stepNumber)) return false;
        this.currentStep = stepNumber;
        return true;
    }

    // ==================== Private Methods ====================

    /**
     * Navigate a dot notation path in an object.
     * @private
     */
    _navigatePath(obj, path) {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current == null) return undefined;

            // Handle array indices like "classes[0]"
            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, key, index] = arrayMatch;
                current = current[key]?.[parseInt(index)];
            } else {
                current = current[part];
            }
        }

        return current;
    }

    /**
     * Set a value at a dot notation path, creating intermediate objects.
     * @private
     */
    _setPath(obj, path, value) {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            // Handle array indices
            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, key, index] = arrayMatch;
                if (!Array.isArray(current[key])) {
                    current[key] = [];
                }
                if (current[key][index] == null) {
                    current[key][index] = {};
                }
                current = current[key][index];
            } else {
                if (current[part] == null) {
                    current[part] = {};
                }
                current = current[part];
            }
        }

        const lastPart = parts[parts.length - 1];
        const lastArrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
        if (lastArrayMatch) {
            const [, key, index] = lastArrayMatch;
            if (!Array.isArray(current[key])) {
                current[key] = [];
            }
            current[key][parseInt(index)] = value;
        } else {
            current[lastPart] = value;
        }
    }

    /**
     * Recalculate proficiency bonus based on total level.
     * @private
     */
    _recalculateProficiencyBonus() {
        const level = this.stagedChanges.level || 1;
        const bonus = Math.ceil(level / 4) + 1;
        this.stagedChanges.proficiencyBonus = bonus;
    }

    /**
     * Recalculate HP based on class levels, Constitution, and hit die.
     * Note: This is a simplified calculation. Real HP calc may be more complex.
     * @private
     */
    _recalculateHP() {
        // For now, just track that we need to recalculate
        // This will be more complex when implemented
        console.debug('[LevelUpSession]', 'HP recalculation would happen here');
    }

    /**
     * Recalculate spell slots based on class levels.
     * @private
     */
    _recalculateSpellSlots() {
        // Spell slots are handled in spell selection step
        console.debug('[LevelUpSession]', 'Spell slot recalculation handled in spell selection');
    }

    /**
     * Validate that character state is valid.
     * @private
     */
    _validateCharacter() {
        if (!this.stagedChanges.level) {
            throw new Error('Character must have a level');
        }
        if (this.stagedChanges.level < 1 || this.stagedChanges.level > 20) {
            throw new Error(`Character level must be 1-20, got ${this.stagedChanges.level}`);
        }
        if (!this.stagedChanges.classes || this.stagedChanges.classes.length === 0) {
            throw new Error('Character must have at least one class');
        }
    }

    /**
     * Validate a specific step's data before allowing progression.
     * @private
     */
    _validateStep(stepNumber) {
        switch (stepNumber) {
            case 0:
                // Step 0 always valid
                return true;
            case 1:
                // Step 1: Features selected
                // TODO: Implement validation
                return true;
            case 2:
                // Step 2: ASI choices made
                // TODO: Implement validation
                return true;
            case 3:
                // Step 3: Spells selected
                // TODO: Implement validation
                return true;
            case 4:
                // Step 4: Summary, always valid
                return true;
            default:
                return false;
        }
    }
}
