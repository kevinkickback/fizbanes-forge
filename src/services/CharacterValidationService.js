/**
 * Validates character completeness and detects missing choices using 5etools data.
 *
 * Error strategy: LOG-and-continue. Validation issues are collected and returned
 * as arrays, never thrown, because partial validation results are still useful.
 */

import { classService } from './ClassService.js';
import { progressionValidatorService } from './ProgressionValidatorService.js';
import { spellValidatorService } from './SpellValidatorService.js';

class CharacterValidationService {
	constructor() {
		this.loggerScope = 'CharacterValidationService';
	}

	/** Validate character completeness and return detailed report of missing choices. */
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
		report.isValid = Object.values(report.missing).every(
			(arr) => arr.length === 0,
		);

		console.debug(`[${this.loggerScope}]`, 'Validation complete', {
			isValid: report.isValid,
			missingCount: Object.values(report.missing).reduce(
				(sum, arr) => sum + arr.length,
				0,
			),
		});

		return report;
	}

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

		// Delegate to focused validators
		progressionValidatorService.checkSubclass(character, classEntry, classData, report);

		if (classData.spellcastingAbility) {
			spellValidatorService.checkSpells(character, classEntry, classData, report);
		}

		progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);
		progressionValidatorService.checkASIs(character, classEntry, classData, report);
	}

	/** @returns {string[]} Array of summary messages */
	getSummary(report) {
		const messages = [];

		if (report.missing.subclasses.length > 0) {
			messages.push(
				`Missing subclass choices: ${report.missing.subclasses.length}`,
			);
		}
		if (report.missing.spells.length > 0) {
			const totalMissing = report.missing.spells.reduce(
				(sum, s) => sum + (s.missing || 0),
				0,
			);
			messages.push(`Missing spells: ${totalMissing}`);
		}
		if (report.missing.invocations.length > 0) {
			const totalMissing = report.missing.invocations.reduce(
				(sum, i) => sum + (i.missing || 0),
				0,
			);
			messages.push(`Missing invocations: ${totalMissing}`);
		}
		if (report.missing.metamagic.length > 0) {
			const totalMissing = report.missing.metamagic.reduce(
				(sum, m) => sum + (m.missing || 0),
				0,
			);
			messages.push(`Missing metamagic: ${totalMissing}`);
		}
		if (report.missing.fightingStyles.length > 0) {
			messages.push(
				`Missing fighting styles: ${report.missing.fightingStyles.length}`,
			);
		}
		if (report.missing.pactBoons.length > 0) {
			messages.push(`Missing pact boons: ${report.missing.pactBoons.length}`);
		}
		if (report.missing.other.length > 0) {
			messages.push(`Other incomplete choices: ${report.missing.other.length}`);
		}

		return messages;
	}

	/** @returns {Object} Summary with counts and messages */
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
			summary.messages.push(
				`${report.missing.subclasses.length} subclass choice${report.missing.subclasses.length > 1 ? 's' : ''}`,
			);
		}

		// Count ASI/Feat choices
		if (report.missing.asis.length > 0) {
			const totalASIs = report.missing.asis.reduce(
				(sum, a) => sum + (a.expectedCount || 0),
				0,
			);
			summary.byCategory.asis = totalASIs;
			summary.total += totalASIs;
			summary.messages.push(
				`${totalASIs} ASI/Feat choice${totalASIs > 1 ? 's' : ''}`,
			);
		}

		// Count spell choices
		if (report.missing.spells.length > 0) {
			const totalSpells = report.missing.spells.reduce(
				(sum, s) => sum + (s.missing || 0),
				0,
			);
			summary.byCategory.spells = totalSpells;
			summary.total += totalSpells;
			summary.messages.push(
				`${totalSpells} spell${totalSpells > 1 ? 's' : ''}`,
			);
		}

		// Count class feature choices
		const featureTypes = [
			'invocations',
			'metamagic',
			'fightingStyles',
			'pactBoons',
		];
		let totalFeatures = 0;
		for (const type of featureTypes) {
			if (report.missing[type].length > 0) {
				const count = report.missing[type].reduce(
					(sum, f) => sum + (f.missing || 1),
					0,
				);
				totalFeatures += count;
			}
		}
		if (totalFeatures > 0) {
			summary.byCategory.features = totalFeatures;
			summary.total += totalFeatures;
			summary.messages.push(
				`${totalFeatures} class feature choice${totalFeatures > 1 ? 's' : ''}`,
			);
		}

		// Add other choices
		if (report.missing.other.length > 0) {
			summary.byCategory.other = report.missing.other.length;
			summary.total += report.missing.other.length;
		}

		return summary;
	}

	/** Used by build page to show pending choices for each class card */
	getMissingChoicesForClass(character, className) {
		const report = this.validateCharacter(character);

		const classChoices = {
			subclass: null,
			features: [],
			spells: null,
			asi: null,
		};

		// Filter subclass choices
		const subclassChoice = report.missing.subclasses.find(
			(s) => s.class === className,
		);
		if (subclassChoice) {
			classChoices.subclass = subclassChoice;
		}

		// Filter ASI choices
		const asiChoice = report.missing.asis.find((a) => a.class === className);
		if (asiChoice) {
			classChoices.asi = asiChoice;
		}

		// Filter spell choices
		const spellChoice = report.missing.spells.find(
			(s) => s.class === className,
		);
		if (spellChoice) {
			classChoices.spells = spellChoice;
		}

		// Collect all feature choices for this class
		const featureTypes = [
			'invocations',
			'metamagic',
			'fightingStyles',
			'pactBoons',
			'other',
		];
		for (const type of featureTypes) {
			const choices = report.missing[type].filter((f) => f.class === className);
			classChoices.features.push(...choices);
		}

		return classChoices;
	}
}

// Export singleton instance
export const characterValidationService = new CharacterValidationService();
