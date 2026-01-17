/**
 * LevelUpSession manages a single level-up wizard flow.
 * 
 * Acts as a transaction-like system where all changes are staged in memory
 * and only applied to the character when the user confirms.
 * 
 * This ensures atomic updates and prevents partial state corruption if the user exits.
 */

import { characterValidationService } from '../services/CharacterValidationService.js';
import { levelUpService } from '../services/LevelUpService.js';

export class LevelUpSession {
    constructor(character) {
        if (!character) {
            throw new Error('LevelUpSession requires a character object');
        }

        this.originalCharacter = character; // Reference to actual character object
        this.currentStep = 0; // 0-4, tracks wizard progress
        this.stepData = {}; // Per-step metadata (feature choices, ASI selections, etc.)

        // Progression history tracking - records user choices for each class/level
        this.choicesByClassLevel = {}; // { className: { level: { features: [], spells: [], ... }, ... }, ... }

        // Validate character and detect missing choices
        this.validationReport = characterValidationService.validateCharacter(character);
        this.hasMissingChoices = !this.validationReport.isValid;

        if (this.hasMissingChoices) {
            console.warn('[LevelUpSession]', 'Character has missing choices', {
                summary: characterValidationService.getSummary(this.validationReport),
                details: this.validationReport.missing,
            });
        }

        // Deep clone character data into staged changes
        this.stagedChanges = {
            // Note: level is calculated from progression.classes[], not stored
            progression: JSON.parse(JSON.stringify(character.progression || { classes: [], experiencePoints: 0, levelUps: [] })),
            spellcasting: JSON.parse(JSON.stringify(character.spellcasting || { classes: {}, multiclass: {}, other: {} })),
            feats: JSON.parse(JSON.stringify(character.feats || [])),
            abilities: JSON.parse(JSON.stringify(character.abilities || {})),
            hitPoints: JSON.parse(JSON.stringify(character.hitPoints || { current: 1, max: 1 })),
        };

        // Save initial state for rollback
        this._initialState = JSON.parse(JSON.stringify(this.stagedChanges));

        console.info('[LevelUpSession]', 'Initialized for character', {
            characterName: character.name,
            currentLevel: character.getTotalLevel(),
            classes: character.progression?.classes?.map(c => `${c.name} ${c.levels}`).join(', '),
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
            // Calculate level change from progression.classes
            totalLevelChange: this._calculateTotalLevel(this.stagedChanges.progression) - this.originalCharacter.getTotalLevel(),
        };

        // Compare class levels for summary
        if (this.stagedChanges.progression?.classes && Array.isArray(this.stagedChanges.progression.classes)) {
            this.stagedChanges.progression.classes.forEach(stagedClass => {
                const originalClass = this.originalCharacter.progression?.classes?.find(c => c.name === stagedClass.name);
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

            const fromLevel = this._initialState.level;
            const toLevel = this.stagedChanges.level;

            // Deep merge staged changes into original character
            Object.assign(this.originalCharacter, this.stagedChanges);

            // Apply selected subclasses from step data
            if (this.stepData.selectedSubclasses && Object.keys(this.stepData.selectedSubclasses).length > 0) {
                if (!this.originalCharacter.progression) {
                    this.originalCharacter.progression = { classes: [] };
                }

                Object.entries(this.stepData.selectedSubclasses).forEach(([className, subclassName]) => {
                    if (subclassName) {
                        const classEntry = this.originalCharacter.progression.classes.find(c => c.name === className);
                        if (classEntry) {
                            classEntry.subclass = subclassName;
                        }
                    }
                });
            }

            // Recalculate derived stats
            this._recalculateProficiencyBonus();
            this._recalculateHP();
            this._recalculateSpellSlots();

            // Update spell slots using LevelUpService
            levelUpService.updateSpellSlots(this.originalCharacter);

            // Record level-up in character history
            const changes = this.getChangeSummary();
            levelUpService.recordLevelUp(this.originalCharacter, fromLevel, toLevel, changes);

            // Validate character integrity
            this._validateCharacter();

            console.info('[LevelUpSession]', 'Changes applied successfully', {
                newLevel: this.originalCharacter.getTotalLevel(),
                fromLevel,
                toLevel,
                newClasses: this.originalCharacter.progression?.classes?.map(c => `${c.name} ${c.levels}`).join(', '),
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
                current = current[key]?.[parseInt(index, 10)];
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
            current[key][parseInt(index, 10)] = value;
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
        // Update staged changes spell slots based on class progression
        if (this.stagedChanges.progression?.classes?.length > 0) {
            // Apply spell slot updates to staged changes temporarily
            const tempChar = { ...this.stagedChanges, progression: this.stagedChanges.progression };
            levelUpService.updateSpellSlots(tempChar);
            // Copy updated spell slots back to stagedChanges
            if (tempChar.spellcasting) {
                this.stagedChanges.spellcasting = tempChar.spellcasting;
            }
        }
        console.debug('[LevelUpSession]', 'Spell slots recalculated for staged changes');
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
        if (!this.stagedChanges.progression?.classes || this.stagedChanges.progression.classes.length === 0) {
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

    /**
     * Record user choices for a specific class/level combination.
     * Used during level-up to track what the user selected.
     * 
     * @param {string} className - Class name (e.g., 'Fighter')
     * @param {number} level - The level being progressed to
     * @param {Object} choices - Choices object { features: [], spells: [], asi: null, ... }
     * @returns {void}
     */
    recordChoices(className, level, choices) {
        if (!this.choicesByClassLevel[className]) {
            this.choicesByClassLevel[className] = {};
        }

        const levelKey = String(level);
        this.choicesByClassLevel[className][levelKey] = { ...choices };

        console.debug('[LevelUpSession]', `Recorded choices for ${className} level ${level}`, choices);
    }

    /**
     * Get recorded choices for a specific class/level.
     * 
     * @param {string} className
     * @param {number} level
     * @returns {Object|null} Choices object or null if not recorded
     */
    getChoices(className, level) {
        if (!this.choicesByClassLevel[className]) return null;

        const levelKey = String(level);
        return this.choicesByClassLevel[className][levelKey] || null;
    }

    /**
     * Get all recorded choices for a class.
     * 
     * @param {string} className
     * @returns {Object} { level: choices, level: choices, ... }
     */
    getClassChoices(className) {
        return this.choicesByClassLevel[className] || {};
    }

    /**
     * Get all recorded choices across all classes in this session.
     * Used when applying changes to persist to character's progressionHistory.
     * 
     * @returns {Object} { className: { level: choices, ... }, ... }
     */
    getAllChoices() {
        return { ...this.choicesByClassLevel };
    }

    /**
     * Clear recorded choices for a class/level (if user goes back and changes selections).
     * 
     * @param {string} className
     * @param {number} level
     * @returns {void}
     */
    clearChoices(className, level) {
        if (!this.choicesByClassLevel[className]) return;

        const levelKey = String(level);
        delete this.choicesByClassLevel[className][levelKey];

        console.debug('[LevelUpSession]', `Cleared choices for ${className} level ${level}`);
    }

    /**
     * Get validation report for character
     * @returns {Object} Validation report with missing choices
     */
    getValidationReport() {
        return this.validationReport;
    }

    /**     * Get validation report filtered by current staged class levels
     * Removes missing choices for levels that have been removed via level-down
     * @returns {Object} Filtered validation report
     */
    getFilteredValidationReport() {
        if (!this.validationReport) return null;

        // Get current staged class levels
        const stagedClasses = this.stagedChanges.progression?.classes || [];
        const stagedLevelsByClass = {};
        stagedClasses.forEach(cls => {
            stagedLevelsByClass[cls.name] = cls.levels || 0;
        });

        // Deep clone the validation report
        const filtered = JSON.parse(JSON.stringify(this.validationReport));

        // Filter each category of missing choices
        const categories = ['subclasses', 'invocations', 'metamagic', 'fightingStyles', 'pactBoons', 'asis', 'spells', 'features', 'other'];

        for (const category of categories) {
            if (filtered.missing[category]) {
                filtered.missing[category] = filtered.missing[category].filter(missing => {
                    const className = missing.class;
                    const requiredLevel = missing.level || missing.requiredAt;
                    const currentStagedLevel = stagedLevelsByClass[className] || 0;

                    // Keep this missing choice only if the class still has that level
                    return currentStagedLevel >= requiredLevel;
                });
            }
        }

        // Update isValid flag
        filtered.isValid = Object.values(filtered.missing).every(arr => arr.length === 0);

        return filtered;
    }

    /**     * Check if character has any missing choices
     * @returns {boolean} True if missing choices detected
     */
    hasMissingChoicesForCurrentLevel() {
        return this.hasMissingChoices;
    }

    /**
     * Get summary of missing choices
     * @returns {string[]} Array of summary messages
     */
    getMissingChoicesSummary() {
        return characterValidationService.getSummary(this.validationReport);
    }

    /**
     * Calculate total level from progression object
     * @param {Object} progression - Progression object with classes array
     * @returns {number} Total level
     * @private
     */
    _calculateTotalLevel(progression) {
        if (!progression?.classes || progression.classes.length === 0) {
            return 1;
        }
        return progression.classes.reduce((sum, c) => sum + (c.levels || 0), 0);
    }
}
