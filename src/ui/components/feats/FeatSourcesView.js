// FeatSourcesView.js
// Source summary display for selected feats

import { textProcessor } from '../../../lib/TextProcessor.js';

export class FeatSourcesView {
    constructor() {
        this._storageKey = 'featSourcesCollapsed';
    }

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

        // Group feats by source (origin) and render one line per source
        const grouped = [];
        const sourceIndex = new Map();
        character.feats.forEach((feat) => {
            const name = feat?.name || 'Unknown';
            const source = feat?.source || 'Unknown';

            if (!sourceIndex.has(source)) {
                sourceIndex.set(source, grouped.length);
                grouped.push({ source, names: [] });
            }
            grouped[sourceIndex.get(source)].names.push(name);
        });

        const isCollapsed = localStorage.getItem(this._storageKey) === 'true';
        const chevronClass = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';

        let html = `
			<div class="sources-collapsible-header u-collapsible-header">
				<h6 class="mb-0">Sources</h6>
				<i class="fas ${chevronClass} u-text-md"></i>
			</div>
			<div class="sources-collapsible-content ${isCollapsed ? 'u-hidden' : 'u-block'}">
				<div class="proficiency-note">
		`;

        grouped.forEach(({ source, names }) => {
            html += `<div><strong>${source}:</strong> ${names.join(', ')}</div>`;
        });

        html += `
				</div>
			</div>
		`;

        container.innerHTML = html;

        // Add click listener to toggle collapse
        const header = container.querySelector('.sources-collapsible-header');
        if (header) {
            header.addEventListener('click', () => this._toggleCollapse(container));
        }

        await textProcessor.processElement(container);
    }

    _toggleCollapse(container) {
        const content = container.querySelector('.sources-collapsible-content');
        const icon = container.querySelector('.sources-collapsible-header i');

        if (!content || !icon) return;

        const isCurrentlyCollapsed = content.classList.contains('u-hidden');

        if (isCurrentlyCollapsed) {
            content.classList.remove('u-hidden');
            content.classList.add('u-block');
            icon.className = 'fas fa-chevron-up u-text-md';
            localStorage.setItem(this._storageKey, 'false');
        } else {
            content.classList.remove('u-block');
            content.classList.add('u-hidden');
            icon.className = 'fas fa-chevron-down u-text-md';
            localStorage.setItem(this._storageKey, 'true');
        }
    }
}
