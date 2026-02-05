// Manages recording and retrieval of character class progression choices

class ProgressionHistoryService {
	ensureInitialized(character) {
		if (!character.progressionHistory) {
			character.progressionHistory = {};
		}
	}

	recordChoices(character, className, level, choices) {
		this.ensureInitialized(character);

		if (!character.progressionHistory[className]) {
			character.progressionHistory[className] = {};
		}

		// Normalize level to string key
		const levelKey = String(level);

		character.progressionHistory[className][levelKey] = {
			choices: { ...choices },
			timestamp: new Date().toISOString(),
		};
	}

	getChoices(character, className, level) {
		if (!character.progressionHistory) return null;

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return null;

		const levelKey = String(level);
		const entry = classHistory[levelKey];

		return entry ? entry.choices : null;
	}

	removeChoices(character, className, level) {
		if (!character.progressionHistory) return false;

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return false;

		const levelKey = String(level);

		if (levelKey in classHistory) {
			delete classHistory[levelKey];
			return true;
		}

		return false;
	}

	getChoicesByRange(character, className, fromLevel, toLevel) {
		if (!character.progressionHistory) return {};

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return {};

		const result = {};

		for (let level = fromLevel; level <= toLevel; level++) {
			const levelKey = String(level);
			if (levelKey in classHistory) {
				result[level] = classHistory[levelKey].choices;
			}
		}

		return result;
	}

	getClassLevelHistory(character, className) {
		if (!character.progressionHistory) return {};

		return character.progressionHistory[className] || {};
	}

	getClassesWithHistory(character) {
		if (!character.progressionHistory) return [];

		return Object.keys(character.progressionHistory).filter(
			(className) =>
				Object.keys(character.progressionHistory[className]).length > 0,
		);
	}

	hasClassHistory(character, className) {
		if (!character.progressionHistory) return false;

		const classHistory = character.progressionHistory[className];
		return classHistory && Object.keys(classHistory).length > 0;
	}

	getHighestRecordedLevel(character, className) {
		if (!character.progressionHistory) return null;

		const classHistory = character.progressionHistory[className];
		if (!classHistory || Object.keys(classHistory).length === 0) return null;

		return Math.max(...Object.keys(classHistory).map(Number));
	}

	clearClassHistory(character, className) {
		if (!character.progressionHistory) return;

		if (className in character.progressionHistory) {
			delete character.progressionHistory[className];
		}
	}

	clearAllHistory(character) {
		character.progressionHistory = {};
	}

	// Clear specific feature types from all levels of a class (e.g., when changing subclass)
	clearFeatureTypesFromClass(character, className, featureTypes) {
		if (!character.progressionHistory) return 0;

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return 0;

		let affectedLevels = 0;

		for (const [_level, entry] of Object.entries(classHistory)) {
			if (!entry.choices) continue;

			let modified = false;
			for (const featureType of featureTypes) {
				if (featureType in entry.choices) {
					delete entry.choices[featureType];
					modified = true;
				}
			}

			if (modified) {
				affectedLevels++;
				// Update timestamp to reflect the modification
				entry.timestamp = new Date().toISOString();
			}
		}

		if (affectedLevels > 0) {
			console.debug(
				'[ProgressionHistoryService]',
				`Cleared ${featureTypes.join(', ')} from ${affectedLevels} levels of ${className}`,
			);
		}

		return affectedLevels;
	}

	getSummary(character) {
		const summary = {};

		if (!character.progressionHistory) {
			return summary;
		}

		for (const [className, classHistory] of Object.entries(
			character.progressionHistory,
		)) {
			const levels = Object.keys(classHistory)
				.map(Number)
				.sort((a, b) => a - b);
			if (levels.length > 0) {
				summary[className] = {
					levels,
					count: levels.length,
					min: Math.min(...levels),
					max: Math.max(...levels),
				};
			}
		}

		return summary;
	}
}

export const progressionHistoryService = new ProgressionHistoryService();
