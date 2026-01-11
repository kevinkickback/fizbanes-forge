// Renders proficiency source notes and explanations

import { toTitleCase } from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

export class ProficiencyNotesView {
	async updateProficiencyNotes(container, character, getTypeLabel) {
		if (!character) {
			container.innerHTML = '';
			return;
		}

		// Group proficiencies by type
		const typeGroups = {};

		// Add fixed proficiencies from proficiencySources
		if (character.proficiencySources) {
			for (const type in character.proficiencySources) {
				if (!typeGroups[type]) {
					typeGroups[type] = [];
				}

				// Add each proficiency with its source
				for (const [prof, sources] of character.proficiencySources[
					type
				].entries()) {
					for (const source of sources) {
						typeGroups[type].push({
							name: toTitleCase(prof),
							source,
						});
					}
				}
			}
		}

		// Add optional proficiencies (languages, skills, tools)
		if (character.optionalProficiencies) {
			const optionalTypes = ['languages', 'skills', 'tools'];
			for (const type of optionalTypes) {
				const optional = character.optionalProficiencies[type];
				if (!optional || !optional.selected) continue;

				if (!typeGroups[type]) {
					typeGroups[type] = [];
				}

				// Track which source each selected proficiency comes from
				for (const prof of optional.selected) {
					const sources = [];

					if (optional.race?.selected?.includes(prof)) {
						sources.push('Race');
					}
					if (optional.class?.selected?.includes(prof)) {
						sources.push('Class');
					}
					if (optional.background?.selected?.includes(prof)) {
						sources.push('Background');
					}

					// If no specific source, it's optional/default
					if (sources.length === 0) {
						sources.push('Optional');
					}

					for (const source of sources) {
						typeGroups[type].push({
							name: toTitleCase(prof),
							source,
						});
					}
				}
			}
		}

		// Build the notes HTML
		let notesHtml = '<h6 class="mb-2">Sources:</h6>';

		for (const type in typeGroups) {
			if (typeGroups[type].length === 0) continue;

			const typeLabel = getTypeLabel(type);
			notesHtml += `<div class="proficiency-note"><strong>${typeLabel}:</strong> `;

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

			// Deduplicate proficiencies by name and combine sources
			const profsByName = {};
			for (const prof of validProfs) {
				if (!profsByName[prof.name]) {
					profsByName[prof.name] = [];
				}
				// Only add unique sources
				if (!profsByName[prof.name].includes(prof.source)) {
					profsByName[prof.name].push(prof.source);
				}
			}

			// Create formatted strings with sources in parentheses, sorted by name
			const profStrings = Object.keys(profsByName)
				.sort((a, b) => a.localeCompare(b))
				.map((name) => `${name} (${profsByName[name].join(', ')})`);

			notesHtml += profStrings.join(', ');
			notesHtml += '</div>';
		}

		container.innerHTML = notesHtml;

		// Process the notes container to resolve reference tags
		await textProcessor.processElement(container);
	}
}
