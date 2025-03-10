/**
 * ProficiencyManager.js
 * Manager for managing proficiencies and proficiency bonuses
 */

export class ProficiencyManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    calculateProficiencyBonus(level) {
        return Math.floor((level - 1) / 4) + 2;
    }

    async getAvailableSkills() {
        return [
            'Acrobatics',
            'Animal Handling',
            'Arcana',
            'Athletics',
            'Deception',
            'History',
            'Insight',
            'Intimidation',
            'Investigation',
            'Medicine',
            'Nature',
            'Perception',
            'Performance',
            'Persuasion',
            'Religion',
            'Sleight of Hand',
            'Stealth',
            'Survival'
        ];
    }

    async getAvailableTools() {
        return [
            "Alchemist's supplies",
            "Brewer's supplies",
            "Calligrapher's supplies",
            "Carpenter's tools",
            "Cartographer's tools",
            "Cobbler's tools",
            "Cook's utensils",
            "Glassblower's tools",
            "Jeweler's tools",
            "Leatherworker's tools",
            "Mason's tools",
            "Painter's supplies",
            "Potter's tools",
            "Smith's tools",
            "Tinker's tools",
            "Weaver's tools",
            "Woodcarver's tools",
            "Disguise kit",
            "Forgery kit",
            "Gaming set",
            "Herbalism kit",
            "Musical instrument",
            "Navigator's tools",
            "Poisoner's kit",
            "Thieves' tools"
        ];
    }

    async getAvailableLanguages() {
        return [
            'Common',
            'Dwarvish',
            'Elvish',
            'Giant',
            'Gnomish',
            'Goblin',
            'Halfling',
            'Orc',
            'Abyssal',
            'Celestial',
            'Draconic',
            'Deep Speech',
            'Infernal',
            'Primordial',
            'Sylvan',
            'Undercommon'
        ];
    }

    getSkillAbility(skill) {
        const skillMap = {
            'Acrobatics': 'dexterity',
            'Animal Handling': 'wisdom',
            'Arcana': 'intelligence',
            'Athletics': 'strength',
            'Deception': 'charisma',
            'History': 'intelligence',
            'Insight': 'wisdom',
            'Intimidation': 'charisma',
            'Investigation': 'intelligence',
            'Medicine': 'wisdom',
            'Nature': 'intelligence',
            'Perception': 'wisdom',
            'Performance': 'charisma',
            'Persuasion': 'charisma',
            'Religion': 'intelligence',
            'Sleight of Hand': 'dexterity',
            'Stealth': 'dexterity',
            'Survival': 'wisdom'
        };
        return skillMap[skill] || null;
    }

    validateSkill(skill) {
        return this.getSkillAbility(skill) !== null;
    }

    validateTool(tool) {
        return this.getAvailableTools().includes(tool);
    }

    validateLanguage(language) {
        return this.getAvailableLanguages().includes(language);
    }

    calculateSkillModifier(character, skill) {
        const ability = this.getSkillAbility(skill);
        if (!ability) return 0;

        const abilityMod = character.getAbilityModifier(ability);
        const profBonus = character.hasProficiency('skill', skill) ?
            this.calculateProficiencyBonus(character.level) : 0;

        return abilityMod + profBonus;
    }

    formatModifier(value) {
        return value >= 0 ? `+${value}` : value.toString();
    }
} 