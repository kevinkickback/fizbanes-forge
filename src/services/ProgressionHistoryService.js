/** Manages recording and retrieval of character class progression choices. */
class ProgressionHistoryService {
	ensureInitialized(character) {
		if (!character.progressionHistory) {
			character.progressionHistory = {};
		}
	}

	/** Record user choices for a specific class/level combination. */
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

		console.debug(
			'[ProgressionHistoryService]',
			`Recorded choices for ${className} level ${level}`,
			choices,
		);
	}

	/** Retrieve recorded choices for a specific class/level. */
	getChoices(character, className, level) {
		if (!character.progressionHistory) return null;

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return null;

		const levelKey = String(level);
		const entry = classHistory[levelKey];

		return entry ? entry.choices : null;
	}

	/** Remove recorded choices for a specific class/level. */
	removeChoices(character, className, level) {
		if (!character.progressionHistory) return false;

		const classHistory = character.progressionHistory[className];
		if (!classHistory) return false;

		const levelKey = String(level);

		if (levelKey in classHistory) {
			delete classHistory[levelKey];
			console.debug(
				'[ProgressionHistoryService]',
				`Removed choices for ${className} level ${level}`,
			);
			return true;
		}

		return false;
	}

	/** Get all recorded choices for a class within a level range. */
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

	/** Get entire progression history for a class (all levels). */
	getClassLevelHistory(character, className) {
		if (!character.progressionHistory) return {};

		return character.progressionHistory[className] || {};
	}

	/** Get all classes with recorded progression history. */
	getClassesWithHistory(character) {
		if (!character.progressionHistory) return [];

		return Object.keys(character.progressionHistory).filter(
			(className) =>
				Object.keys(character.progressionHistory[className]).length > 0,
		);
	}

	/**
	 * Check if a class has any recorded history
	 * @param {Character} character
	 * @param {string} className
	 * @returns {boolean}
	 */
	hasClassHistory(character, className) {
		if (!character.progressionHistory) return false;

		const classHistory = character.progressionHistory[className];
		return classHistory && Object.keys(classHistory).length > 0;
	}

	/**
	 * Get the highest level recorded for a class
	 * @param {Character} character
	 * @param {string} className
	 * @returns {number|null} Highest level with recorded choices, or null
	 */
	getHighestRecordedLevel(character, className) {
		if (!character.progressionHistory) return null;

		const classHistory = character.progressionHistory[className];
		if (!classHistory || Object.keys(classHistory).length === 0) return null;

		return Math.max(...Object.keys(classHistory).map(Number));
	}

	/**
	 * Clear all progression history for a class
	 * @param {Character} character
	 * @param {string} className
	 * @returns {void}
	 */
	clearClassHistory(character, className) {
		if (!character.progressionHistory) return;

		if (className in character.progressionHistory) {
			delete character.progressionHistory[className];
			console.debug(
				'[ProgressionHistoryService]',
				`Cleared all history for ${className}`,
			);
		}
	}

	clearAllHistory(character) {
		character.progressionHistory = {};
		console.debug(
			'[ProgressionHistoryService]',
			'Cleared all progression history',
		);
	}

	/** Get a summary of recorded progression. */
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
