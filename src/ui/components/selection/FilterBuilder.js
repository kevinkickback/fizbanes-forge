// Small helper to build checkbox/radio/switch filter groups with DOMCleanup tracking.

import { getSchoolName } from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { spellService } from '../../../services/SpellService.js';

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

	/**
	 * Builds standard spell filters (level, school, type)
	 * @param {Object} options
	 * @param {HTMLElement} options.panel - Panel element to render filters into
	 * @param {DOMCleanup} options.cleanup - DOMCleanup instance for listener management
	 * @param {Set} options.levelFilters - Set for level filter state
	 * @param {Set} options.schoolFilters - Set for school filter state
	 * @param {boolean|null} options.ritualOnly - Ritual filter state
	 * @param {boolean|null} options.concentrationOnly - Concentration filter state
	 * @param {boolean|null} options.noVerbal - No verbal component filter state
	 * @param {boolean|null} options.noSomatic - No somatic component filter state
	 * @param {boolean|null} options.noMaterial - No material component filter state
	 * @param {Function} options.onFilterChange - Callback when any filter changes
	 * @param {Object} [options.additionalSwitches] - Additional switch groups to add
	 */
	static buildSpellFilters({
		panel,
		cleanup,
		levelFilters,
		schoolFilters,
		ritualOnly,
		concentrationOnly,
		noVerbal,
		noSomatic,
		noMaterial,
		onFilterChange,
		additionalSwitches = null,
	}) {
		if (!panel) return;
		panel.innerHTML = '';

		const builder = new FilterBuilder(panel, cleanup);

		// Level filters
		builder.addCheckboxGroup({
			title: 'Spell Level',
			options: [
				{ label: 'Cantrip', value: '0' },
				{ label: '1st', value: '1' },
				{ label: '2nd', value: '2' },
				{ label: '3rd', value: '3' },
				{ label: '4th', value: '4' },
				{ label: '5th', value: '5' },
				{ label: '6th', value: '6' },
				{ label: '7th', value: '7' },
				{ label: '8th', value: '8' },
				{ label: '9th', value: '9' },
			],
			stateSet: levelFilters,
			onChange: onFilterChange,
			columns: 2,
		});

		// School filters
		const schoolOptions = Array.from(
			new Set(
				spellService
					.getAllSpells()
					.map((s) => s.school)
					.filter(Boolean),
			),
		)
			.sort()
			.map((code) => ({ label: getSchoolName(code), value: code }));

		builder.addCheckboxGroup({
			title: 'School',
			options: schoolOptions,
			stateSet: schoolFilters,
			onChange: onFilterChange,
			columns: 2,
		});

		// Type filters (ritual, concentration, components)
		builder.addSwitchGroup({
			title: 'Type',
			switches: [
				{
					label: 'Ritual only',
					checked: ritualOnly === true,
					onChange: (v) => {
						onFilterChange(v, 'ritualOnly');
					},
				},
				{
					label: 'Concentration only',
					checked: concentrationOnly === true,
					onChange: (v) => {
						onFilterChange(v, 'concentrationOnly');
					},
				},
				{
					label: 'No verbal',
					checked: noVerbal === true,
					onChange: (v) => {
						onFilterChange(v, 'noVerbal');
					},
				},
				{
					label: 'No somatic',
					checked: noSomatic === true,
					onChange: (v) => {
						onFilterChange(v, 'noSomatic');
					},
				},
				{
					label: 'No material',
					checked: noMaterial === true,
					onChange: (v) => {
						onFilterChange(v, 'noMaterial');
					},
				},
			],
		});

		// Add additional switch groups if provided
		if (additionalSwitches) {
			builder.addSwitchGroup(additionalSwitches);
		}
	}
}
