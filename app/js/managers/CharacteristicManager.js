/**
 * CharacteristicManager.js
 * Manager class for handling character background characteristics
 */

import { Characteristic } from '../models/Characteristic.js';

export class CharacteristicManager {
    constructor(character) {
        this.character = character;
        this.characteristics = {
            personalityTrait: null,
            ideal: null,
            bond: null,
            flaw: null
        };
    }

    setCharacteristic(type, value, index) {
        if (Object.prototype.hasOwnProperty.call(this.characteristics, type)) {
            this.characteristics[type] = Characteristic.fromBackground(type, value, index);
            return true;
        }
        return false;
    }

    getCharacteristic(type) {
        return this.characteristics[type];
    }

    getAllCharacteristics() {
        return { ...this.characteristics };
    }

    clearCharacteristics() {
        for (const key of Object.keys(this.characteristics)) {
            this.characteristics[key] = null;
        }
    }

    async getCharacteristicOptions(backgroundId) {
        if (!backgroundId) return null;

        const background = await this.character.backgroundManager.loadBackground(backgroundId);
        if (!background) return null;

        return background.characteristics;
    }

    toJSON() {
        const json = {};
        for (const [key, value] of Object.entries(this.characteristics)) {
            json[key] = value ? value.toJSON() : null;
        }
        return json;
    }
} 