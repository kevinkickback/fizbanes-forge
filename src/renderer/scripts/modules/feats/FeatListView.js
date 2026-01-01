/** Renders the list of selected feats on the build page. */

import { textProcessor } from '../../utils/TextProcessor.js';

export class FeatListView {
	/**
	 * Render the list of selected feats into the provided container.
	 * @param {HTMLElement|null} container - Target container element (#featList)
	 * @param {import('../../core/Character.js').Character|null} character - Current character
	 */
	async update(container, character) {
		if (!container) return;

		if (!character || !Array.isArray(character.feats) || character.feats.length === 0) {
			container.innerHTML =
				'<div class="text-muted small py-3">No feats selected.</div>';
			return;
		}

		// Render each feat as a card-like item
		let html = '';
		for (const feat of character.feats) {
			const name = feat?.name || 'Unknown Feat';
			const source = feat?.source || 'Unknown Source';

			html += `
				<div class="feat-item d-flex align-items-start gap-2 p-2 border rounded mb-2" data-feat-name="${name}">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center gap-2 mb-1">
							<strong>${name}</strong>
							<span class="badge badge-sm" style="background: var(--secondary); color: var(--secondary-fg);">${source}</span>
						</div>
					</div>
					<button class="btn btn-sm btn-outline-danger remove-feat" type="button" aria-label="Remove feat" style="padding: 0.25rem 0.5rem;">
						<i class="fas fa-trash"></i>
					</button>
				</div>
			`;
		}

		container.innerHTML = html;
		await textProcessor.processElement(container);
	}
}
