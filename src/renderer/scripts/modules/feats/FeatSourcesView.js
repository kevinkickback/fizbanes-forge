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

        if (!character || !Array.isArray(character.feats) || character.feats.length === 0) {
            container.innerHTML = `
				<h6 class="mb-2">Sources:</h6>
				<div class="text-muted small">No feats selected.</div>
			`;
            return;
        }

        const featsByName = new Map();
        for (const feat of character.feats) {
            const name = feat?.name;
            if (!name) continue;
            const source = feat?.source || 'Unknown';
            if (!featsByName.has(name)) {
                featsByName.set(name, new Set());
            }
            featsByName.get(name).add(source);
        }

        if (featsByName.size === 0) {
            container.innerHTML = `
				<h6 class="mb-2">Sources:</h6>
				<div class="text-muted small">No feats selected.</div>
			`;
            return;
        }

        let html = '<h6 class="mb-2">Sources:</h6>';
        const sortedNames = Array.from(featsByName.keys()).sort((a, b) => a.localeCompare(b));
        for (const name of sortedNames) {
            const sources = Array.from(featsByName.get(name)).sort();
            html += `<div class="feat-source-row"><strong>${name}</strong> <span class="text-muted">(${sources.join(', ')})</span></div>`;
        }

        container.innerHTML = html;
        await textProcessor.processElement(container);
    }
}
