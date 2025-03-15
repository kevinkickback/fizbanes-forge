/**
 * FeatManager.js
 * Manages feat-related functionality for the D&D Character Creator
 */

import { Feat } from '../models/Feat.js';
import { characterInitializer } from '../utils/Initialize.js';
import { showNotification } from '../utils/notifications.js';

export class FeatManager {
    constructor(character) {
        this.character = character;
        this.dataLoader = characterInitializer.dataLoader;
        this.feats = new Map();
        this.features = new Map();
        this.maxFeats = this.calculateMaxFeats();
        this.cache = {
            feats: null,
            features: null
        };
    }

    /**
     * Load all available feats
     * @returns {Promise<Array>} Array of processed feats
     */
    async loadFeats() {
        if (this.cache.feats) {
            return this.cache.feats;
        }

        try {
            const [feats, fluff] = await Promise.all([
                this.dataLoader.loadJsonFile('feats.json'),
                this.dataLoader.loadJsonFile('fluff-feats.json').catch(() => ({}))
            ]);

            // Process feats with their fluff data
            for (const feat of feats) {
                if (fluff[feat.id]) {
                    feat.fluff = fluff[feat.id];
                }
                this.feats.set(feat.id, feat);
            }

            this.cache.feats = Array.from(this.feats.values());
            return this.cache.feats;
        } catch (error) {
            console.error('Error loading feats:', error);
            showNotification('Error loading feats', 'error');
            return [];
        }
    }

    /**
     * Load all available optional features
     * @returns {Promise<Array>} Array of processed optional features
     */
    async loadFeatures() {
        if (this.cache.features) {
            return this.cache.features;
        }

        try {
            const [features, fluff] = await Promise.all([
                this.dataLoader.loadJsonFile('optionalfeatures.json'),
                this.dataLoader.loadJsonFile('fluff-optionalfeatures.json').catch(() => ({}))
            ]);

            // Process features with their fluff data
            for (const feature of features) {
                if (fluff[feature.id]) {
                    feature.fluff = fluff[feature.id];
                }
                this.features.set(feature.id, feature);
            }

            this.cache.features = Array.from(this.features.values());
            return this.cache.features;
        } catch (error) {
            console.error('Error loading features:', error);
            showNotification('Error loading features', 'error');
            return [];
        }
    }

    /**
     * Process raw feat data into a feat object
     * @param {Object} feat - Raw feat data
     * @param {Object} fluff - Optional fluff data
     * @returns {Object} Processed feat object
     */
    processFeat(feat, fluff = null) {
        return {
            id: `${feat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(feat.source || 'phb').toLowerCase()}`,
            name: feat.name,
            source: feat.source || 'PHB',
            page: feat.page,
            description: fluff?.entries?.[0] || '',
            prerequisite: this.processPrerequisites(feat.prerequisite),
            repeatable: feat.repeatable || false,
            ability: this.processAbilityScores(feat.ability),
            proficiencies: this.processProficiencies(feat.proficiency),
            spells: this.processSpells(feat.spells),
            features: this.processFeatures(feat.entries),
            fluff
        };
    }

    /**
     * Process raw optional feature data into a feature object
     * @param {Object} feature - Raw feature data
     * @param {Object} fluff - Optional fluff data
     * @returns {Object} Processed feature object
     */
    processFeature(feature, fluff = null) {
        return {
            id: `${feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(feature.source || 'phb').toLowerCase()}`,
            name: feature.name,
            source: feature.source || 'PHB',
            page: feature.page,
            description: fluff?.entries?.[0] || '',
            prerequisite: this.processPrerequisites(feature.prerequisite),
            type: feature.type || 'OPT',
            className: feature.className,
            level: feature.level,
            ability: this.processAbilityScores(feature.ability),
            proficiencies: this.processProficiencies(feature.proficiency),
            spells: this.processSpells(feature.spells),
            fluff
        };
    }

    /**
     * Process prerequisites data
     * @param {Object} prereq - Raw prerequisites data
     * @returns {Object} Processed prerequisites object
     */
    processPrerequisites(prereq) {
        if (!prereq) return null;

        return {
            ability: prereq.ability || null,
            proficiency: prereq.proficiency || null,
            level: prereq.level || null,
            spellcasting: prereq.spellcasting || false,
            feat: prereq.feat || null,
            class: prereq.class || null
        };
    }

    /**
     * Process ability scores data
     * @param {Object} ability - Raw ability scores data
     * @returns {Object} Processed ability scores object
     */
    processAbilityScores(ability) {
        if (!ability) return null;

        return Array.isArray(ability) ? ability.map(a => ({
            fixed: a.fixed || null,
            choose: a.choose ? {
                count: a.choose.count || 1,
                from: a.choose.from || [],
                amount: a.choose.amount || 1
            } : null
        })) : null;
    }

    /**
     * Process proficiencies data
     * @param {Object} proficiency - Raw proficiencies data
     * @returns {Object} Processed proficiencies object
     */
    processProficiencies(proficiency) {
        if (!proficiency) return null;

        return {
            armor: proficiency.armor || [],
            weapons: proficiency.weapons || [],
            tools: proficiency.tools || [],
            skills: proficiency.skills || []
        };
    }

    /**
     * Process spells data
     * @param {Object} spells - Raw spells data
     * @returns {Object} Processed spells object
     */
    processSpells(spells) {
        if (!spells) return null;

        return spells.map(spell => ({
            id: spell.id,
            ability: spell.ability,
            level: spell.level || 0,
            uses: spell.uses || -1,
            daily: spell.daily || null
        }));
    }

    /**
     * Process features data
     * @param {Array} entries - Raw features data
     * @returns {Array} Processed features array
     */
    processFeatures(entries) {
        if (!entries) return [];

        return entries.filter(entry => entry.type === 'entries' && entry.name).map(entry => ({
            name: entry.name,
            description: Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries
        }));
    }

    /**
     * Load a specific feat by ID
     * @param {string} featId - ID of the feat to load
     * @returns {Promise<Object>} Feat object
     */
    async loadFeat(featId) {
        const feats = await this.loadFeats();
        const feat = feats.find(f => f.id === featId);
        if (!feat) {
            throw new Error(`Feat not found: ${featId}`);
        }
        return feat;
    }

    /**
     * Load a specific optional feature by ID
     * @param {string} featureId - ID of the feature to load
     * @returns {Promise<Object>} Optional feature object
     */
    async loadFeature(featureId) {
        const features = await this.loadFeatures();
        const feature = features.find(f => f.id === featureId);
        if (!feature) {
            throw new Error(`Optional feature not found: ${featureId}`);
        }
        return feature;
    }

    /**
     * Calculate maximum number of feats available
     * @returns {number} Maximum number of feats
     */
    calculateMaxFeats() {
        // Base feat at level 1 if using optional rule
        let maxFeats = 1;

        // Additional feats from ASI levels (4, 8, 12, 16, 19)
        const asiLevels = [4, 8, 12, 16, 19];
        for (const level of asiLevels) {
            if (this.character.level >= level) {
                maxFeats++;
            }
        }

        // Additional feats from variant human or custom lineage
        if (this.character.race?.isVariantHuman || this.character.race?.isCustomLineage) {
            maxFeats++;
        }

        return maxFeats;
    }

    /**
     * Add a feat to the character
     * @param {string} featId - ID of the feat to add
     * @returns {Promise<boolean>} True if feat was added successfully
     */
    async addFeat(featId) {
        try {
            const feat = await this.loadFeat(featId);

            // Check prerequisites
            if (!this.checkPrerequisites(feat)) {
                console.warn(`Prerequisites not met for feat: ${featId}`);
                return false;
            }

            // Check if repeatable
            if (!feat.repeatable && this.feats.has(featId)) {
                console.warn(`Feat ${featId} is not repeatable`);
                return false;
            }

            // Check feat limit
            if (this.feats.size >= this.maxFeats) {
                console.warn('Maximum number of feats reached');
                return false;
            }

            // Add feat
            this.feats.set(featId, {
                feat,
                count: (this.feats.get(featId)?.count || 0) + 1
            });

            // Apply feat effects
            await this.applyFeatEffects(feat);

            return true;
        } catch (error) {
            console.error('Error adding feat:', error);
            return false;
        }
    }

    /**
     * Check if prerequisites are met for a feat
     * @param {Object} feat - Feat to check prerequisites for
     * @returns {boolean} True if prerequisites are met
     */
    checkPrerequisites(feat) {
        if (!feat.prerequisite) return true;

        for (const prereq of feat.prerequisite) {
            // Check ability score prerequisites
            if (prereq.ability) {
                for (const [ability, score] of Object.entries(prereq.ability)) {
                    if (this.character.getAbilityScore(ability) < score) {
                        return false;
                    }
                }
            }

            // Check proficiency prerequisites
            if (prereq.proficiency) {
                for (const prof of prereq.proficiency) {
                    if (!this.character.hasProficiency(prof.type, prof.name)) {
                        return false;
                    }
                }
            }

            // Check level prerequisites
            if (prereq.level && this.character.level < prereq.level) {
                return false;
            }

            // Check spellcasting prerequisites
            if (prereq.spellcasting && !this.character.hasSpellcasting) {
                return false;
            }
        }

        return true;
    }

    /**
     * Apply the effects of a feat
     * @param {Object} feat - Feat to apply effects for
     * @returns {Promise<void>}
     */
    async applyFeatEffects(feat) {
        // Apply ability score increases
        if (feat.ability) {
            for (const ability of feat.ability) {
                if (ability.fixed) {
                    for (const [abilityName, value] of Object.entries(ability.fixed)) {
                        this.character.addAbilityBonus(abilityName, value, 'Feat');
                    }
                } else if (ability.choose) {
                    // Store choice for UI
                    this.character.pendingChoices.featAbilityScores = {
                        count: ability.choose.count,
                        from: ability.choose.from,
                        amount: ability.choose.amount
                    };
                }
            }
        }

        // Apply proficiencies
        if (feat.proficiencies) {
            for (const [type, profs] of Object.entries(feat.proficiencies)) {
                for (const prof of profs) {
                    this.character.addProficiency(type, prof, 'Feat');
                }
            }
        }

        // Apply spells
        if (feat.spells) {
            for (const spell of feat.spells) {
                await this.character.spells.addSpell(spell.id, 'Feat');
            }
        }

        // Apply features
        if (feat.features) {
            for (const feature of feat.features) {
                this.character.addFeature('feat', feature.name, feature.description);
            }
        }
    }

    /**
     * Remove a feat from the character
     * @param {string} featId - ID of the feat to remove
     * @returns {boolean} True if feat was removed successfully
     */
    removeFeat(featId) {
        const featData = this.feats.get(featId);
        if (!featData) return false;

        if (featData.count > 1) {
            featData.count--;
            this.feats.set(featId, featData);
        } else {
            this.feats.delete(featId);
        }

        // Remove feat effects
        this.removeFeatEffects(featData.feat);

        return true;
    }

    /**
     * Remove the effects of a feat
     * @param {Object} feat - Feat to remove effects for
     */
    removeFeatEffects(feat) {
        // Remove ability score increases
        if (feat.ability) {
            this.character.clearAbilityBonuses('Feat');
        }

        // Remove proficiencies
        if (feat.proficiencies) {
            this.character.removeProficienciesBySource('Feat');
        }

        // Remove spells
        if (feat.spells) {
            this.character.spells.removeSpellsBySource('Feat');
        }

        // Remove features
        if (feat.features) {
            this.character.removeFeaturesBySource('feat');
        }
    }

    /**
     * Get all feats
     * @returns {Array} Array of feats with counts
     */
    getFeats() {
        return Array.from(this.feats.entries()).map(([id, data]) => ({
            ...data.feat,
            count: data.count
        }));
    }

    /**
     * Check if character has a feat
     * @param {string} featId - ID of the feat to check
     * @returns {boolean} True if character has the feat
     */
    hasFeat(featId) {
        return this.feats.has(featId);
    }

    /**
     * Get the count of a feat
     * @param {string} featId - ID of the feat to get count for
     * @returns {number} Number of times the feat has been taken
     */
    getFeatCount(featId) {
        return this.feats.get(featId)?.count || 0;
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.feats = null;
        this.cache.features = null;
    }
} 