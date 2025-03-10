/**
 * Characteristic.js
 * Model class for character background characteristics
 */

export class Characteristic {
    constructor(data) {
        this.type = data.type; // personalityTrait, ideal, bond, flaw
        this.value = data.value;
        this.source = data.source || 'Background';
        this.index = data.index; // Original index in the background's characteristic list
    }

    toJSON() {
        return {
            type: this.type,
            value: this.value,
            source: this.source,
            index: this.index
        };
    }

    static fromBackground(type, value, index) {
        return new Characteristic({
            type,
            value,
            source: 'Background',
            index
        });
    }
} 