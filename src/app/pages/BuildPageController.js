import { showNotification } from '../../lib/Notifications.js';
import { AbilityScoreCard } from '../../ui/components/abilities/AbilityScoreCard.js';
import { BackgroundCard } from '../../ui/components/background/BackgroundCard.js';
import { ClassCard } from '../../ui/components/class/ClassCard.js';
import { ProficiencyCard } from '../../ui/components/proficiencies/ProficiencyCard.js';
import { RaceCard } from '../../ui/components/race/RaceCard.js';
import { BasePageController } from './BasePageController.js';

export class BuildPageController extends BasePageController {
    constructor() {
        super('BuildPageController');
        this._cards = null;
    }

    async initialize() {
        try {
            const raceCard = new RaceCard();
            const classCard = new ClassCard();
            const backgroundCard = new BackgroundCard();

            const abilityScoreCard = AbilityScoreCard.getInstance();
            await abilityScoreCard.initialize();

            const proficiencyCard = new ProficiencyCard();
            await proficiencyCard.initialize();

            this._cards = [raceCard, classCard, backgroundCard, proficiencyCard];
        } catch (error) {
            console.error('[BuildPageController]', 'Error initializing build page', error);
            showNotification('Error initializing build page', 'error');
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
        super.cleanup();
    }
}
