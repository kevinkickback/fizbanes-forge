import { Spell } from '../models/Spell.js';

export class SpellcastingService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.spellCache = new Map();
    }

    async loadSpell(spellId) {
        // Check cache first
        if (this.spellCache.has(spellId)) {
            return this.spellCache.get(spellId);
        }

        // Load spell data
        const spells = await this.dataLoader.loadSpells();
        const spellData = spells.find(s => s.id === spellId);

        if (!spellData) {
            throw new Error(`Spell not found: ${spellId}`);
        }

        // Create spell instance
        const spell = new Spell(spellData);
        this.spellCache.set(spellId, spell);
        return spell;
    }

    async getSpellsForClass(classId, level = null) {
        const spells = await this.dataLoader.loadSpells();
        const filtered = spells.filter(s =>
            s.classes.includes(classId) &&
            (level === null || s.level === level)
        );
        return filtered.map(spellData => new Spell(spellData));
    }

    async getSpellsForSubclass(classId, subclassId, level = null) {
        const classSpells = await this.getSpellsForClass(classId, level);
        const subclassSpells = await this.dataLoader.loadSubclassSpells(subclassId);

        // Combine and filter spells
        const allSpells = [...classSpells];
        for (const spellData of subclassSpells) {
            if (level === null || spellData.level === level) {
                allSpells.push(new Spell(spellData));
            }
        }

        return allSpells;
    }

    // Spell slot management
    calculateSpellSlots(classLevel, spellcastingType = 'full') {
        const slots = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };

        // Calculate effective level based on spellcasting type
        let effectiveLevel = classLevel;
        switch (spellcastingType) {
            case 'half':
                effectiveLevel = Math.floor(classLevel / 2);
                break;
            case 'third':
                effectiveLevel = Math.floor(classLevel / 3);
                break;
            case 'artificer':
                effectiveLevel = Math.ceil(classLevel / 2);
                break;
        }

        // No slots if effective level is 0
        if (effectiveLevel < 1) return slots;

        // Calculate base slots based on effective level
        // 1st level slots
        if (effectiveLevel >= 1) {
            slots[1] = 2;
            if (effectiveLevel >= 2) slots[1]++;
            if (effectiveLevel >= 3) slots[1]++;
        }

        // 2nd level slots
        if (effectiveLevel >= 3) {
            slots[2] = 2;
            if (effectiveLevel >= 4) slots[2]++;
        }

        // 3rd level slots
        if (effectiveLevel >= 5) {
            slots[3] = 2;
            if (effectiveLevel >= 6) slots[3]++;
        }

        // 4th level slots
        if (effectiveLevel >= 7) {
            slots[4] = 1;
            if (effectiveLevel >= 8) slots[4]++;
            if (effectiveLevel >= 9) slots[4]++;
        }

        // 5th level slots
        if (effectiveLevel >= 9) {
            slots[5] = 1;
            if (effectiveLevel >= 10) slots[5]++;
            if (effectiveLevel >= 18) slots[5]++;
        }

        // 6th level slots
        if (effectiveLevel >= 11) {
            slots[6] = 1;
            if (effectiveLevel >= 19) slots[6]++;
        }

        // 7th level slots
        if (effectiveLevel >= 13) {
            slots[7] = 1;
            if (effectiveLevel >= 20) slots[7]++;
        }

        // 8th level slots
        if (effectiveLevel >= 15) {
            slots[8] = 1;
        }

        // 9th level slots
        if (effectiveLevel >= 17) {
            slots[9] = 1;
        }

        // Special case: Half and third casters can't get slots above 5th level
        if (spellcastingType === 'half' || spellcastingType === 'third') {
            slots[6] = 0;
            slots[7] = 0;
            slots[8] = 0;
            slots[9] = 0;
        }

        // Special case: Third casters can't get slots above 4th level
        if (spellcastingType === 'third') {
            slots[5] = 0;
        }

        return slots;
    }

    // Spell validation
    async validateSpellForClass(spellId, classId, level) {
        const spell = await this.loadSpell(spellId);
        return spell.isAvailableToClass(classId) && spell.level <= level;
    }

    // Component validation
    async validateSpellComponents(spellId, hasComponent) {
        const spell = await this.loadSpell(spellId);
        const required = spell.getComponents();

        for (const component of required) {
            if (!hasComponent(component)) {
                return false;
            }
        }

        return true;
    }

    // Concentration validation
    async validateConcentration(spellId, activeSpells) {
        const spell = await this.loadSpell(spellId);

        if (!spell.requiresConcentration()) {
            return true;
        }

        // Check if any active spell requires concentration
        for (const activeSpellId of activeSpells) {
            const activeSpell = await this.loadSpell(activeSpellId);
            if (activeSpell.requiresConcentration()) {
                return false;
            }
        }

        return true;
    }

    clearCache() {
        this.spellCache.clear();
    }
} 