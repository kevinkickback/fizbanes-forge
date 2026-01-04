/** Renders feat source notes and explanations. */

import { textProcessor } from '../../utils/TextProcessor.js';

export class FeatSourcesView {
	/**
	 * Render the feat source summary into the provided container.
	 * @param {HTMLElement|null} container - Target container element
	 * @param {import('../../core/Character.js').Character|null} character - Current character
	 */
	async update(container, character) {
		if (!container) return;

		if (
			!character ||
			!Array.isArray(character.feats) ||
			character.feats.length === 0
		) {
			container.innerHTML = '';
			return;
		}

		if (character.feats.length === 0) {
			container.innerHTML = '';
			return;
		}

		// Format feats with their sources
		const featLines = character.feats.map((feat) => {
			const name = feat?.name || 'Unknown';
			const source = feat?.source || 'Unknown';
			return `${name} (${source})`;
		});

		let html = '<h6 class="mb-2">Sources:</h6>';
		html += `<div class="proficiency-note">${featLines.join(', ')}</div>`;

		container.innerHTML = html;
		await textProcessor.processElement(container);
	}
}
