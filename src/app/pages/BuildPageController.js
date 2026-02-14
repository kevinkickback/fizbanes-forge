import { showNotification } from '../../lib/Notifications.js';
import { abilityScoreCard } from '../../ui/components/abilities/AbilityScoreCard.js';
import { BackgroundCard } from '../../ui/components/background/BackgroundCard.js';
import { ClassCard } from '../../ui/components/class/ClassCard.js';
import { ProficiencyCard } from '../../ui/components/proficiencies/ProficiencyCard.js';
import { RaceCard } from '../../ui/components/race/RaceCard.js';
import { BasePageController } from './BasePageController.js';

export class BuildPageController extends BasePageController {
    constructor() {
        super('BuildPageController');
        this._cards = null;
        this._abilityScoreCard = null;
        this._proficiencyCard = null;
    }

    async initialize() {
        try {
            await abilityScoreCard.initialize();
            this._abilityScoreCard = abilityScoreCard;

            const proficiencyCard = new ProficiencyCard();
            await proficiencyCard.initialize();
            this._proficiencyCard = proficiencyCard;

            // Build change handler — called by source cards instead of DOM events
            const handleBuildChange = (source) => {
                this._coordinateUpdate(source);
            };

            const raceCard = new RaceCard();
            raceCard.onBuildChange = handleBuildChange;

            const classCard = new ClassCard();
            classCard.onBuildChange = handleBuildChange;

            const backgroundCard = new BackgroundCard();
            backgroundCard.onBuildChange = handleBuildChange;

            this._cards = [raceCard, classCard, backgroundCard, proficiencyCard];
        } catch (error) {
            console.error('[BuildPageController]', 'Error initializing build page', error);
            showNotification('Error initializing build page', 'error');
        }
    }

    _coordinateUpdate(source) {
        const ability = this._abilityScoreCard;
        const proficiency = this._proficiencyCard;
        if (!ability || !proficiency) return;

        switch (source) {
            case 'race':
                // Race change affects: ability scores (race bonuses), proficiencies, full UI sync
                ability.refreshForRaceChange();
                proficiency.refreshForProficiencyChange();
                proficiency.refreshForCharacterChange();
                ability.refreshForCharacterChange();
                break;

            case 'race-proficiency':
                // Race proficiency sub-update (from _updateRaceProficiencies)
                proficiency.refreshForProficiencyChange();
                break;

            case 'class':
                // Class change affects: proficiencies, character sync
                proficiency.refreshForProficiencyChange();
                proficiency.refreshForCharacterChange();
                ability.refreshForCharacterChange();
                break;

            case 'class-proficiency':
                // Class proficiency sub-update (from _updateProficiencies)
                proficiency.refreshForProficiencyChange();
                proficiency.refreshForCharacterChange();
                break;

            case 'background':
                // Background change affects: proficiencies
                proficiency.refreshForProficiencyChange();
                break;

            default:
                console.warn('[BuildPageController]', 'Unknown build change source:', source);
                break;
        }
    }

    cleanup() {
        if (this._cards) {
            this._cards.forEach(card => {
                if (card && typeof card._cleanupEventListeners === 'function') {
                    card._cleanupEventListeners();
                }
            });
            this._cards = null;
        }
        this._abilityScoreCard = null;
        this._proficiencyCard = null;
        super.cleanup();
    }
}
