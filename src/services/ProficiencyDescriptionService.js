import { DataLoader } from '../lib/DataLoader.js';
import TextProcessor from '../lib/TextProcessor.js';
import { itemService } from './ItemService.js';
import { skillService } from './SkillService.js';

export class ProficiencyDescriptionService {
    constructor() {
        this._skillData = null;
        this._languageData = null;
        this._bookData = null;
        this._sourceServiceModule = null;
    }

    dispose() {
        this._skillData = null;
        this._languageData = null;
        this._bookData = null;
    }

    resetData() {
        this._skillData = null;
        this._languageData = null;
        this._bookData = null;
    }

    async _getAllowedSourcesSet() {
        if (!this._sourceServiceModule) {
            this._sourceServiceModule = await import('./SourceService.js');
        }
        return new Set(
            this._sourceServiceModule.sourceService
                .getAllowedSources()
                .map((s) => s.toUpperCase()),
        );
    }

    _findBySourcePriority(items, matchFn, allowedSources) {
        if (allowedSources.has('XPHB')) {
            const result = items.find(
                (item) => matchFn(item) && item.source === 'XPHB',
            );
            if (result) return result;
        }
        if (allowedSources.has('PHB')) {
            const result = items.find(
                (item) => matchFn(item) && item.source === 'PHB',
            );
            if (result) return result;
        }
        return (
            items.find(
                (item) =>
                    matchFn(item) &&
                    allowedSources.has(item.source?.toUpperCase()),
            ) || null
        );
    }

    async _loadSkillData() {
        if (this._skillData) return this._skillData;

        try {
            this._skillData = await skillService.getSkillData();
            return this._skillData;
        } catch (error) {
            console.error('[ProficiencyDescriptionService]', 'Failed to load skill data', error);
            this._skillData = [];
            return [];
        }
    }

    async _loadLanguageData() {
        if (this._languageData) return this._languageData;

        try {
            const data = await DataLoader.loadJSON('languages.json');
            this._languageData = data?.language || [];
            return this._languageData;
        } catch (error) {
            console.error(
                '[ProficiencyDescriptionService]',
                'Failed to load language data',
                error,
            );
            this._languageData = [];
            return [];
        }
    }

    async _loadBookData() {
        if (this._bookData) {
            return this._bookData;
        }

        try {
            const bookData = await DataLoader.loadJSON('book/book-phb.json');
            this._bookData = bookData || null;
            return this._bookData;
        } catch (error) {
            console.error('[ProficiencyDescriptionService]', 'Failed to load book data', error);
            return null;
        }
    }

    _findBookEntry(entries, name) {
        if (!entries || !Array.isArray(entries)) return null;

        for (const entry of entries) {
            if (entry.name === name) {
                return entry;
            }
            if (entry.entries) {
                const found = this._findBookEntry(entry.entries, name);
                if (found) return found;
            }
        }
        return null;
    }

    async getSkillDescription(skillName) {
        const skillData = await this._loadSkillData();
        if (!skillData || skillData.length === 0) return null;

        const normalizedSearch = TextProcessor.normalizeForLookup(skillName);
        const allowedSources = await this._getAllowedSourcesSet();

        const skill = this._findBySourcePriority(
            skillData,
            (s) => TextProcessor.normalizeForLookup(s.name) === normalizedSearch,
            allowedSources,
        );

        if (!skill) return null;

        return {
            name: skill.name,
            ability: skill.ability,
            description: skill.entries || [],
            source: skill.source,
            page: skill.page,
        };
    }

    async getStandardLanguages() {
        const languageData = await this._loadLanguageData();
        if (!languageData || languageData.length === 0) return [];

        const allowedSources = await this._getAllowedSourcesSet();

        const languageMap = new Map();

        for (const lang of languageData) {
            if (!allowedSources.has(lang.source?.toUpperCase())) continue;
            if (lang.type !== 'standard' && lang.type !== 'exotic') continue;

            const normalizedName = TextProcessor.normalizeForLookup(lang.name);

            if (!languageMap.has(normalizedName)) {
                languageMap.set(normalizedName, lang.name);
            } else if (lang.source === 'XPHB') {
                languageMap.set(normalizedName, lang.name);
            }
        }

        return Array.from(languageMap.values()).sort();
    }

    async getLanguageDescription(languageName) {
        const languageData = await this._loadLanguageData();
        if (!languageData || languageData.length === 0) return null;

        const normalizedSearch = TextProcessor.normalizeForLookup(languageName);
        const allowedSources = await this._getAllowedSourcesSet();

        const language = this._findBySourcePriority(
            languageData,
            (l) => TextProcessor.normalizeForLookup(l.name) === normalizedSearch,
            allowedSources,
        );

        if (!language) return null;

        return {
            name: language.name,
            type: language.type || 'standard',
            script: language.script,
            typicalSpeakers: language.typicalSpeakers || [],
            entries: language.entries || [],
            source: language.source,
            page: language.page,
        };
    }

    async getToolDescription(toolName) {
        const items = itemService.getAllItems();
        if (!items || items.length === 0) {
            console.warn('[ProficiencyDescriptionService]', 'No items available for tool lookup');
            return {
                name: toolName,
                description: `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
                type: 'tool',
            };
        }

        const normalizedSearch = TextProcessor.normalizeForLookup(toolName);
        const allowedSources = await this._getAllowedSourcesSet();

        const isToolType = (type) => {
            if (!type) return false;
            const typeStr = String(type);
            return (
                typeStr === 'AT' ||
                typeStr === 'T' ||
                typeStr === 'GS' ||
                typeStr === 'INS' ||
                typeStr.includes('AT') ||
                typeStr.includes('T|') ||
                typeStr.includes('GS') ||
                typeStr.includes('INS')
            );
        };

        const tool = this._findBySourcePriority(
            items,
            (item) =>
                TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
                isToolType(item.type),
            allowedSources,
        );

        if (!tool) {
            return {
                name: toolName,
                description: [
                    `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
                ],
                type: 'tool',
            };
        }

        let description = tool.entries || tool.additionalEntries || [];

        if (!description || description.length === 0) {
            description = [
                `Proficiency with ${tool.name.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
            ];
        }

        return {
            name: tool.name,
            description,
            type: 'tool',
            source: tool.source,
            page: tool.page,
        };
    }

    async getArmorDescription(armorName) {
        const baseItems = itemService.getAllBaseItems();

        const armorCategories = {
            'Light Armor': 'LA',
            'Medium Armor': 'MA',
            'Heavy Armor': 'HA',
            Shields: 'S',
        };

        const typeCode = armorCategories[armorName];

        if (typeCode) {
            const bookData = await this._loadBookData();
            const categoryInfo = bookData ? this._findBookEntry(bookData.data, armorName) : null;

            const examples = baseItems
                .filter(
                    (item) =>
                        (item.type === typeCode || item.type === `${typeCode}|XPHB`) &&
                        item.armor,
                )
                .slice(0, 3)
                .map((item) => item.name);

            return {
                name: armorName,
                description:
                    categoryInfo?.entries ||
                    (examples.length > 0
                        ? `You are proficient with ${armorName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
                        : `You are proficient with ${armorName.toLowerCase()}.`),
                type: 'armor',
                source: categoryInfo?.source,
                page: categoryInfo?.page,
            };
        }

        const normalizedSearch = TextProcessor.normalizeForLookup(armorName);
        let armor = baseItems.find(
            (item) =>
                TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
                item.armor &&
                item.source === 'XPHB',
        );

        if (!armor) {
            armor = baseItems.find(
                (item) =>
                    TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
                    item.armor,
            );
        }

        if (!armor) {
            return {
                name: armorName,
                description: `You are proficient with ${armorName.toLowerCase()}.`,
                type: 'armor',
            };
        }

        return {
            name: armor.name,
            description:
                armor.entries?.join(' ') ||
                `You are proficient with ${armor.name.toLowerCase()}.`,
            ac: armor.ac,
            weight: armor.weight,
            type: 'armor',
            source: armor.source,
            page: armor.page,
        };
    }

    async getWeaponDescription(weaponName) {
        const baseItems = itemService.getAllBaseItems();

        if (weaponName === 'Simple Weapons' || weaponName === 'Martial Weapons') {
            const bookData = await this._loadBookData();
            const weaponProfEntry = bookData ? this._findBookEntry(bookData.data, 'Weapon Proficiency') : null;
            const categoryInfo = weaponProfEntry ? {
                name: weaponName,
                entries: weaponProfEntry.entries || [],
                source: 'PHB',
                page: weaponProfEntry.page,
            } : null;

            const category = weaponName === 'Simple Weapons' ? 'simple' : 'martial';
            const examples = baseItems
                .filter((item) => item.weaponCategory === category && item.weapon)
                .slice(0, 5)
                .map((item) => item.name);

            return {
                name: weaponName,
                description:
                    categoryInfo?.entries ||
                    (examples.length > 0
                        ? `You are proficient with ${weaponName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
                        : `You are proficient with ${weaponName.toLowerCase()}.`),
                type: 'weapon',
                source: categoryInfo?.source,
                page: categoryInfo?.page,
            };
        }

        const normalizedSearch = TextProcessor.normalizeForLookup(weaponName);
        let weapon = baseItems.find(
            (item) =>
                TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
                item.weapon &&
                item.source === 'XPHB',
        );

        if (!weapon) {
            weapon = baseItems.find(
                (item) =>
                    TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
                    item.weapon,
            );
        }

        if (!weapon) {
            return {
                name: weaponName,
                description: `You are proficient with ${weaponName.toLowerCase()}.`,
                type: 'weapon',
            };
        }

        const properties = [];
        if (weapon.dmg1)
            properties.push(`Damage: ${weapon.dmg1} ${weapon.dmgType}`);
        if (weapon.range) properties.push(`Range: ${weapon.range}`);
        if (weapon.weight) properties.push(`Weight: ${weapon.weight} lb.`);

        const description =
            weapon.entries?.join(' ') ||
            (properties.length > 0
                ? `${weapon.name} (${properties.join(', ')})`
                : `You are proficient with ${weapon.name.toLowerCase()}.`);

        return {
            name: weapon.name,
            description,
            damage: weapon.dmg1,
            damageType: weapon.dmgType,
            weaponCategory: weapon.weaponCategory,
            type: 'weapon',
            source: weapon.source,
            page: weapon.page,
        };
    }

    async getSavingThrowInfo() {
        const bookData = await this._loadBookData();
        if (!bookData) return null;

        const entry = this._findBookEntry(bookData.data, 'Saving Throws');
        if (!entry) return null;

        return {
            name: entry.name,
            entries: entry.entries || [],
            source: 'PHB',
            page: entry.page,
        };
    }
}

export const proficiencyDescriptionService = new ProficiencyDescriptionService();
