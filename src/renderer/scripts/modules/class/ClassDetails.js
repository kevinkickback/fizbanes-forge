/** View for detailed class information (hit die, proficiencies, saves, features). */

import { CharacterManager } from '../../core/CharacterManager.js';

import { abilityScoreService } from '../../services/AbilityScoreService.js';
import { toSentenceCase, toTitleCase } from '../../utils/TextFormatter.js';
import { textProcessor } from '../../utils/TextProcessor.js';

/** View for displaying class details. */
export class ClassDetailsView {
	/**
	 * Creates a new ClassDetailsView instance
	 */
	constructor() {
		/**
		 * The container element for class details
		 * @type {HTMLElement}
		 * @private
		 */
		this._classDetails = document.getElementById('classDetails');
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	/**
	 * Update all class details sections (except features)
	 * @param {Object} classData - The class data
	 * @returns {Promise<void>}
	 */
	async updateAllDetails(classData) {
		if (!classData) {
			this.resetAllDetails();
			return;
		}

		// Update individual sections
		this.updateHitDie(classData);
		this.updateSkillProficiencies(classData);
		this.updateSavingThrows(classData);
		this.updateArmorProficiencies(classData);
		this.updateWeaponProficiencies(classData);
		this.updateToolProficiencies(classData);

		// Process the entire details container at once to resolve all reference tags
		await textProcessor.processElement(this._classDetails);
	}

	/**
	 * Reset all details sections to placeholder state
	 */
	resetAllDetails() {
		const detailSections =
			this._classDetails.querySelectorAll('.detail-section');
		for (const section of detailSections) {
			const list = section.querySelector('ul');
			const paragraph = section.querySelector('p');

			if (list) {
				list.innerHTML = '<li class="placeholder-text">—</li>';
			}

			if (paragraph) {
				paragraph.textContent = '—';
				paragraph.classList.add('placeholder-text');
			}
		}

		// Reset features section
		const featuresSection =
			this._classDetails.querySelector('.features-section');
		if (featuresSection) {
			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="features-grid">
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            `;
		}
	}

	//-------------------------------------------------------------------------
	// Hit Die Section
	//-------------------------------------------------------------------------

	/**
	 * Update the hit die information display
	 * @param {Object} classData - The class data
	 */
	updateHitDie(classData) {
		const hitDieSection = this._classDetails.querySelector(
			'.detail-section:nth-child(1) ul',
		);
		if (hitDieSection) {
			hitDieSection.innerHTML = '';
			const li = document.createElement('li');
			li.className = 'text-content';
			const hitDieText = this._formatHitDie(classData);
			li.textContent = hitDieText;
			hitDieSection.appendChild(li);
		}
	}

	/**
	 * Format hit die information from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {string} Formatted hit die text
	 * @private
	 */
	_formatHitDie(classData) {
		if (!classData?.hd) return 'Unknown';
		const faces = classData.hd.faces || classData.hd;
		return `1d${faces}`;
	}

	//-------------------------------------------------------------------------
	// Skill Proficiencies Section
	//-------------------------------------------------------------------------

	/**
	 * Update the skill proficiencies information display
	 * @param {Object} classData - The class data
	 */
	updateSkillProficiencies(classData) {
		const skillProficienciesSection = this._classDetails.querySelector(
			'.detail-section:nth-child(2)',
		);
		if (!skillProficienciesSection) return;

		const skillList = skillProficienciesSection.querySelector('ul');
		if (!skillList) return;

		// Remove any existing choose header
		const existingChooseHeader =
			skillProficienciesSection.querySelector('.choose-text');
		if (existingChooseHeader) {
			existingChooseHeader.remove();
		}

		skillList.innerHTML = '';
		skillList.className = ''; // Reset classes

		if (classData) {
			const formattedString = this._formatSkillProficiencies(classData);
			const hasChoices = formattedString.includes('Choose');

			if (hasChoices) {
				// Check for "any skills" format first
				if (formattedString.includes('Choose any')) {
					const anySkillPattern = /(Choose any \d+ skills?)/;
					const anyMatches = formattedString.match(anySkillPattern);

					if (anyMatches && anyMatches.length >= 1) {
						const li = document.createElement('li');
						li.className = 'text-content';
						li.textContent = anyMatches[1];
						skillList.appendChild(li);
					}
				} else {
					// For "Choose X from Y" format, split into header and skills list
					const choosePattern = /(Choose \d+ from:)\s+(.*)/;
					const matches = formattedString.match(choosePattern);

					if (matches && matches.length >= 3) {
						const chooseText = matches[1]; // "Choose X from:"
						const skillsText = matches[2]; // The list of skills

						// Add the "Choose X from:" header
						const chooseHeader = document.createElement('div');
						chooseHeader.className = 'choose-text';
						chooseHeader.textContent = chooseText;
						skillProficienciesSection.insertBefore(chooseHeader, skillList);

						// Add the skills list, title-cased
						const skills = skillsText.split(', ').map(toTitleCase);

						// Apply multi-column if more than 3 skills
						if (skills.length > 3) {
							skillList.className = 'multi-column-list';
							if (skills.length > 6) {
								skillList.classList.add('many-items');
							}
						}

						for (const skill of skills) {
							const li = document.createElement('li');
							li.className = 'text-content';
							li.textContent = skill;
							skillList.appendChild(li);
						}
					} else {
						// Fallback for other formats, title-cased
						const li = document.createElement('li');
						li.className = 'text-content';
						li.textContent = toTitleCase(formattedString);
						skillList.appendChild(li);
					}
				}
			} else {
				// For simple list format
				const skills = formattedString.split(', ');

				// Apply multi-column if more than 3 skills
				if (skills.length > 3) {
					skillList.className = 'multi-column-list';
					if (skills.length > 6) {
						skillList.classList.add('many-items');
					}
				}

				for (const skill of skills) {
					const li = document.createElement('li');
					li.className = 'text-content';
					li.textContent = skill;
					skillList.appendChild(li);
				}
			}
		}
	}

	/**
	 * Format skill proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {string} Formatted skill proficiencies text
	 * @private
	 */
	_formatSkillProficiencies(classData) {
		if (!classData?.startingProficiencies?.skills) return 'None';

		const skills = classData.startingProficiencies.skills;
		const parts = [];

		for (const skillEntry of skills) {
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];

				if (from.length === 0 || skillEntry.choose.fromFilter) {
					// Any skills
					parts.push(`Choose any ${count} skill${count > 1 ? 's' : ''}`);
				} else {
					// Specific list - use skills as-is from JSON
					parts.push(`Choose ${count} from: ${from.join(', ')}`);
				}
			} else {
				// Fixed proficiencies - use skills as-is from JSON
				parts.push(...Object.keys(skillEntry));
			}
		}

		return parts.join('; ') || 'None';
	}

	//-------------------------------------------------------------------------
	// Saving Throws Section
	//-------------------------------------------------------------------------

	/**
	 * Update the saving throws information display
	 * @param {Object} classData - The class data
	 */
	updateSavingThrows(classData) {
		const savingThrowsSection = this._classDetails.querySelector(
			'.detail-section:nth-child(3) ul',
		);
		if (savingThrowsSection) {
			savingThrowsSection.innerHTML = '';

			const savingThrows = this._formatSavingThrows(classData);
			if (savingThrows && savingThrows.length > 0) {
				for (const save of savingThrows) {
					const li = document.createElement('li');
					li.className = 'text-content';
					li.textContent = save;
					savingThrowsSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				savingThrowsSection.appendChild(li);
			}
		}
	}

	/**
	 * Format saving throws from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of saving throw names
	 * @private
	 */
	_formatSavingThrows(classData) {
		if (!classData?.proficiency) return [];

		const abilityMap = {
			str: 'Strength',
			dex: 'Dexterity',
			con: 'Constitution',
			int: 'Intelligence',
			wis: 'Wisdom',
			cha: 'Charisma',
		};

		return classData.proficiency.map((prof) => abilityMap[prof] || prof);
	}

	//-------------------------------------------------------------------------
	// Armor Proficiencies Section
	//-------------------------------------------------------------------------

	/**
	 * Update the armor proficiencies information display
	 * @param {Object} classData - The class data
	 */
	updateArmorProficiencies(classData) {
		const armorSection = this._classDetails.querySelector(
			'.detail-section:nth-child(4) ul',
		);
		if (armorSection) {
			armorSection.innerHTML = '';
			armorSection.className = ''; // Reset classes

			const armorProficiencies = this._formatArmorProficiencies(classData);
			if (armorProficiencies && armorProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (armorProficiencies.length > 3) {
					armorSection.className = 'multi-column-list';
					if (armorProficiencies.length > 6) {
						armorSection.classList.add('many-items');
					}
				}

				for (const armor of armorProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const armorStr = typeof armor === 'string' ? armor : String(armor);
					li.textContent = armorStr;
					armorSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				armorSection.appendChild(li);
			}
		}
	}

	/**
	 * Format armor proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of armor proficiency names
	 * @private
	 */
	_formatArmorProficiencies(classData) {
		if (!classData?.startingProficiencies?.armor) return [];

		const armorMap = {
			light: 'Light Armor',
			medium: 'Medium Armor',
			heavy: 'Heavy Armor',
			shield: 'Shields',
		};

		return classData.startingProficiencies.armor.map((armor) => {
			if (armorMap[armor]) return armorMap[armor];
			// Return armor as-is to preserve tags
			return armor;
		});
	}

	//-------------------------------------------------------------------------
	// Weapon Proficiencies Section
	//-------------------------------------------------------------------------

	/**
	 * Update the weapon proficiencies information display
	 * @param {Object} classData - The class data
	 */
	updateWeaponProficiencies(classData) {
		const weaponSection = this._classDetails.querySelector(
			'.detail-section:nth-child(5) ul',
		);
		if (weaponSection) {
			weaponSection.innerHTML = '';
			weaponSection.className = ''; // Reset classes

			const weaponProficiencies = this._formatWeaponProficiencies(classData);
			if (weaponProficiencies && weaponProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (weaponProficiencies.length > 3) {
					weaponSection.className = 'multi-column-list';
					if (weaponProficiencies.length > 6) {
						weaponSection.classList.add('many-items');
					}
				}

				for (const weapon of weaponProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const weaponStr =
						typeof weapon === 'string' ? weapon : String(weapon);
					li.textContent = toTitleCase(weaponStr);
					weaponSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				weaponSection.appendChild(li);
			}
		}
	}

	/**
	 * Format weapon proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of weapon proficiency names
	 * @private
	 */
	_formatWeaponProficiencies(classData) {
		if (!classData?.startingProficiencies?.weapons) return [];

		const weaponMap = {
			simple: 'Simple Weapons',
			martial: 'Martial Weapons',
		};

		return classData.startingProficiencies.weapons.map((weapon) => {
			if (weaponMap[weapon]) return weaponMap[weapon];
			// Return weapon as-is to preserve tags like {@item dagger|phb|daggers}
			return weapon;
		});
	}

	//-------------------------------------------------------------------------
	// Tool Proficiencies Section
	//-------------------------------------------------------------------------

	/**
	 * Update the tool proficiencies information display
	 * @param {Object} classData - The class data
	 */
	updateToolProficiencies(classData) {
		const toolSection = this._classDetails.querySelector(
			'.detail-section:nth-child(6) ul',
		);
		if (toolSection) {
			toolSection.innerHTML = '';
			toolSection.className = ''; // Reset classes

			const toolProficiencies = this._formatToolProficiencies(classData);
			if (toolProficiencies && toolProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (toolProficiencies.length > 3) {
					toolSection.className = 'multi-column-list';
					if (toolProficiencies.length > 6) {
						toolSection.classList.add('many-items');
					}
				}

				for (const tool of toolProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const toolStr = typeof tool === 'string' ? tool : String(tool);
					li.textContent = toSentenceCase(toolStr);
					toolSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				toolSection.appendChild(li);
			}
		}
	}

	/**
	 * Format tool proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of tool proficiency names
	 * @private
	 */
	_formatToolProficiencies(classData) {
		if (!classData?.startingProficiencies?.tools) return [];

		const tools = [];
		for (const toolEntry of classData.startingProficiencies.tools) {
			if (typeof toolEntry === 'string') {
				// Return tool as-is to preserve tags
				tools.push(toolEntry);
			} else if (toolEntry.choose) {
				// Choice of tools
				const count = toolEntry.choose.count || 1;
				tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
			} else {
				// Object with tool types - use tool names as-is from JSON
				for (const [key, value] of Object.entries(toolEntry)) {
					if (value === true) {
						tools.push(key);
					}
				}
			}
		}

		return tools;
	}

	//-------------------------------------------------------------------------
	// Features Section
	//-------------------------------------------------------------------------

	/**
	 * Update the features section with feature data
	 * @param {Object} classData - Selected class (for source fallback)
	 * @param {Array} allFeatures - Combined array of class and subclass features
	 * @returns {Promise<void>}
	 */
	async updateFeatures(classData, allFeatures) {
		const featuresSection =
			this._classDetails.querySelector('.features-section');
		if (!featuresSection) {
			console.warn(
				'ClassDetails',
				'Features section not found in class details',
			);
			return;
		}

		const character = CharacterManager.getCurrentCharacter();
		const level = character?.level || 1;

		if (allFeatures.length > 0) {
			const processedFeatures = await Promise.all(
				allFeatures.map(async (feature) => {
					if (!feature.name) {
						console.warn('ClassDetails', 'Feature missing name:', feature);
						return '';
					}

					const name = feature.name;
					let description = '';

					// Handle different entry formats
					if (typeof feature.entries === 'string') {
						description = feature.entries;
					} else if (Array.isArray(feature.entries)) {
						description = await this._formatFeatureEntries(feature.entries);
					} else if (feature.entry) {
						description = await textProcessor.processString(feature.entry);
					} else if (feature.text) {
						description = await textProcessor.processString(feature.text);
					} else {
						console.warn('ClassDetails', 'Feature missing entries:', feature);
					}

					// Format source and page info
					const source = feature.source || classData.source || '';
					const page = feature.page || '';
					if (page) {
						description += `<div class="tooltip-source">${source}, p. ${page}</div>`;
					} else if (source) {
						description += `<div class="tooltip-source">${source}</div>`;
					}

					// Create hover link that will trigger tooltip (same as traits)
					return `<a class="trait-tag rd__hover-link" data-hover-type="feature" data-hover-name="${name}" data-hover-content="${description.replace(/"/g, '&quot;')}">${name}</a>`;
				}),
			);

			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="traits-grid">
                    ${processedFeatures.join('')}
                </div>
            `;
		} else {
			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="traits-grid">
                    <span class="trait-tag">No features at level ${level}</span>
                </div>
            `;
		}
	}

	/**
	 * Formats feature entries for display (async to process tags)
	 * @param {Array|String} entries - Array of entries or string
	 * @returns {Promise<string>} Formatted HTML string
	 * @private
	 */
	async _formatFeatureEntries(entries) {
		// If entries is a string, process it and return
		if (typeof entries === 'string') {
			return await textProcessor.processString(entries);
		}

		// If entries is not an array, return empty string
		if (!Array.isArray(entries)) {
			console.warn(
				'ClassDetails',
				'Feature entries is not an array or string:',
				entries,
			);
			return '';
		}

		let result = '';

		// Process each entry in the array
		for (const entry of entries) {
			// Handle strings directly
			if (typeof entry === 'string') {
				const processed = await textProcessor.processString(entry);
				result += `<p>${processed}</p>`;
				continue;
			}

			// Handle objects with different types
			if (typeof entry === 'object') {
				// Handle lists
				if (entry.type === 'list') {
					result += '<ul class="tooltip-list">';

					if (Array.isArray(entry.items)) {
						for (const item of entry.items) {
							if (typeof item === 'string') {
								const processed = await textProcessor.processString(item);
								result += `<li>${processed}</li>`;
							} else if (typeof item === 'object') {
								// Handle items with name and entry
								if (item.name && item.entry) {
									const processedName = await textProcessor.processString(
										item.name,
									);
									const processedEntry = await textProcessor.processString(
										item.entry,
									);
									result += `<li><strong>${processedName}</strong>: ${processedEntry}</li>`;
								} else if (item.name && item.entries) {
									// Handle items with name and entries array
									const processedName = await textProcessor.processString(
										item.name,
									);
									const processedEntries = await this._formatFeatureEntries(
										item.entries,
									);
									result += `<li><strong>${processedName}</strong>: ${processedEntries}</li>`;
								} else {
									console.warn(
										'ClassDetails',
										'Unhandled list item format:',
										item,
									);
								}
							}
						}
					}

					result += '</ul>';
				}
				// Handle tables
				else if (entry.type === 'table') {
					result += '<div class="table-container">';

					if (entry.caption) {
						const processedCaption = await textProcessor.processString(
							entry.caption,
						);
						result += `<p><strong>${processedCaption}</strong></p>`;
					}

					result += '<table class="tooltip-table"><tbody>';

					if (Array.isArray(entry.rows)) {
						for (const row of entry.rows) {
							result += '<tr>';

							if (Array.isArray(row)) {
								for (const cell of row) {
									if (typeof cell === 'string') {
										const processed = await textProcessor.processString(cell);
										result += `<td>${processed}</td>`;
									} else {
										result += `<td>${JSON.stringify(cell)}</td>`;
									}
								}
							}

							result += '</tr>';
						}
					}

					result += '</tbody></table></div>';
				}
				// Handle entries property (recursive)
				else if (Array.isArray(entry.entries)) {
					result += await this._formatFeatureEntries(entry.entries);
				}
				// Handle entry property
				else if (entry.entry) {
					const processed = await textProcessor.processString(entry.entry);
					result += `<p>${processed}</p>`;
				}
				// Handle name and text properties
				else if (entry.name && entry.text) {
					const processedName = await textProcessor.processString(entry.name);
					const processedText = await textProcessor.processString(entry.text);
					result += `<p><strong>${processedName}</strong>. ${processedText}</p>`;
				}
				// Handle Spell Save DC
				else if (entry.type === 'abilityDc') {
					const character = CharacterManager.getCurrentCharacter();
					const abilityAbbr = entry.attributes?.[0]; // e.g., 'wis'
					if (!character || !abilityAbbr) {
						result += '<p>Error calculating Spell Save DC.</p>';
					} else {
						const abilityMap = {
							str: 'Strength',
							dex: 'Dexterity',
							con: 'Constitution',
							int: 'Intelligence',
							wis: 'Wisdom',
							cha: 'Charisma',
						};
						const abilityName = abilityMap[abilityAbbr] || abilityAbbr;
						const modifier = abilityScoreService.getModifier(abilityAbbr);
						const profBonus = character.getProficiencyBonus
							? character.getProficiencyBonus()
							: Math.ceil(1 + character.level / 4);
						const dc = 8 + profBonus + modifier;
						const processedName = await textProcessor.processString(
							entry.name || 'Spell Save DC',
						);
						result += `<p><strong>${processedName}</strong> = 8 + your proficiency bonus + your ${abilityName} modifier (${dc})</p>`;
					}
				}
				// Handle Spell Attack Modifier
				else if (entry.type === 'abilityAttackMod') {
					const character = CharacterManager.getCurrentCharacter();
					const abilityAbbr = entry.attributes?.[0]; // e.g., 'wis'
					if (!character || !abilityAbbr) {
						result += '<p>Error calculating Spell Attack Modifier.</p>';
					} else {
						const abilityMap = {
							str: 'Strength',
							dex: 'Dexterity',
							con: 'Constitution',
							int: 'Intelligence',
							wis: 'Wisdom',
							cha: 'Charisma',
						};
						const abilityName = abilityMap[abilityAbbr] || abilityAbbr;
						const modifier = abilityScoreService.getModifier(abilityAbbr);
						const profBonus = character.getProficiencyBonus
							? character.getProficiencyBonus()
							: Math.ceil(1 + character.level / 4);
						const attackMod = profBonus + modifier;
						const sign = attackMod >= 0 ? '+' : '';
						const processedName = await textProcessor.processString(
							entry.name || 'Spell Attack Modifier',
						);
						result += `<p><strong>${processedName}</strong> = your proficiency bonus + your ${abilityName} modifier (${sign}${attackMod})</p>`;
					}
				}
				// Handle optional feature reference
				else if (entry.type === 'refOptionalfeature') {
					const featureName = entry.optionalfeature;
					if (featureName) {
						const processed = await textProcessor.processString(featureName);
						result += `<p><em>${processed}</em></p>`;
					}
				}
				// Handle class feature reference (format: FeatureName|ParentClass|Source|Level)
				else if (entry.type === 'refClassFeature') {
					const featureRef = entry.classFeature;
					if (featureRef) {
						const parts = featureRef.split('|');
						const featureName = parts[0];
						const processed = await textProcessor.processString(featureName);
						result += `<p><em>${processed}</em></p>`;
					}
				}
				// Fall back to JSON for unhandled formats
				else {
					console.warn('ClassDetails', 'Unhandled entry format:', entry);
					result += `<p>${JSON.stringify(entry)}</p>`;
				}
			}
		}

		return result;
	}
}
