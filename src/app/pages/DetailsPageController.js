import { ALIGNMENTS, toSentenceCase } from '../../lib/5eToolsParser.js';
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
            const genderInput = document.getElementById('gender');
            const ageInput = document.getElementById('age');
            const heightInput = document.getElementById('height');
            const weightInput = document.getElementById('weight');
            const eyeColorInput = document.getElementById('eyeColor');
            const skinColorInput = document.getElementById('skinColor');
            const hairColorInput = document.getElementById('hairColor');
            const additionalFeaturesTextarea = document.getElementById('additionalFeatures');
            const personalityTraitsTextarea = document.getElementById('personalityTraits');
            const idealsTextarea = document.getElementById('ideals');
            const bondsTextarea = document.getElementById('bonds');
            const flawsTextarea = document.getElementById('flaws');
            const experienceInput = document.getElementById('experience');
            const backstoryTextarea = document.getElementById('backstory');
            const allySelectorInput = document.getElementById('allySelector');
            const allyCustomNotesTextarea = document.getElementById('allyCustomNotes');

            if (characterNameInput) characterNameInput.value = character.name || '';
            if (playerNameInput) playerNameInput.value = character.playerName || '';
            if (genderInput) {
                genderInput.value = toSentenceCase(character.gender);
            }
            if (ageInput) ageInput.value = character.age || '';
            if (heightInput) heightInput.value = character.height || '';
            if (weightInput) weightInput.value = character.weight || '';
            if (eyeColorInput) eyeColorInput.value = character.eyeColor || '';
            if (skinColorInput) skinColorInput.value = character.skinColor || '';
            if (hairColorInput) hairColorInput.value = character.hairColor || '';
            if (additionalFeaturesTextarea) additionalFeaturesTextarea.value = character.additionalFeatures || '';
            if (personalityTraitsTextarea) personalityTraitsTextarea.value = character.personalityTraits || '';
            if (idealsTextarea) idealsTextarea.value = character.ideals || '';
            if (bondsTextarea) bondsTextarea.value = character.bonds || '';
            if (flawsTextarea) flawsTextarea.value = character.flaws || '';
            if (experienceInput) experienceInput.value = character.experience || '';
            if (backstoryTextarea) backstoryTextarea.value = character.backstory || '';

            if (character.alliesAndOrganizations) {
                if (allySelectorInput) allySelectorInput.value = character.alliesAndOrganizations.selectedAlly || '';
                if (allyCustomNotesTextarea) allyCustomNotesTextarea.value = character.alliesAndOrganizations.customNotes || '';
            }

            this._setupFormListeners();
            this._setupAllyImageHandler();
        } catch (error) {
            console.error('[DetailsPageController]', 'Error initializing details page', error);
            showNotification('Error loading details page', 'error');
        }
    }

    _setupFormListeners() {
        const FIELD_TO_PROPERTY = {
            characterName: 'name',
            playerName: 'playerName',
            gender: 'gender',
            alignment: 'alignment',
            deity: 'deity',
            age: 'age',
            height: 'height',
            weight: 'weight',
            eyeColor: 'eyeColor',
            skinColor: 'skinColor',
            hairColor: 'hairColor',
            additionalFeatures: 'additionalFeatures',
            personalityTraits: 'personalityTraits',
            ideals: 'ideals',
            bonds: 'bonds',
            flaws: 'flaws',
            experience: 'experience',
            backstory: 'backstory',
        };



        for (const [fieldId, property] of Object.entries(FIELD_TO_PROPERTY)) {
            const field = document.getElementById(fieldId);
            if (field) {
                const eventType = field.tagName === 'SELECT' ? 'change' : 'input';
                field.addEventListener(eventType, () => {
                    const character = AppState.getCurrentCharacter();
                    if (character) {
                        character[property] = field.value;
                        eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
                    }
                });
            }
        }

        const allySelector = document.getElementById('allySelector');
        const allyCustomNotes = document.getElementById('allyCustomNotes');

        if (allySelector) {
            allySelector.addEventListener('change', () => {
                const character = AppState.getCurrentCharacter();
                if (character) {
                    character.alliesAndOrganizations.selectedAlly = allySelector.value;
                    eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
                }
            });
        }

        if (allyCustomNotes) {
            allyCustomNotes.addEventListener('input', () => {
                const character = AppState.getCurrentCharacter();
                if (character) {
                    character.alliesAndOrganizations.customNotes = allyCustomNotes.value;
                    eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
                }
            });
        }
    }

    _setupAllyImageHandler() {
        const allySelector = document.getElementById('allySelector');
        const allyImage = document.getElementById('allyImage');
        const allyInfo = document.getElementById('allyInfo');
        const allyCustomNotes = document.getElementById('allyCustomNotes');

        if (!allySelector || !allyImage || !allyInfo || !allyCustomNotes) return;

        const updateAllyDisplay = () => {
            const selectedValue = allySelector.value;

            // Check if custom is selected
            if (selectedValue === 'custom') {
                allyImage.style.backgroundImage = '';
                allyInfo.classList.add('u-hidden');
                allyCustomNotes.classList.remove('u-hidden');
                return;
            }

            // Show read-only info for predefined organizations
            allyInfo.classList.remove('u-hidden');
            allyCustomNotes.classList.add('u-hidden');

            // Map of ally values to data
            const allyData = {
                'harpers': {
                    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%234169E1" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="20" fill="white" text-anchor="middle" dy=".3em"%3EThe Harpers%3C/text%3E%3C/svg%3E',
                    description: 'The Harpers are a scattered network of spellcasters and spies who advocate equality and covertly oppose the abuse of power, magical or otherwise.'
                },
                'zhentarim': {
                    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23FFD700" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="18" fill="black" text-anchor="middle" dy=".3em"%3EThe Zhentarim%3C/text%3E%3C/svg%3E',
                    description: 'The Zhentarim, also known as the Black Network, is an infamous organization of mercenaries, traders, and thieves who seek profit and power.'
                },
                'emerald-enclave': {
                    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%2332CD32" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="white" text-anchor="middle" dy=".3em"%3EEmerald Enclave%3C/text%3E%3C/svg%3E',
                    description: 'The Emerald Enclave is a far-ranging group that opposes threats to the natural world and helps others survive in the wilderness.'
                },
                'lords-alliance': {
                    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23DC143C" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="white" text-anchor="middle" dy=".3em"%3ELords\' Alliance%3C/text%3E%3C/svg%3E',
                    description: 'The Lords\' Alliance is a coalition of rulers from cities across Faerûn who believe that solidarity is needed to keep evil at bay.'
                },
                'order-gauntlet': {
                    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23C0C0C0" width="200" height="200"/%3E%3Ctext x="50%25" y="40%25" font-size="14" fill="black" text-anchor="middle" dy=".3em"%3EOrder of the%3C/text%3E%3Ctext x="50%25" y="60%25" font-size="14" fill="black" text-anchor="middle" dy=".3em"%3EGauntlet%3C/text%3E%3C/svg%3E',
                    description: 'The Order of the Gauntlet is a devout and vigilant group that seeks to protect others from the depredations of evildoers.'
                },
            };

            if (selectedValue && allyData[selectedValue]) {
                allyImage.style.backgroundImage = `url('${allyData[selectedValue].image}')`;
                allyInfo.textContent = allyData[selectedValue].description;
            } else {
                allyImage.style.backgroundImage = '';
                allyInfo.textContent = '';
            }
        };

        allySelector.addEventListener('change', updateAllyDisplay);
        updateAllyDisplay();
    }
}
