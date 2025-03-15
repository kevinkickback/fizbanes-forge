/**
 * SpellManager.js
 * Manages spellcasting functionality for a character
 */

import { TextProcessor } from '../utils/TextProcessor.js';
import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';
import { Spell } from '../models/Spell.js';
import { characterInitializer } from '../utils/Initialize.js';
import { showNotification } from '../utils/notifications.js';
import { markUnsavedChanges } from '../utils/characterHandler.js';

export class SpellManager {
    constructor(character) {
        this.character = character;
        this.dataLoader = characterInitializer.dataLoader;
        this.knownSpells = new Set();
        this.preparedSpells = new Set();
        this.spellSlots = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };
        this.slotsUsed = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };
        this.cantripCount = 0;
        this.spellCache = new Map(); // Cache for loaded spells
    }

    async loadSpells() {
        try {
            return await this.dataLoader.loadSpells();
        } catch (error) {
            console.error('Error loading spells:', error);
            showNotification('Error loading spells', 'error');
            return [];
        }
    }

    addKnownSpell(spellId) {
        if (this.knownSpells.has(spellId)) {
            showNotification('Spell already known', 'warning');
            return false;
        }
        this.knownSpells.add(spellId);
        markUnsavedChanges();
        return true;
    }

    /**
     * Load a spell by ID
     * @param {string} spellId - The ID of the spell to load
     * @returns {Promise<Spell>} - The loaded spell
     */
    async loadSpell(spellId) {
        // Check cache first
        if (this.spellCache.has(spellId)) {
            return this.spellCache.get(spellId);
        }

        // Load spell data
        const spells = await this.loadSpells();
        const spellData = spells.find(s => s.id === spellId);

        if (!spellData) {
            throw new Error(`Spell not found: ${spellId}`);
        }

        // Create spell instance
        const spell = new Spell(spellData);
        this.spellCache.set(spellId, spell);
        return spell;
    }

    /**
     * Get all spells available for a class
     * @param {string} classId - The ID of the class
     * @param {number|null} level - Optional level filter
     * @returns {Promise<Spell[]>} - Array of available spells
     */
    async getSpellsForClass(classId, level = null) {
        const spells = await this.loadSpells();
        const filtered = spells.filter(s =>
            s.classes.includes(classId) &&
            (level === null || s.level === level)
        );
        return filtered.map(spellData => new Spell(spellData));
    }

    /**
     * Get all spells available for a subclass
     * @param {string} classId - The ID of the parent class
     * @param {string} subclassId - The ID of the subclass
     * @param {number|null} level - Optional level filter
     * @returns {Promise<Spell[]>} - Array of available spells
     */
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

    async addSpell(spellId) {
        try {
            // Load spell data
            const spells = await this.loadSpells();
            const spell = spells.find(s => s.id === spellId);
            if (!spell) {
                console.error(`Spell ${spellId} not found`);
                return false;
            }

            // Check if character can learn this spell
            if (!this.canLearnSpell(spell)) {
                console.error(`Character cannot learn spell ${spell.name}`);
                return false;
            }

            // Add to known spells
            this.knownSpells.set(spellId, spell);

            // If character automatically prepares spells (like a Cleric), also prepare it
            if (this.character.class?.autoPreparesSpells) {
                this.preparedSpells.add(spellId);
            }

            return true;
        } catch (error) {
            console.error('Error adding spell:', error);
            return false;
        }
    }

    removeSpell(spellId) {
        // Remove from known spells
        this.knownSpells.delete(spellId);
        // Remove from prepared spells if it was prepared
        this.preparedSpells.delete(spellId);
        return true;
    }

    prepareSpell(spellId) {
        // Check if spell is known
        if (!this.knownSpells.has(spellId)) {
            console.error(`Spell ${spellId} not known`);
            return false;
        }

        // Check if character can prepare more spells
        if (!this.canPrepareMoreSpells()) {
            console.error('Cannot prepare more spells');
            return false;
        }

        this.preparedSpells.add(spellId);
        return true;
    }

    unprepareSpell(spellId) {
        return this.preparedSpells.delete(spellId);
    }

    castSpell(spellId, level = null) {
        const spell = this.knownSpells.get(spellId);
        if (!spell) {
            console.error(`Spell ${spellId} not known`);
            return false;
        }

        // Check if spell needs to be prepared
        if (this.character.class?.requiresSpellPreparation && !this.preparedSpells.has(spellId)) {
            console.error(`Spell ${spell.name} not prepared`);
            return false;
        }

        // Handle cantrips
        if (spell.level === 0) return true;

        // Determine casting level
        const castingLevel = level || spell.level;
        if (castingLevel < spell.level) {
            console.error('Cannot cast spell at lower level than base level');
            return false;
        }

        // Check available slots
        if (this.slotsUsed[castingLevel] >= this.spellSlots[castingLevel]) {
            console.error(`No ${castingLevel}-level slots available`);
            return false;
        }

        // Use slot
        this.slotsUsed[castingLevel]++;
        return true;
    }

    restoreSpellSlot(level) {
        if (level < 1 || level > 9) return false;
        if (this.slotsUsed[level] > 0) {
            this.slotsUsed[level]--;
            return true;
        }
        return false;
    }

    longRest() {
        // Restore all spell slots
        for (let level = 1; level <= 9; level++) {
            this.slotsUsed[level] = 0;
        }
    }

    updateSpellSlots(classLevel, spellcastingType = 'full') {
        const slots = this.calculateSpellSlots(classLevel, spellcastingType);
        this.spellSlots = slots;
        // Reset used slots if they exceed new maximum
        for (let level = 1; level <= 9; level++) {
            if (this.slotsUsed[level] > this.spellSlots[level]) {
                this.slotsUsed[level] = this.spellSlots[level];
            }
        }
    }

    calculateSpellSlots(classLevel, spellcastingType) {
        const slots = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };

        // Early return for non-spellcasters or level 0
        if (classLevel < 1 || spellcastingType === 'none') return slots;

        // Calculate multiplier based on spellcasting type
        let multiplier = 1;
        switch (spellcastingType.toLowerCase()) {
            case 'full':
                multiplier = 1;
                break;
            case 'half':
                multiplier = 0.5;
                break;
            case 'third':
                multiplier = 1 / 3;
                break;
            default:
                return slots;
        }

        // Calculate effective level
        const effectiveLevel = Math.floor(classLevel * multiplier);
        if (effectiveLevel < 1) return slots;

        // Standard spell slot progression
        const progression = [
            // Level 1-20 spell slot progression
            [2],
            [3],
            [4, 2],
            [4, 3],
            [4, 3, 2],
            [4, 3, 3],
            [4, 3, 3, 1],
            [4, 3, 3, 2],
            [4, 3, 3, 3, 1],
            [4, 3, 3, 3, 2],
            [4, 3, 3, 3, 2, 1],
            [4, 3, 3, 3, 2, 1],
            [4, 3, 3, 3, 2, 1, 1],
            [4, 3, 3, 3, 2, 1, 1],
            [4, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 2, 1, 1, 1, 1],
            [4, 3, 3, 3, 3, 1, 1, 1, 1],
            [4, 3, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 3, 2, 2, 1, 1]
        ];

        // Get slot array for effective level
        const levelSlots = progression[effectiveLevel - 1] || [];

        // Fill slots object
        levelSlots.forEach((count, index) => {
            slots[index + 1] = count;
        });

        return slots;
    }

    canLearnSpell(spell) {
        // Check if spell exists
        if (!spell) return false;

        // Check if spell is appropriate for character's class
        if (!this.isSpellForClass(spell)) return false;

        // Check if character meets level requirements
        if (spell.level > 0 && !this.hasSpellSlots(spell.level)) return false;

        // Check if character has room for another cantrip
        if (spell.level === 0 && this.getCantripCount() >= this.getMaxCantrips()) {
            return false;
        }

        return true;
    }

    isSpellForClass(spell) {
        if (!this.character.class) return false;
        return spell.classes.some(c =>
            c.name.toLowerCase() === this.character.class.name.toLowerCase()
        );
    }

    hasSpellSlots(level) {
        return this.spellSlots[level] > 0;
    }

    getCantripCount() {
        return Array.from(this.knownSpells.values())
            .filter(spell => spell.level === 0)
            .length;
    }

    getMaxCantrips() {
        if (!this.character.class?.spellcasting) return 0;
        const level = this.character.level || 1;
        return this.character.class.spellcasting.cantripProgression[level - 1] || 0;
    }

    canPrepareMoreSpells() {
        if (!this.character.class?.requiresSpellPreparation) return true;

        const maxPrepared = this.getMaxPreparedSpells();
        return this.preparedSpells.size < maxPrepared;
    }

    getMaxPreparedSpells() {
        if (!this.character.class?.requiresSpellPreparation) return Number.POSITIVE_INFINITY;

        const level = this.character.level || 1;
        const modifier = this.character.getAbilityModifier(
            this.character.class.spellcasting.ability
        );

        return Math.max(1, level + modifier);
    }

    getKnownSpells() {
        return Array.from(this.knownSpells.values());
    }

    getPreparedSpells() {
        return Array.from(this.preparedSpells)
            .map(id => this.knownSpells.get(id))
            .filter(Boolean);
    }

    getSpellSlots() {
        return { ...this.spellSlots };
    }

    getSlotsRemaining() {
        const remaining = {};
        for (let level = 1; level <= 9; level++) {
            remaining[level] = this.spellSlots[level] - this.slotsUsed[level];
        }
        return remaining;
    }

    /**
     * Validate if a spell can be used by a class
     * @param {string} spellId - The ID of the spell
     * @param {string} classId - The ID of the class
     * @param {number} level - The class level
     * @returns {Promise<boolean>} - Whether the spell is valid for the class
     */
    async validateSpellForClass(spellId, classId, level) {
        const spell = await this.loadSpell(spellId);
        return spell.isAvailableToClass(classId) && spell.level <= level;
    }

    /**
     * Validate spell components
     * @param {string} spellId - The ID of the spell
     * @param {Function} hasComponent - Function to check if character has a component
     * @returns {Promise<boolean>} - Whether the components are valid
     */
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

    /**
     * Validate concentration requirements
     * @param {string} spellId - The ID of the spell to validate
     * @param {string[]} activeSpells - Array of active spell IDs
     * @returns {Promise<boolean>} - Whether concentration is valid
     */
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
} 