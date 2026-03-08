import { classService } from './ClassService.js';

class ProgressionValidatorService {
    checkSubclass(_character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        // Find subclass level from class features or default to 3
        let subclassLevel = 3;

        if (classData.subclassTitle) {
            const features = classData.classFeatures || [];
            for (let i = 0; i < features.length; i++) {
                const levelFeatures = features[i];
                if (Array.isArray(levelFeatures)) {
                    for (const feature of levelFeatures) {
                        if (
                            feature.gainSubclassFeature ||
                            (typeof feature === 'string' &&
                                feature.toLowerCase().includes('subclass'))
                        ) {
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

    checkClassFeatures(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        const features = classService.getClassFeatures(
            className,
            classLevel,
            classData.source || 'PHB',
        );

        for (const feature of features) {
            this._checkFeatureChoice(
                character,
                classEntry,
                feature,
                feature.level,
                report,
            );
        }
    }

    _checkFeatureChoice(character, classEntry, feature, level, report) {
        const className = classEntry.name;
        const featureName = feature.name || '';
        const featureText = JSON.stringify(feature).toLowerCase();

        // Detect Eldritch Invocations (Warlock)
        if (
            featureName.includes('Eldritch Invocations') ||
            featureName.includes('Invocation')
        ) {
            const expectedCount = this._parseChoiceCount(feature);
            const actualCount =
                character.invocations?.filter(
                    (i) => i.class === 'Warlock' || i.source === 'Warlock',
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

    checkASIs(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        const features = classService.getClassFeatures(
            className,
            classLevel,
            classData.source || 'PHB',
        );
        const asiLevels = features
            .filter(
                (f) =>
                    f.name?.includes('Ability Score Improvement') || f.name === 'ASI',
            )
            .map((f) => f.level);

        if (asiLevels.length === 0) return;

        const levelUps = character.progression?.levelUps || [];
        const usedASILevels = new Set();

        for (const levelUp of levelUps) {
            const hasAbilityChanges =
                levelUp.changedAbilities &&
                Object.keys(levelUp.changedAbilities).length > 0;
            const hasFeats = levelUp.appliedFeats && levelUp.appliedFeats.length > 0;

            if (hasAbilityChanges || hasFeats) {
                const toLevel = levelUp.toLevel || 0;
                if (asiLevels.includes(toLevel)) {
                    usedASILevels.add(toLevel);
                }
            }
        }

        const unusedASILevels = asiLevels.filter(
            (level) => !usedASILevels.has(level),
        );

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

    _parseChoiceCount(feature) {
        const text = JSON.stringify(feature).toLowerCase();

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

        if (text.includes('choose') || text.includes('select')) {
            return 1;
        }

        return 0;
    }
}

export const progressionValidatorService = new ProgressionValidatorService();
