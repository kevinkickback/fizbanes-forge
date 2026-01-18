/**
 * CharacterValidationService - Validates character completeness and detects missing choices
 * 
 * Uses 5etools JSON data to dynamically determine what choices are required at each level.
 * No hardcoded checks - all validation is data-driven from class progression tables.
 * Delegates to existing services to avoid code duplication.
 */

import { classService } from './ClassService.js';
import { spellSelectionService } from './SpellSelectionService.js';
import { spellService } from './SpellService.js';

class CharacterValidationServiceImpl {
    constructor() {
        this.loggerScope = 'CharacterValidationService';
    }

    /**
     * Validate character completeness and return detailed report of missing choices
     * @param {Object} character - Character object
     * @returns {Object} Validation report with missing choices by category
     */
    validateCharacter(character) {
        const report = {
            isValid: true,
            missing: {
                spells: [],
                invocations: [],
                metamagic: [],
                fightingStyles: [],
                pactBoons: [],
                subclasses: [],
                asis: [],
                features: [],
                other: [], // For any class-specific choices not categorized above
            },
            warnings: [],
        };

        if (!character || !character.progression?.classes) {
            report.isValid = false;
            report.warnings.push('Character has no class progression data');
            return report;
        }

        // Validate each class
        for (const classEntry of character.progression.classes) {
            this._validateClassProgression(character, classEntry, report);
        }

        // Check if any missing items were found
        report.isValid = Object.values(report.missing).every(arr => arr.length === 0);

        console.info(`[${this.loggerScope}]`, 'Validation complete', {
            isValid: report.isValid,
            missingCount: Object.values(report.missing).reduce((sum, arr) => sum + arr.length, 0),
        });

        return report;
    }

    /**
     * Validate a single class progression by reading from 5etools data
     * @private
     */
    _validateClassProgression(character, classEntry, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        if (classLevel === 0) return;

        // Get class data from service (which loads from 5etools JSON)
        const classData = classService.getClass(className);
        if (!classData) {
            report.warnings.push(`Unknown class: ${className}`);
            return;
        }

        // Check subclass selection based on class data
        this._checkSubclassFromData(character, classEntry, classData, report);

        // Check spellcasting if class has it
        if (classData.spellcastingAbility) {
            this._checkSpellsFromData(character, classEntry, classData, report);
        }

        // Check for class features with choices at each level
        this._checkClassFeaturesFromData(character, classEntry, classData, report);

        // Check ASI/Feat progression from class tables
        this._checkASIsFromData(character, classEntry, classData, report);
    }

    /**
     * Check subclass selection from class data
     * @private
     */
    _checkSubclassFromData(_character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        // Find subclass level from class features or default to 3
        let subclassLevel = 3;

        if (classData.subclassTitle) {
            // Parse class features to find when subclass is introduced
            const features = classData.classFeatures || [];
            for (let i = 0; i < features.length; i++) {
                const levelFeatures = features[i];
                if (Array.isArray(levelFeatures)) {
                    for (const feature of levelFeatures) {
                        if (feature.gainSubclassFeature ||
                            (typeof feature === 'string' && feature.toLowerCase().includes('subclass'))) {
                            subclassLevel = i + 1;
                            break;
                        }
                    }
                }
                if (subclassLevel !== 3) break;
            }
        }

        if (classLevel >= subclassLevel && !classEntry.subclass) {
            report.missing.subclasses.push({
                class: className,
                level: classLevel,
                requiredAt: subclassLevel,
                message: `${className} should have a ${classData.subclassTitle || 'subclass'} selected at level ${subclassLevel}`,
            });
        }
    }

    /**
     * Check spell selection from class spellcasting progression
     * @private
     */
    _checkSpellsFromData(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        // Get spellcasting info for this class
        const spellcasting = character.spellcasting?.classes?.[className];
        if (!spellcasting) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                message: `${className} spellcasting not initialized`,
            });
            return;
        }

        // Read spells known from class data
        const expectedSpellsKnown = this._getSpellsKnownFromClassTable(classData, classLevel);
        const actualSpellsKnown = spellcasting.spellsKnown?.length || 0;

        if (expectedSpellsKnown !== null && actualSpellsKnown < expectedSpellsKnown) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                expected: expectedSpellsKnown,
                actual: actualSpellsKnown,
                missing: expectedSpellsKnown - actualSpellsKnown,
                message: `${className} is missing ${expectedSpellsKnown - actualSpellsKnown} spells (has ${actualSpellsKnown}, should have ${expectedSpellsKnown})`,
            });
        }

        // Check cantrips
        const expectedCantrips = this._getCantripsKnownFromClassTable(classData, classLevel);
        const actualCantrips = spellcasting.spellsKnown?.filter(s => {
            const spell = spellService.getSpellByName(s);
            return spell?.level === 0;
        }).length || 0;

        if (expectedCantrips !== null && actualCantrips < expectedCantrips) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                type: 'cantrips',
                expected: expectedCantrips,
                actual: actualCantrips,
                missing: expectedCantrips - actualCantrips,
                message: `${className} is missing ${expectedCantrips - actualCantrips} cantrips`,
            });
        }
    }

    /**
     * Check class features from 5etools JSON data to find choices
     * Uses ClassService.getClassFeatures to avoid duplication
     * @private
     */
    _checkClassFeaturesFromData(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        // Get all features up to current level using ClassService
        const features = classService.getClassFeatures(className, classLevel, classData.source || 'PHB');

        // Check each feature for choices
        for (const feature of features) {
            this._checkFeatureChoice(character, classEntry, feature, feature.level, report);
        }
    }

    /**
     * Check if a specific feature requires a choice
     * @private
     */
    _checkFeatureChoice(character, classEntry, feature, level, report) {
        const className = classEntry.name;
        const featureName = feature.name || '';
        const featureText = JSON.stringify(feature).toLowerCase();

        // Detect Eldritch Invocations (Warlock)
        if (featureName.includes('Eldritch Invocations') || featureName.includes('Invocation')) {
            const expectedCount = this._parseChoiceCount(feature);
            const actualCount = character.invocations?.filter(i =>
                i.class === 'Warlock' || i.source === 'Warlock'
            ).length || 0;

            if (expectedCount > 0 && actualCount < expectedCount) {
                report.missing.invocations.push({
                    class: className,
                    level,
                    expected: expectedCount,
                    actual: actualCount,
                    missing: expectedCount - actualCount,
                    feature: featureName,
                    message: `${className} is missing ${expectedCount - actualCount} ${featureName}`,
                });
            }
        }

        // Detect Metamagic (Sorcerer)
        else if (featureName.includes('Metamagic')) {
            const expectedCount = this._parseChoiceCount(feature);
            const actualCount = character.metamagic?.length || 0;

            if (expectedCount > 0 && actualCount < expectedCount) {
                report.missing.metamagic.push({
                    class: className,
                    level,
                    expected: expectedCount,
                    actual: actualCount,
                    missing: expectedCount - actualCount,
                    feature: featureName,
                    message: `${className} is missing ${expectedCount - actualCount} ${featureName} options`,
                });
            }
        }

        // Detect Pact Boon (Warlock)
        else if (featureName.includes('Pact Boon')) {
            if (!classEntry.pactBoon) {
                report.missing.pactBoons.push({
                    class: className,
                    level,
                    feature: featureName,
                    message: `${className} should have a Pact Boon selected`,
                });
            }
        }

        // Detect Fighting Style
        else if (featureName.includes('Fighting Style')) {
            if (!classEntry.fightingStyle) {
                report.missing.fightingStyles.push({
                    class: className,
                    level,
                    feature: featureName,
                    message: `${className} should have a Fighting Style selected`,
                });
            }
        }

        // Generic choice detection
        else if (featureText.includes('choose') || featureText.includes('select')) {
            // This is a feature with choices - could track it
            const choiceCount = this._parseChoiceCount(feature);
            if (choiceCount > 0) {
                report.missing.other.push({
                    class: className,
                    level,
                    feature: featureName,
                    expectedChoices: choiceCount,
                    message: `${className} has a choice to make for ${featureName}`,
                });
            }
        }
    }

    /**
     * Check ASI/Feat choices from class table
     * Uses ClassService.getClassFeatures to find ASI levels
     * Checks progression.levelUps to see if ASI was actually used
     * @private
     */
    _checkASIsFromData(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        // Get all features using ClassService and find ASI levels
        const features = classService.getClassFeatures(className, classLevel, classData.source || 'PHB');
        const asiLevels = features
            .filter(f => f.name?.includes('Ability Score Improvement') || f.name === 'ASI')
            .map(f => f.level);

        if (asiLevels.length === 0) return;

        // Check progression history to see which ASI slots were used
        const levelUps = character.progression?.levelUps || [];
        const usedASILevels = new Set();

        for (const levelUp of levelUps) {
            // Check if this level-up used an ASI/feat
            const hasAbilityChanges = levelUp.changedAbilities && Object.keys(levelUp.changedAbilities).length > 0;
            const hasFeats = levelUp.appliedFeats && levelUp.appliedFeats.length > 0;

            if (hasAbilityChanges || hasFeats) {
                // Find which class level this corresponds to
                const toLevel = levelUp.toLevel || 0;
                if (asiLevels.includes(toLevel)) {
                    usedASILevels.add(toLevel);
                }
            }
        }

        // Find unused ASI levels
        const unusedASILevels = asiLevels.filter(level => !usedASILevels.has(level));

        if (unusedASILevels.length > 0) {
            report.missing.asis.push({
                class: className,
                level: classLevel,
                asiLevels: unusedASILevels,
                expectedCount: unusedASILevels.length,
                message: `${className} has ${unusedASILevels.length} unused ASI/Feat choice(s) at level(s) ${unusedASILevels.join(', ')}`,
            });
        }
    }

    /**
     * Parse feature data to determine how many choices are required
     * @private
     */
    _parseChoiceCount(feature) {
        const text = JSON.stringify(feature).toLowerCase();

        // Look for patterns like "choose 2", "gain 2", "select 1", etc.
        const patterns = [
            /choose (\d+)/,
            /gain (\d+)/,
            /select (\d+)/,
            /learn (\d+)/,
            /know (\d+)/,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }

        // If we find "choose" but no number, assume 1
        if (text.includes('choose') || text.includes('select')) {
            return 1;
        }

        return 0;
    }

    /**
     * Get spells known from class table using SpellSelectionService
     * @private
     */
    _getSpellsKnownFromClassTable(classData, level) {
        // Delegate to SpellSelectionService which already parses class progression
        const spellsKnown = spellSelectionService._getSpellsKnownLimit(classData.name, level);
        return spellsKnown > 0 ? spellsKnown : null;
    }

    /**
     * Get cantrips known from class table using SpellSelectionService
     * @private
     */
    _getCantripsKnownFromClassTable(classData, level) {
        // Delegate to SpellSelectionService which already parses cantrip progression
        const cantripsKnown = spellSelectionService._getCantripsKnown(classData.name, level);
        return cantripsKnown > 0 ? cantripsKnown : null;
    }

    /**
     * Get a human-readable summary of missing choices
     * @param {Object} report - Validation report
     * @returns {string[]} Array of summary messages
     */
    getSummary(report) {
        const messages = [];

        if (report.missing.subclasses.length > 0) {
            messages.push(`Missing subclass choices: ${report.missing.subclasses.length}`);
        }
        if (report.missing.spells.length > 0) {
            const totalMissing = report.missing.spells.reduce((sum, s) => sum + (s.missing || 0), 0);
            messages.push(`Missing spells: ${totalMissing}`);
        }
        if (report.missing.invocations.length > 0) {
            const totalMissing = report.missing.invocations.reduce((sum, i) => sum + (i.missing || 0), 0);
            messages.push(`Missing invocations: ${totalMissing}`);
        }
        if (report.missing.metamagic.length > 0) {
            const totalMissing = report.missing.metamagic.reduce((sum, m) => sum + (m.missing || 0), 0);
            messages.push(`Missing metamagic: ${totalMissing}`);
        }
        if (report.missing.fightingStyles.length > 0) {
            messages.push(`Missing fighting styles: ${report.missing.fightingStyles.length}`);
        }
        if (report.missing.pactBoons.length > 0) {
            messages.push(`Missing pact boons: ${report.missing.pactBoons.length}`);
        }
        if (report.missing.other.length > 0) {
            messages.push(`Other incomplete choices: ${report.missing.other.length}`);
        }

        return messages;
    }

    /**
     * Get pending choices summary for display in UI
     * Returns user-friendly summary with counts
     * @param {Object} character - Character object
     * @returns {Object} Summary with counts and messages
     */
    getPendingChoicesSummary(character) {
        const report = this.validateCharacter(character);

        const summary = {
            total: 0,
            byCategory: {},
            messages: [],
        };

        // Count subclass choices
        if (report.missing.subclasses.length > 0) {
            summary.byCategory.subclasses = report.missing.subclasses.length;
            summary.total += report.missing.subclasses.length;
            summary.messages.push(`${report.missing.subclasses.length} subclass choice${report.missing.subclasses.length > 1 ? 's' : ''}`);
        }

        // Count ASI/Feat choices
        if (report.missing.asis.length > 0) {
            const totalASIs = report.missing.asis.reduce((sum, a) => sum + (a.expectedCount || 0), 0);
            summary.byCategory.asis = totalASIs;
            summary.total += totalASIs;
            summary.messages.push(`${totalASIs} ASI/Feat choice${totalASIs > 1 ? 's' : ''}`);
        }

        // Count spell choices
        if (report.missing.spells.length > 0) {
            const totalSpells = report.missing.spells.reduce((sum, s) => sum + (s.missing || 0), 0);
            summary.byCategory.spells = totalSpells;
            summary.total += totalSpells;
            summary.messages.push(`${totalSpells} spell${totalSpells > 1 ? 's' : ''}`);
        }

        // Count class feature choices
        const featureTypes = ['invocations', 'metamagic', 'fightingStyles', 'pactBoons'];
        let totalFeatures = 0;
        for (const type of featureTypes) {
            if (report.missing[type].length > 0) {
                const count = report.missing[type].reduce((sum, f) => sum + (f.missing || 1), 0);
                totalFeatures += count;
            }
        }
        if (totalFeatures > 0) {
            summary.byCategory.features = totalFeatures;
            summary.total += totalFeatures;
            summary.messages.push(`${totalFeatures} class feature choice${totalFeatures > 1 ? 's' : ''}`);
        }

        // Add other choices
        if (report.missing.other.length > 0) {
            summary.byCategory.other = report.missing.other.length;
            summary.total += report.missing.other.length;
        }

        return summary;
    }

    /**
     * Get missing choices for a specific class
     * Used by build page to show pending choices for each class card
     * @param {Object} character - Character object
     * @param {string} className - Class name to check
     * @returns {Object} Missing choices scoped to this class
     */
    getMissingChoicesForClass(character, className) {
        const report = this.validateCharacter(character);

        const classChoices = {
            subclass: null,
            features: [],
            spells: null,
            asi: null,
        };

        // Filter subclass choices
        const subclassChoice = report.missing.subclasses.find(s => s.class === className);
        if (subclassChoice) {
            classChoices.subclass = subclassChoice;
        }

        // Filter ASI choices
        const asiChoice = report.missing.asis.find(a => a.class === className);
        if (asiChoice) {
            classChoices.asi = asiChoice;
        }

        // Filter spell choices
        const spellChoice = report.missing.spells.find(s => s.class === className);
        if (spellChoice) {
            classChoices.spells = spellChoice;
        }

        // Collect all feature choices for this class
        const featureTypes = ['invocations', 'metamagic', 'fightingStyles', 'pactBoons', 'other'];
        for (const type of featureTypes) {
            const choices = report.missing[type].filter(f => f.class === className);
            classChoices.features.push(...choices);
        }

        return classChoices;
    }
}

// Export singleton instance
export const characterValidationService = new CharacterValidationServiceImpl();
