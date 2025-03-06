export class AttunementManager {
    constructor(character) {
        this.character = character;
        this.attuned = new Set();
        this.maxAttunedItems = 3;
    }

    async attuneItem(itemId) {
        // Check if we can attune to more items
        if (this.attuned.size >= this.maxAttunedItems) {
            return false;
        }

        // Get the item from inventory
        const item = this.character.inventory.getItem(itemId);
        if (!item || !item.item.attunement || this.attuned.has(itemId)) {
            return false;
        }

        // Check prerequisites if any
        if (item.item.attunementPrerequisites) {
            if (!this.checkAttunementPrerequisites(item.item)) {
                return false;
            }
        }

        this.attuned.add(itemId);
        return true;
    }

    unattuneItem(itemId) {
        if (!this.attuned.has(itemId)) {
            return false;
        }

        this.attuned.delete(itemId);
        return true;
    }

    isAttuned(itemId) {
        return this.attuned.has(itemId);
    }

    getAttunedItems() {
        return Array.from(this.attuned)
            .map(id => this.character.inventory.getItem(id))
            .filter(Boolean);
    }

    getAvailableAttunementSlots() {
        return this.maxAttunedItems - this.attuned.size;
    }

    checkAttunementPrerequisites(item) {
        if (!item.attunementPrerequisites) return true;

        for (const prereq of item.attunementPrerequisites) {
            switch (prereq.type) {
                case 'class':
                    if (!this.character.hasClass(prereq.class)) return false;
                    break;
                case 'spellcaster':
                    if (!this.character.isSpellcaster()) return false;
                    break;
                case 'alignment':
                    if (this.character.alignment !== prereq.alignment) return false;
                    break;
                case 'race':
                    if (!this.character.hasRace(prereq.race)) return false;
                    break;
                // Add other prerequisite types as needed
            }
        }

        return true;
    }

    clear() {
        this.attuned.clear();
    }

    async fromJSON(data) {
        this.clear();
        if (data?.attunedItems) {
            for (const itemId of data.attunedItems) {
                await this.attuneItem(itemId);
            }
        }
    }

    toJSON() {
        return {
            attunedItems: Array.from(this.attuned)
        };
    }
} 