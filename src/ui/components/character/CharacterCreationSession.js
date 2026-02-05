// Session manager for character creation wizard - stages all data until confirmation

export class CharacterCreationSession {
	constructor() {
		this.currentStep = 0; // 0-6, tracks wizard progress (Basics -> Rules -> Race -> Class -> Background -> Ability Scores -> Review)

		// Staged character data
		this.stagedData = {
			// Step 0: Basics
			name: '',
			level: 1,
			gender: 'male',
			portrait: null,

			// Step 1: Rules
			abilityScoreMethod: 'pointBuy',
			variantRules: {
				variantfeat: false,
				averageHitPoints: false,
			},
			allowedSources: new Set(),

			// Step 2: Race
			race: {
				name: '',
				source: '',
				subrace: '',
			},

			// Step 3: Class
			class: {
				name: '',
				source: '',
				subclass: '',
			},

			// Step 4: Background
			background: {
				name: '',
				source: '',
			},

			// Step 5: Ability Scores
			abilityScores: {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			},
		};
	}

	get(path) {
		return this._navigatePath(this.stagedData, path);
	}

	set(path, value) {
		this._setPath(this.stagedData, path, value);
	}

	getStagedData() {
		return {
			...this.stagedData,
			allowedSources: Array.from(this.stagedData.allowedSources),
		};
	}

	_navigatePath(obj, path) {
		const parts = path.split('.');
		let current = obj;

		for (const part of parts) {
			if (current == null) return undefined;
			current = current[part];
		}

		return current;
	}

	_setPath(obj, path, value) {
		const parts = path.split('.');
		const last = parts.pop();
		let current = obj;

		for (const part of parts) {
			if (!(part in current) || typeof current[part] !== 'object') {
				current[part] = {};
			}
			current = current[part];
		}

		current[last] = value;
	}

	reset() {
		this.currentStep = 0;
		this.stagedData = {
			name: '',
			level: 1,
			gender: 'male',
			portrait: null,
			abilityScoreMethod: 'pointBuy',
			variantRules: {
				variantfeat: false,
				averageHitPoints: false,
			},
			allowedSources: new Set(),
			race: {
				name: '',
				source: '',
				subrace: '',
			},
			class: {
				name: '',
				source: '',
				subclass: '',
			},
			background: {
				name: '',
				source: '',
			},
			abilityScores: {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			},
		};
	}

	restoreSourcesFromSession(sourceService) {
		const savedSources = this.get('allowedSources');
		if (savedSources && savedSources instanceof Set && savedSources.size > 0) {
			const currentSources = sourceService.getAllowedSources();
			for (const source of currentSources) {
				if (source !== 'PHB' && !savedSources.has(source)) {
					sourceService.removeAllowedSource(source);
				}
			}
			for (const source of savedSources) {
				sourceService.addAllowedSource(source);
			}
		}
	}
}
