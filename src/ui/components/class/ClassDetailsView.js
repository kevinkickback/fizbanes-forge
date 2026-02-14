// ClassDetailsView.js
// Detailed class information display for the info panel

import {
    attAbvToFull,
    toSentenceCase,
    toTitleCase,
} from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

export class ClassDetailsView {
    constructor() {
        this._classInfoPanel = document.getElementById('classInfoPanel');
    }

    //-------------------------------------------------------------------------
    // Public API
    //-------------------------------------------------------------------------

    async updateAllDetails(classData, fluffData = null) {
        if (!classData) {
            this.resetAllDetails();
            return;
        }

        // Build the complete info panel content
        let html = '';

        // Class Description Section
        html += '<div class="info-section">';
        html += await this._renderClassDescription(classData, fluffData);
        html += '</div>';

        // Hit Die Section
        html += '<div class="info-section">';
        html += '<h6><i class="fas fa-heart"></i> Hit Die</h6>';
        html += `<div class="info-content">${this._formatHitDie(classData)}</div>`;
        html += '</div>';

        // Proficiencies Section
        html += '<div class="info-section">';
        html += '<h6><i class="fas fa-shield-alt"></i> Proficiencies</h6>';
        html += '<div class="info-content">';
        html += await this._renderProficiencies(classData);
        html += '</div>';
        html += '</div>';

        // Set the complete content
        if (this._classInfoPanel) {
            this._classInfoPanel.innerHTML = html;
        } else {
            console.warn('[ClassDetailsView]', 'Info panel element not found!');
        }

        // Process the entire panel at once to resolve all reference tags
        await textProcessor.processElement(this._classInfoPanel);
    }

    async _renderClassDescription(classData, fluffData = null) {
        let description = '';

        // Extract description from fluff data
        if (fluffData?.entries) {
            for (const entry of fluffData.entries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    let foundDescription = false;
                    for (let i = 0; i < entry.entries.length; i++) {
                        const subEntry = entry.entries[i];
                        if (typeof subEntry === 'string') {
                            // Skip the first 3 story vignettes, get the 4th paragraph (index 3)
                            if (i >= 3) {
                                description = subEntry;
                                foundDescription = true;
                                break;
                            }
                        }
                    }
                    if (foundDescription) break;
                }
            }
        }

        // Fallback if no fluff found
        if (!description) {
            description =
                classData.description ||
                `${classData.name} class features and characteristics.`;
        }

        return `
			<h5 class="info-title">${classData.name}</h5>
			<p class="info-description">${description}</p>
		`;
    }

    async _renderProficiencies(classData) {
        let html = '';

        // Skill Proficiencies
        html += '<div class="proficiency-group">';
        html += '<strong>Skills:</strong> ';
        html += `<span>${this._formatSkillProficiencies(classData)}</span>`;
        html += '</div>';

        // Saving Throws
        html += '<div class="proficiency-group">';
        html += '<strong>Saving Throws:</strong> ';
        const savingThrows = this._formatSavingThrows(classData);
        html += `<span>${savingThrows.join(', ') || 'None'}</span>`;
        html += '</div>';

        // Armor Proficiencies
        html += '<div class="proficiency-group">';
        html += '<strong>Armor:</strong> ';
        const armorProfs = this._formatArmorProficiencies(classData);
        html += `<span>${armorProfs.join(', ') || 'None'}</span>`;
        html += '</div>';

        // Weapon Proficiencies
        html += '<div class="proficiency-group">';
        html += '<strong>Weapons:</strong> ';
        const weaponProfs = this._formatWeaponProficiencies(classData);
        html += `<span>${weaponProfs.map((w) => toTitleCase(w)).join(', ') || 'None'}</span>`;
        html += '</div>';

        // Tool Proficiencies
        const toolProfs = this._formatToolProficiencies(classData);
        if (toolProfs.length > 0) {
            html += '<div class="proficiency-group">';
            html += '<strong>Tools:</strong> ';
            html += `<span>${toolProfs.map((t) => toSentenceCase(t)).join(', ')}</span>`;
            html += '</div>';
        }

        return html;
    }

    resetAllDetails() {
        if (!this._classInfoPanel) return;

        this._classInfoPanel.innerHTML = `
			<div class="info-section">
				<h5 class="info-title">Select a Class</h5>
				<p class="info-description">Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
			</div>
		`;
    }

    //-------------------------------------------------------------------------
    // Hit Die Section
    //-------------------------------------------------------------------------

    _formatHitDie(classData) {
        if (!classData?.hd) return 'Unknown';
        const faces = classData.hd.faces || classData.hd;
        return `1d${faces}`;
    }

    //-------------------------------------------------------------------------
    // Skill Proficiencies Section
    //-------------------------------------------------------------------------

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

    _formatSavingThrows(classData) {
        if (!classData?.proficiency) return [];
        return classData.proficiency.map((prof) => attAbvToFull(prof) || prof);
    }

    //-------------------------------------------------------------------------
    // Armor Proficiencies Section
    //-------------------------------------------------------------------------

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
}
