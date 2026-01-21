import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

/**
 * DeityService - Manages deity data from 5etools
 */
class DeityService extends BaseDataService {
    constructor() {
        super({
            cacheKey: 'deities',
            loadEvent: 'deities:loaded',
            loggerScope: 'DeityService',
        });
        this.deities = [];
    }

    /**
     * Initialize deity data
     */
    async initialize() {
        console.debug('[DeityService]', 'Initializing deity data');

        try {
            // Try to hydrate from cache first
            const cached = this.hydrateFromCache();
            if (cached) {
                this.deities = cached.deities || [];
                console.debug('[DeityService]', 'Deities loaded from cache', {
                    count: this.deities.length,
                });
                return;
            }

            // Load from JSON
            const data = await DataLoader.loadJSON('deities.json');
            if (!data?.deity) {
                console.warn('[DeityService]', 'No deity data found');
                return;
            }

            // Store raw deity data
            this.deities = data.deity;

            // Cache the data
            this.setData({ deities: this.deities });

            console.debug('[DeityService]', 'Deities loaded successfully', {
                count: this.deities.length,
                fromCache: false,
            });
        } catch (error) {
            console.error('[DeityService]', 'Failed to load deity data', error);
            throw error;
        }
    }

    /**
     * Get all deities
     * @returns {Array} Array of deity objects
     */
    getAllDeities() {
        return this.deities || [];
    }

    /**
     * Get unique deity names sorted alphabetically
     * @returns {Array<string>} Array of unique deity names
     */
    getDeityNames() {
        const names = new Set();
        for (const deity of this.deities) {
            if (deity.name) {
                names.add(deity.name);
            }
        }
        return Array.from(names).sort();
    }

    /**
     * Get deities by pantheon
     * @param {string} pantheon - Pantheon name (e.g., "Faerûnian", "Greek", "Norse")
     * @returns {Array} Array of deity objects
     */
    getByPantheon(pantheon) {
        return this.deities.filter((d) => d.pantheon === pantheon);
    }

    /**
     * Search deities by name
     * @param {string} query - Search query
     * @returns {Array} Array of matching deity objects
     */
    searchByName(query) {
        if (!query) return [];
        const lowerQuery = query.toLowerCase();
        return this.deities.filter((d) =>
            d.name?.toLowerCase().includes(lowerQuery),
        );
    }

    /**
     * Get deity by exact name
     * @param {string} name - Deity name
     * @returns {Object|null} Deity object or null
     */
    getByName(name) {
        return this.deities.find((d) => d.name === name) || null;
    }
}

// Singleton instance
export const deityService = new DeityService();
