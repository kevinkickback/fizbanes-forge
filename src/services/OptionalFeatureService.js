import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

class OptionalFeatureService extends BaseDataService {
	constructor() {
		super('optionalfeatures');
	}

	async initialize() {
		const TTL_24_HOURS = 24 * 60 * 60 * 1000;
		await this.initWithLoader(
			async () => {
				console.debug(
					'[OptionalFeatureService]',
					'Initializing optional feature data',
				);

				// Load main optionalfeatures data
				const optionalfeaturesData = await DataLoader.loadJSON(
					'optionalfeatures.json',
					{ ttl: TTL_24_HOURS },
				);

				// Load fluff data
				const fluffData = await DataLoader.loadJSON(
					'fluff-optionalfeatures.json',
					{ ttl: TTL_24_HOURS },
				);

				// Merge data
				const aggregated = {
					optionalfeature: optionalfeaturesData.optionalfeature || [],
					optionalfeatureFluff: fluffData.optionalfeatureFluff || [],
				};

				return aggregated;
			},
			{
				emitPayload: (data) => data?.optionalfeature || [],
			},
		);
	}

	getAllOptionalFeatures() {
		return this._data?.optionalfeature || [];
	}

	getFeaturesByType(featureTypes) {
		const types = Array.isArray(featureTypes) ? featureTypes : [featureTypes];
		return this.getAllOptionalFeatures().filter((feature) =>
			feature.featureType?.some((ft) => types.includes(ft)),
		);
	}

	meetsPrerequisites(feature, character, className = null) {
		if (!feature.prerequisite) return { met: true, reasons: [] };

		const reasons = [];

		for (const prereq of feature.prerequisite) {
			// Check level requirement
			if (prereq.level) {
				let charLevel = character.getTotalLevel();
				if (className) {
					if (character.progression?.classes) {
						const classEntry = character.progression.classes.find(
							(c) => c.name === className,
						);
						if (classEntry) {
							charLevel = classEntry.levels || 1;
						}
					}
					else if (character.classes) {
						const classEntry = character.classes.find(
							(c) => c.name === className,
						);
						if (classEntry) {
							charLevel = classEntry.level || classEntry.levels || 1;
						}
					}
				}
				const requiredLevel =
					typeof prereq.level === 'object'
						? prereq.level.level || 1
						: prereq.level;
				if (charLevel < requiredLevel) {
					reasons.push(`Requires ${className || 'character'} level ${requiredLevel}`);
				}
			}

			if (prereq.spell) {
				const requiredSpells = Array.isArray(prereq.spell)
					? prereq.spell
					: [prereq.spell];
				const missingSpells = requiredSpells.filter((spellRef) => {
					const spellName = spellRef.split('#')[0].split('|')[0].toLowerCase();

					if (character.spellcasting?.classes) {
						for (const classSpellcasting of Object.values(
							character.spellcasting.classes,
						)) {
							if (
								classSpellcasting.spellsKnown?.some(
									(s) => s.name.toLowerCase() === spellName,
								)
							) {
								return false;
							}
							if (
								classSpellcasting.cantrips?.some(
									(s) => s.name.toLowerCase() === spellName,
								)
							) {
								return false;
							}
							if (
								classSpellcasting.preparedSpells?.some(
									(s) => s.name.toLowerCase() === spellName,
								)
							) {
								return false;
							}
						}
					}
					return true;
				});

				if (missingSpells.length > 0) {
					const spellNames = missingSpells.map((spellRef) => {
						const spellName = spellRef.split('#')[0].split('|')[0];
						return spellName;
					}).join(', ');
					reasons.push(`Requires spell: ${spellNames}`);
				}
			}

			if (prereq.pact) {
				const hasPact = character.features?.some((f) =>
					f.name?.toLowerCase().includes(prereq.pact.toLowerCase()),
				);
				if (!hasPact) {
					reasons.push(`Requires ${prereq.pact}`);
				}
			}

			if (prereq.patron) {
				const hasPatron = character.features?.some((f) =>
					f.name?.toLowerCase().includes(prereq.patron.toLowerCase()),
				);
				if (!hasPatron) {
					reasons.push(`Requires patron: ${prereq.patron}`);
				}
			}
		}

		return { met: reasons.length === 0, reasons };
	}

	getFeatureByName(name, source = null) {
		const features = this.getAllOptionalFeatures();
		if (source) {
			return (
				features.find((f) => f.name === name && f.source === source) ||
				features.find((f) => f.name === name)
			);
		}
		return features.find((f) => f.name === name);
	}
}

// Export singleton instance
export const optionalFeatureService = new OptionalFeatureService();
