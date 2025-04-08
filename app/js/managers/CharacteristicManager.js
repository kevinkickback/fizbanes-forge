/**
 * CharacteristicManager.js
 * Manager class for handling character background characteristics
 */

import { Characteristic } from '../models/Characteristic.js';
import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages character background characteristics like personality traits, ideals, bonds, and flaws
 */
export class CharacteristicManager {
    /**
     * Creates a new CharacteristicManager
     * @param {Character} character - The character this manager belongs to
     */
    constructor(character) {
        /**
         * The character this manager belongs to
         * @type {Character}
         * @private
         */
        this._character = character;

        /**
         * The character's characteristics
         * @type {Object<string, Characteristic>}
         * @private
         */
        this._characteristics = {
            personalityTrait: null,
            ideal: null,
            bond: null,
            flaw: null
        };
    }

    /**
     * Sets a characteristic of the specified type
     * @param {string} type - The characteristic type (personalityTrait, ideal, bond, flaw)
     * @param {string} value - The characteristic value
     * @param {number} index - The index of the characteristic in the background's list
     * @returns {boolean} True if the characteristic was set successfully
     */
    setCharacteristic(type, value, index) {
        if (Object.prototype.hasOwnProperty.call(this._characteristics, type)) {
            this._characteristics[type] = Characteristic.fromBackground(type, value, index);
            eventEmitter.emit('character:characteristicChanged', { type, value, character: this._character });
            return true;
        }
        return false;
    }

    /**
     * Gets a characteristic of the specified type
     * @param {string} type - The characteristic type (personalityTrait, ideal, bond, flaw)
     * @returns {Characteristic|null} The characteristic or null if not set
     */
    getCharacteristic(type) {
        return this._characteristics[type];
    }

    /**
     * Gets all characteristics
     * @returns {Object<string, Characteristic>} All characteristics
     */
    getAllCharacteristics() {
        return { ...this._characteristics };
    }

    /**
     * Clears all characteristics
     */
    clearCharacteristics() {
        for (const key of Object.keys(this._characteristics)) {
            this._characteristics[key] = null;
        }
        eventEmitter.emit('character:characteristicsCleared', { character: this._character });
    }

    /**
     * Gets characteristic options for a background
     * @param {string} backgroundId - The background ID
     * @returns {Promise<Object|null>} The background's characteristics or null if background not found
     */
    async getCharacteristicOptions(backgroundId) {
        if (!backgroundId) return null;

        const background = await this._character.backgroundManager.loadBackground(backgroundId);
        if (!background) return null;

        return background.characteristics;
    }

    /**
     * Converts this object to JSON for serialization
     * @returns {Object} JSON representation
     */
    toJSON() {
        const json = {};
        for (const [key, value] of Object.entries(this._characteristics)) {
            json[key] = value ? value.toJSON() : null;
        }
        return json;
    }
} 