import { ALIGNMENTS } from '../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { deityService } from '../../services/DeityService.js';
import { AppState } from '../AppState.js';
import { BasePageController } from './BasePageController.js';

export class DetailsPageController extends BasePageController {
    constructor() {
        super('DetailsPageController');
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[DetailsPageController]', 'No character loaded for details page');
                return;
            }

            const alignmentInput = document.getElementById('alignment');
            if (alignmentInput) {
                while (alignmentInput.options.length > 1) {
                    alignmentInput.remove(1);
                }
                ALIGNMENTS.forEach((alignment) => {
                    const option = document.createElement('option');
                    option.value = alignment.value;
                    option.textContent = alignment.label;
                    alignmentInput.appendChild(option);
                });
                alignmentInput.value = character.alignment || '';
            }

            const deityInput = document.getElementById('deity');
            const deityList = document.getElementById('deityList');
            if (deityList) {
                deityList.innerHTML = '';
                const deityNames = deityService.getDeityNames();
                deityNames.forEach((name) => {
                    const option = document.createElement('option');
                    option.value = name;
                    deityList.appendChild(option);
                });
            }
            if (deityInput) {
                deityInput.value = character.deity || '';
            }

            const characterNameInput = document.getElementById('characterName');
            const playerNameInput = document.getElementById('playerName');
            const heightInput = document.getElementById('height');
            const weightInput = document.getElementById('weight');
            const genderInput = document.getElementById('gender');
            const backstoryTextarea = document.getElementById('backstory');

            if (characterNameInput) characterNameInput.value = character.name || '';
            if (playerNameInput) playerNameInput.value = character.playerName || '';
            if (heightInput) heightInput.value = character.height || '';
            if (weightInput) weightInput.value = character.weight || '';
            if (genderInput) genderInput.value = character.gender || '';
            if (backstoryTextarea) backstoryTextarea.value = character.backstory || '';

            this._setupFormListeners();
        } catch (error) {
            console.error('[DetailsPageController]', 'Error initializing details page', error);
            showNotification('Error loading details page', 'error');
        }
    }

    _setupFormListeners() {
        const detailsFields = [
            'characterName', 'playerName', 'height', 'weight',
            'gender', 'alignment', 'deity', 'backstory',
        ];

        detailsFields.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    console.debug(
                        'DetailsPageController',
                        `Form field changed (${fieldId}), emitting CHARACTER_UPDATED`,
                    );
                    eventBus.emit(EVENTS.CHARACTER_UPDATED, {
                        character: AppState.getCurrentCharacter(),
                    });
                });
            }
        });
    }
}
