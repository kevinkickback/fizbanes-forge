/**
 * CharacterCreationSession manages the character creation wizard flow.
 * 
 * Stages all character data in memory until the user confirms creation.
 * This ensures atomic creation and prevents partial state if the user cancels.
 */

export class CharacterCreationSession {
    constructor() {
        this.currentStep = 0; // 0-3, tracks wizard progress (Basics -> Rules -> Sources -> Review)

        // Staged character data
        this.stagedData = {
            // Step 0: Basics
            name: '',
            level: 1,
            gender: 'male',
            portrait: null,

            // Step 1: Rules
            abilityScoreMethod: 'pointBuy',
            variantRules: {
                feats: true,
                multiclassing: true,
                averageHitPoints: true,
            },
            allowedSources: new Set(),

            // Step 2: Race
            race: null,

            // Step 3: Class
            class: null,
        };

        console.info('[CharacterCreationSession]', 'Initialized new character creation session');
    }

    /**
     * Get a value from staged data using dot notation path.
     * 
     * @param {string} path - Dot notation path (e.g., "variantRules.feats")
     * @returns {*} Value at path
     */
    get(path) {
        return this._navigatePath(this.stagedData, path);
    }

    /**
     * Set a value in staged data using dot notation path.
     * 
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     */
    set(path, value) {
        this._setPath(this.stagedData, path, value);
    }

    /**
     * Get all staged data for final character creation.
     * @returns {Object} Staged data
     */
    getStagedData() {
        return {
            ...this.stagedData,
            allowedSources: Array.from(this.stagedData.allowedSources),
        };
    }

    /**
     * Validate the current step's data.
     * @returns {boolean} True if valid
     */
    validateCurrentStep() {
        switch (this.currentStep) {
            case 0: // Basics
                return this.stagedData.name?.trim().length > 0;

            case 1: // Rules
                return this.stagedData.abilityScoreMethod?.length > 0;

            case 2: // Sources
                return this.stagedData.allowedSources.size > 0;

            case 3: // Review
                return true;

            default:
                return false;
        }
    }

    /**
     * Navigate a path in an object using dot notation.
     * @private
     */
    _navigatePath(obj, path) {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current == null) return undefined;
            current = current[part];
        }

        return current;
    }

    /**
     * Set a value at a path in an object using dot notation.
     * Creates intermediate objects if needed.
     * @private
     */
    _setPath(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        let current = obj;

        for (const part of parts) {
            if (!(part in current) || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }

        current[last] = value;
    }

    /**
     * Reset the session to initial state.
     */
    reset() {
        this.currentStep = 0;
        this.stagedData = {
            name: '',
            level: 1,
            gender: 'male',
            portrait: null,
            abilityScoreMethod: 'pointBuy',
            variantRules: {
                feats: true,
                multiclassing: true,
                averageHitPoints: true,
            },
            allowedSources: new Set(),
        };

        console.debug('[CharacterCreationSession]', 'Session reset');
    }
}
