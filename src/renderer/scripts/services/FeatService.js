/** @file Feat service for managing feat data. */

import { DataLoader } from '../utils/DataLoader.js';

/** Manages feat data and provides access to feats. */
class FeatService {
    /** Initialize a new FeatService instance. */
    constructor() {
        this._featData = null;
        this._featMap = null; // Map for O(1) lookups by name (case-insensitive)
    }

    /**
     * Initialize feat data by loading from DataLoader
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async initialize() {
        // Skip if already initialized
        if (this._featData) {
            console.debug('FeatService', 'Already initialized');
            return true;
        }

        console.info('[FeatService]', 'Initializing feat data');

        try {
            this._featData = await DataLoader.loadFeats();
            console.info('[FeatService]', 'Feats loaded successfully', {
                count: this._featData.feat?.length,
            });

            // Build lookup map for O(1) access by name (case-insensitive)
            this._featMap = new Map();
            if (this._featData.feat && Array.isArray(this._featData.feat)) {
                for (const feat of this._featData.feat) {
                    if (!feat.name) continue;
                    const key = feat.name.toLowerCase();
                    this._featMap.set(key, feat);
                }
            }

            return true;
        } catch (error) {
            console.error('[FeatService]', 'Failed to initialize feat data', error);
            return false;
        }
    }

    /**
     * Get all available feats
     * @returns {Array<Object>} Array of feat objects
     */
    getAllFeats() {
        return this._featData?.feat || [];
    }

    /**
     * Get a specific feat by name (case-insensitive)
     * @param {string} featName - Feat name
     * @returns {Object|null} Feat object or null if not found
     */
    getFeat(featName) {
        if (!this._featMap) return null;
        return this._featMap.get(featName.toLowerCase()) || null;
    }
}

export const featService = new FeatService();
