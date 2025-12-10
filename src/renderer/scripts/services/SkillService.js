/** @file Skill service for managing skill data. */

import { DataLoader } from '../utils/DataLoader.js';
import DataNormalizer from '../utils/DataNormalizer.js';

/** Manages skill data and provides access to skills. */
class SkillService {
    /** Initialize a new SkillService instance. */
    constructor() {
        this._skillData = null;
        this._skillMap = null; // Map for O(1) lookups by name (case-insensitive)
    }

    /**
     * Initialize skill data by loading from DataLoader
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async initialize() {
        // Skip if already initialized
        if (this._skillData) {
            console.debug('[SkillService]', 'Already initialized');
            return true;
        }

        console.info('[SkillService]', 'Initializing skill data'); try {
            this._skillData = await DataLoader.loadSkills();
            console.info('[SkillService]', 'Skills loaded successfully', {
                count: this._skillData.skill?.length,
            });

            // Build lookup map for O(1) access by name (case-insensitive)
            this._skillMap = new Map();
            if (this._skillData.skill && Array.isArray(this._skillData.skill)) {
                for (const skill of this._skillData.skill) {
                    if (!skill.name) continue;
                    const key = DataNormalizer.normalizeForLookup(skill.name);
                    this._skillMap.set(key, skill);
                }
            }

            return true;
        } catch (error) {
            console.error('[SkillService]', 'Failed to initialize skill data', error);
            return false;
        }
    }

    /**
     * Get all available skills
     * @returns {Array<Object>} Array of skill objects
     */
    getAllSkills() {
        return this._skillData?.skill || [];
    }

    /**
     * Get a specific skill by name (case-insensitive)
     * @param {string} skillName - Skill name
     * @returns {Object|null} Skill object or null if not found
     */
    getSkill(skillName) {
        if (!this._skillMap) return null;
        return this._skillMap.get(DataNormalizer.normalizeForLookup(skillName)) || null;
    }
}

export const skillService = new SkillService();
