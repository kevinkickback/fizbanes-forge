/**
 * ProficiencyNotesView.js
 * Handles rendering of proficiency source notes and explanations
 */

import { textProcessor } from '../../utils/TextProcessor.js';

/**
 * View component for rendering proficiency notes and source tracking
 */
export class ProficiencyNotesView {
	/**
	 * Update the proficiency notes display
	 * @param {HTMLElement} container - The notes container element
	 * @param {Character} character - The character object
	 * @param {Function} getTypeLabel - Function to get type label
	 */
	async updateProficiencyNotes(container, character, getTypeLabel) {
		if (!character || !character.proficiencySources) {
			container.innerHTML = '';
			return;
		}

		// Group proficiencies by type
		const typeGroups = {};
		for (const type in character.proficiencySources) {
			typeGroups[type] = [];

			// Add each proficiency with its source
			for (const [prof, sources] of character.proficiencySources[
				type
			].entries()) {
				for (const source of sources) {
					typeGroups[type].push({
						name: prof,
						source: source,
					});
				}
			}
		}

		// Build the notes HTML
		let notesHTML = '<h6 class="mb-2">Sources:</h6>';

		for (const type in typeGroups) {
			if (typeGroups[type].length === 0) continue;

			const typeLabel = getTypeLabel(type);
			notesHTML += `<div class="proficiency-note"><strong>${typeLabel}:</strong> `;

			// Ensure all proficiencies have a name property that's a string
			const validProfs = typeGroups[type]
				.filter(
					(prof) =>
						prof &&
						(typeof prof.name === 'string' || typeof prof.name === 'number'),
				)
				.map((prof) => ({
					name: String(prof.name),
					source: prof.source,
				}));

			// Sort proficiencies alphabetically
			try {
				validProfs.sort((a, b) => a.name.localeCompare(b.name));
			} catch {
				// Continue without sorting if there's an error
			}

			// Create formatted strings with source in parentheses
			const profStrings = validProfs.map(
				(prof) => `${prof.name} (${prof.source})`,
			);

			notesHTML += profStrings.join(', ');
			notesHTML += '</div>';
		}

		container.innerHTML = notesHTML;

		// Process the notes container to resolve reference tags
		await textProcessor.processElement(container);
	}
}
