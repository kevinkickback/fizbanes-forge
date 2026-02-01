// Small helper to build checkbox/radio/switch filter groups with DOMCleanup tracking.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';

export class FilterBuilder {
	constructor(container, cleanup) {
		this.container = container;
		this.cleanup = cleanup || DOMCleanup.create();
	}

	addCheckboxGroup({
		title,
		options = [],
		stateSet,
		onChange,
		columns = 2,
		collapsible = true,
	}) {
		if (!this.container || !stateSet) return;

		const card = document.createElement('div');
		card.className = 'card mb-3';

		if (title && collapsible) {
			const collapseId = `collapse${title.replace(/\s+/g, '')}`;
			const header = document.createElement('div');
			header.className = 'card-header';
			header.style.cursor = 'pointer';
			header.setAttribute('data-bs-toggle', 'collapse');
			header.setAttribute('data-bs-target', `#${collapseId}`);
			header.setAttribute('aria-expanded', 'true');
			header.setAttribute('aria-controls', collapseId);
			header.innerHTML = `
				<h6 class="mb-0 d-flex align-items-center justify-content-between w-100">
					<span>${title}</span>
					<i class="fas fa-chevron-down"></i>
				</h6>
			`;
			card.appendChild(header);

			const collapseDiv = document.createElement('div');
			collapseDiv.className = 'collapse show';
			collapseDiv.id = collapseId;

			const body = document.createElement('div');
			body.className = 'card-body';

			const row = document.createElement('div');
			row.className = 'row g-2';

			options.forEach((opt, idx) => {
				const col = document.createElement('div');
				col.className = `col-${12 / columns}`;

				const id = `${title || 'filter'}-${idx}`
					.replace(/\s+/g, '-')
					.toLowerCase();
				col.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${id}" value="${opt.value}">
                        <label class="form-check-label" for="${id}">${opt.label}</label>
                    </div>
                `;
				const input = col.querySelector('input');
				input.checked = stateSet.has(opt.value);

				this.cleanup.on(input, 'change', () => {
					if (input.checked) {
						stateSet.add(opt.value);
					} else {
						stateSet.delete(opt.value);
					}
					onChange?.(stateSet);
				});

				row.appendChild(col);
			});

			body.appendChild(row);
			collapseDiv.appendChild(body);
			card.appendChild(collapseDiv);
		} else {
			const body = document.createElement('div');
			body.className = 'card-body';

			if (title) {
				const header = document.createElement('h6');
				header.className = 'mb-3';
				header.textContent = title;
				body.appendChild(header);
			}

			const row = document.createElement('div');
			row.className = 'row g-2';

			options.forEach((opt, idx) => {
				const col = document.createElement('div');
				col.className = `col-${12 / columns}`;

				const id = `${title || 'filter'}-${idx}`
					.replace(/\s+/g, '-')
					.toLowerCase();
				col.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${id}" value="${opt.value}">
                        <label class="form-check-label" for="${id}">${opt.label}</label>
                    </div>
                `;
				const input = col.querySelector('input');
				input.checked = stateSet.has(opt.value);

				this.cleanup.on(input, 'change', () => {
					if (input.checked) {
						stateSet.add(opt.value);
					} else {
						stateSet.delete(opt.value);
					}
					onChange?.(stateSet);
				});

				row.appendChild(col);
			});

			body.appendChild(row);
			card.appendChild(body);
		}

		this.container.appendChild(card);
	}

	addSwitch({ id, label, checked = false, onChange }) {
		if (!this.container) return;

		const wrapper = document.createElement('div');
		wrapper.className = 'form-check form-switch mb-2';
		const switchId = id || `switch-${Math.random().toString(16).slice(2)}`;
		wrapper.innerHTML = `
            <input class="form-check-input" type="checkbox" role="switch" id="${switchId}" ${checked ? 'checked' : ''}>
            <label class="form-check-label" for="${switchId}">${label}</label>
        `;
		const input = wrapper.querySelector('input');
		this.cleanup.on(input, 'change', () => onChange?.(input.checked));
		this.container.appendChild(wrapper);
	}

	addSwitchGroup({ title, switches = [], collapsible = true }) {
		if (!this.container) return;

		const card = document.createElement('div');
		card.className = 'card mb-3';

		if (title && collapsible) {
			const collapseId = `collapse${title.replace(/\s+/g, '')}`;
			const header = document.createElement('div');
			header.className = 'card-header';
			header.style.cursor = 'pointer';
			header.setAttribute('data-bs-toggle', 'collapse');
			header.setAttribute('data-bs-target', `#${collapseId}`);
			header.setAttribute('aria-expanded', 'true');
			header.setAttribute('aria-controls', collapseId);
			header.innerHTML = `
				<h6 class="mb-0 d-flex align-items-center justify-content-between w-100">
					<span>${title}</span>
					<i class="fas fa-chevron-down"></i>
				</h6>
			`;
			card.appendChild(header);

			const collapseDiv = document.createElement('div');
			collapseDiv.className = 'collapse show';
			collapseDiv.id = collapseId;

			const body = document.createElement('div');
			body.className = 'card-body';

			switches.forEach(({ id, label, checked, onChange }) => {
				const wrapper = document.createElement('div');
				wrapper.className = 'form-check form-switch mb-2';
				const switchId = id || `switch-${Math.random().toString(16).slice(2)}`;
				wrapper.innerHTML = `
                    <input class="form-check-input" type="checkbox" role="switch" id="${switchId}" ${checked ? 'checked' : ''}>
                    <label class="form-check-label" for="${switchId}">${label}</label>
                `;
				const input = wrapper.querySelector('input');
				this.cleanup.on(input, 'change', () => onChange?.(input.checked));
				body.appendChild(wrapper);
			});

			collapseDiv.appendChild(body);
			card.appendChild(collapseDiv);
		} else {
			const body = document.createElement('div');
			body.className = 'card-body';

			if (title) {
				const header = document.createElement('h6');
				header.className = 'mb-3';
				header.textContent = title;
				body.appendChild(header);
			}

			switches.forEach(({ id, label, checked, onChange }) => {
				const wrapper = document.createElement('div');
				wrapper.className = 'form-check form-switch mb-2';
				const switchId = id || `switch-${Math.random().toString(16).slice(2)}`;
				wrapper.innerHTML = `
                    <input class="form-check-input" type="checkbox" role="switch" id="${switchId}" ${checked ? 'checked' : ''}>
                    <label class="form-check-label" for="${switchId}">${label}</label>
                `;
				const input = wrapper.querySelector('input');
				this.cleanup.on(input, 'change', () => onChange?.(input.checked));
				body.appendChild(wrapper);
			});

			card.appendChild(body);
		}

		this.container.appendChild(card);
	}
}
