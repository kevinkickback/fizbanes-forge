/**
 * @file MethodSwitcherView.js
 * @description View for rendering ability score method selection and info display
 */

import { CharacterManager } from '../../core/CharacterManager.js';
import { abilityScoreService } from '../../services/AbilityScoreService.js';


/**
 * View for ability score method selection and information display
 */
class MethodSwitcherView {
    /**
     * Creates a new MethodSwitcherView
     * @param {HTMLElement} container - The main ability score container
     */
    constructor(container) {
        this._container = container;
    }

    /**
     * Renders the method selection dropdown and info based on current method
     * @param {Function} onMethodChange - Callback for method change events
     */
    render(onMethodChange) {
        try {
            // Remove existing info container if it exists
            let infoContainer = this._container.querySelector('.ability-score-method-info');
            if (infoContainer) {
                infoContainer.remove();
            }

            // Get the character and method directly
            const character = CharacterManager.getCurrentCharacter();
            if (!character) {
                return;
            }

            // Always use the method directly from character.variantRules
            const methodFromCharacter = character.variantRules?.abilityScoreMethod || 'custom';
            const isPointBuy = methodFromCharacter === 'pointBuy';
            const isStandardArray = methodFromCharacter === 'standardArray';

            // Create a new container
            infoContainer = document.createElement('div');
            infoContainer.className = 'ability-score-method-info mb-3';

            // Populate based on current method
            if (isPointBuy) {
                const usedPoints = abilityScoreService.getUsedPoints();
                const remainingPoints = abilityScoreService.getRemainingPoints();
                const maxPoints = abilityScoreService.getMaxPoints();

                infoContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="ability-score-method-select-container">
                        <select class="form-select form-select-sm" id="abilityScoreMethod">
                            <option value="pointBuy">Point Buy</option>
                            <option value="standardArray">Standard Array</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div class="text-end">
                        ${usedPoints}/${maxPoints} points (<strong>${remainingPoints}</strong> remaining)
                    </div>
                </div>
            `;
            } else if (isStandardArray) {
                // Get the available values
                const availableValues = abilityScoreService.getAvailableStandardArrayValues();
                const usedCount = 6 - availableValues.length;

                infoContainer.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="ability-score-method-select-container">
                            <select class="form-select form-select-sm" id="abilityScoreMethod">
                                <option value="pointBuy">Point Buy</option>
                                <option value="standardArray">Standard Array</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="text-end">
                            ${usedCount}/6 assigned
                        </div>
                    </div>
            `;
            } else if (methodFromCharacter === 'custom') {
                infoContainer.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="ability-score-method-select-container">
                            <select class="form-select form-select-sm" id="abilityScoreMethod">
                                <option value="pointBuy">Point Buy</option>
                                <option value="standardArray">Standard Array</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="text-end text-muted">
                            Enter your ability scores directly.
                        </div>
                    </div>
                `;
            }

            // Add the container only if we have content
            if (infoContainer.innerHTML.trim()) {
                this._container.prepend(infoContainer);

                // Attach event listener to the newly created dropdown
                const methodSelect = document.getElementById('abilityScoreMethod');
                if (methodSelect) {
                    methodSelect.value = methodFromCharacter;
                    methodSelect.removeEventListener('change', onMethodChange);
                    methodSelect.addEventListener('change', onMethodChange);
                }
            }
        } catch (error) {
            console.error('Error rendering ability score method info:', error);
        }
    }

    /**
     * Updates only the point buy counter display
     */
    updatePointBuyCounter() {
        const counter = this._container.querySelector('.point-buy-badge');
        if (!counter) {
            // Update the text display in the method info if it exists
            const methodInfo = this._container.querySelector('.ability-score-method-info .text-end');
            if (methodInfo) {
                const usedPoints = abilityScoreService.getUsedPoints();
                const remainingPoints = abilityScoreService.getRemainingPoints();
                const maxPoints = abilityScoreService.getMaxPoints();

                methodInfo.innerHTML = `${usedPoints}/${maxPoints} points (<strong>${remainingPoints}</strong> remaining)`;

                // Apply danger color only if over the limit
                if (remainingPoints < 0) {
                    methodInfo.classList.add('text-danger');
                } else {
                    methodInfo.classList.remove('text-danger');
                }
            }
            return;
        }

        const usedPoints = abilityScoreService.getUsedPoints();
        const remainingPoints = abilityScoreService.getRemainingPoints();
        const maxPoints = abilityScoreService.getMaxPoints();

        counter.innerHTML = `<span class="label">Point Buy</span>${usedPoints}/${maxPoints} 
                            (<strong>${remainingPoints}</strong> remaining)`;

        // Apply danger color only if over the limit
        if (remainingPoints < 0) {
            counter.classList.add('danger');
        } else {
            counter.classList.remove('danger');
        }
    }

    /**
     * Updates the container reference for the view
     * @param {HTMLElement} container - The new container element
     */
    setContainer(container) {
        this._container = container;
    }
}

let _instance = null;

/**
 * Singleton accessor for MethodSwitcherView
 */
MethodSwitcherView.getInstance = (container) => {
    if (!_instance) {
        _instance = new MethodSwitcherView(container);
    }
    return _instance;
};

export { MethodSwitcherView };
export const methodSwitcherView = MethodSwitcherView.getInstance;
