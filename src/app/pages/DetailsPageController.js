import { ALIGNMENTS, toSentenceCase } from '../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { deityService } from '../../services/DeityService.js';
import { PortraitSelector } from '../../ui/components/shared/PortraitSelector.js';
import { AppState } from '../AppState.js';
import { CharacterManager } from '../CharacterManager.js';
import { BasePageController } from './BasePageController.js';

export class DetailsPageController extends BasePageController {
    constructor() {
        super('DetailsPageController');
        this._cleanup = DOMCleanup.create();
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[DetailsPageController]', 'No character loaded for details page');
                return;
            }

            // Portrait Card - initialize selector
            const portraitEl = document.getElementById('characterPortrait');
            const portraitGrid = document.getElementById('detailsPortraitGrid');
            const portraitUpload = document.getElementById('detailsPortraitUpload');

            if (portraitEl && portraitGrid) {
                const rawPortrait = character.portrait || character.image || character.avatar || '';
                let currentPortrait = rawPortrait;
                if (/^[A-Za-z]:\\/.test(rawPortrait)) {
                    currentPortrait = `file://${rawPortrait.replace(/\\/g, '/')}`;
                } else {
                    currentPortrait = rawPortrait.replace(/\\/g, '/');
                }

                const portraitSelector = new PortraitSelector({
                    grid: portraitGrid,
                    preview: portraitEl,
                    uploadInput: portraitUpload,
                    cleanup: this._cleanup,
                    onSelect: (src) => {
                        CharacterManager.updateCharacter({ portrait: src });
                    },
                });

                await portraitSelector.initialize(currentPortrait || null);
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
        const customAllyImageBtn = document.getElementById('customAllyImageBtn');
        const customAllyImageInput = document.getElementById('customAllyImageInput');

        if (!allySelector || !allyImage || !allyInfo || !allyCustomNotes || !customAllyImageBtn || !customAllyImageInput) return;

        // Restore custom image if present
        let customImageDataUrl = '';
        const character = AppState.getCurrentCharacter();
        if (character?.alliesAndOrganizations?.customImage) {
            customImageDataUrl = character.alliesAndOrganizations.customImage;
        }

        const updateAllyDisplay = () => {
            const selectedValue = allySelector.value;

            if (selectedValue === 'custom') {
                allyImage.style.backgroundImage = customImageDataUrl ? `url('${customImageDataUrl}')` : '';
                allyInfo.classList.add('u-hidden');
                allyCustomNotes.classList.remove('u-hidden');
                customAllyImageBtn.classList.remove('u-hidden');
                return;
            }

            customAllyImageBtn.classList.add('u-hidden');
            allyInfo.classList.remove('u-hidden');
            allyCustomNotes.classList.add('u-hidden');

            // Map of ally values to data (now using real images)
            const allyData = {
                'harpers': {
                    image: 'assets/images/organizations/Harpers.png',
                    description: 'The Harpers, or Those Who Harp, are a semi-secret organization dedicated to preserving historical lore, maintaining the balance between nature and civilization, and defending the innocent from the forces of evil across the Realms. The Harpers involve themselves in many world-changing events that help shape the course of Faerûn’s destiny. Their power and influence wax and wane over the years, as their order undergoes a series of collapses and reformations. Their reputation among the people of the Realms varies just as wildly. They are often seen as wide-eyed idealists, but also just as often as insufferable meddlers who cannot keep their business to themselves.'
                },
                'zhentarim': {
                    image: 'assets/images/organizations/Zhentarim.png',
                    description: 'The Zhentarim, also known as the Black Network, is a mercenary company and major mercantile organization in Faerûn. For over 200 years, they have a storied history as a cadre of self-serving thieves, spies, assassins, and malevolent wizards. Their leaders serve dark gods Bane and Cyric. The organization experiences both great successes and major misfortunes, especially regarding their historical strongholds around the Moonsea. As of 1489 DR, the Zhentarim is headquartered in the Western Heartlands at Darkhold Castle, nestled in the valley of the same name.'
                },
                'emerald-enclave': {
                    image: 'assets/images/organizations/EmeraldEnclave.png',
                    description: "The Emerald Enclave is an organization of druids and other nature worshipers based out of the island of Ilighôn off the coast of the Vilhon Reach. They are referred to by many names, including Caretakers, Nature's Chosen, the Circle, and the Chosen of Silvanus. Despite the power of the Vilhonese nations, as of the 14th century DR they do nothing involving the land and nature without the approval of the Enclave."
                },
                'lords-alliance': {
                    image: 'assets/images/organizations/LordsAlliance.png',
                    description: "The Lords' Alliance, also known as the Council of Lords, is a partnership of merchant cities founded in the early 14th century DR. Its members are from the Sword Coast, the North, and Western Heartlands, including Waterdeep, Silverymoon, Baldur's Gate, and Neverwinter, as well as other free cities and towns in the region, which make up the bulk of the organization. It is formed to oppose the growing influence of the Black Network in the North, the Shadow Thieves of Amn, rampaging hordes of orcs, and Northlander raiders."
                },
                'order-gauntlet': {
                    image: 'assets/images/organizations/OrderGauntlet.png',
                    description: 'The Order of the Gauntlet is a coalition of morally upstanding warriors, knights, paladins, and clerics who dedicate themselves to the destruction of evil in Faerûn. They are a unified group, bonded by their fervent religious beliefs or staunch dedication to enforcing justice in the realms. To these brothers and sisters in arms, evil must be dealt with and cannot be ignored.'
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

        // Upload button logic
        customAllyImageBtn.addEventListener('click', () => {
            customAllyImageInput.click();
        });

        customAllyImageInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                customImageDataUrl = evt.target.result;
                allyImage.style.backgroundImage = `url('${customImageDataUrl}')`;
                // Persist to character state
                const character = AppState.getCurrentCharacter();
                if (character?.alliesAndOrganizations) {
                    character.alliesAndOrganizations.customImage = customImageDataUrl;
                    eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
                }
            };
            reader.readAsDataURL(file);
        });
    }

    cleanup() {
        this._cleanup.cleanup();
        super.cleanup();
    }
}
