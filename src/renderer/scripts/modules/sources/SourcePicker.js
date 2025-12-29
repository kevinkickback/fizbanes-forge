/** View for rendering and handling source book toggle buttons. */

/** View component for source book selection UI. */
export class SourcePickerView {
	/**
	 * Render source book toggles
	 * @param {HTMLElement} container - Container element for toggles
	 * @param {Array<string>} availableSources - Array of available source identifiers
	 * @param {Function} formatSourceName - Function to format source names
	 * @param {Function} onToggleClick - Callback for toggle click
	 * @returns {Array<HTMLElement>} Array of created toggle elements
	 */
	renderSourceToggles(
		container,
		availableSources,
		formatSourceName,
		onToggleClick,
	) {
		container.innerHTML = '';
		const toggles = [];

		for (const source of availableSources) {
			const toggle = this.createSourceToggle(
				source,
				formatSourceName,
				onToggleClick,
			);
			container.appendChild(toggle);
			toggles.push(toggle);
		}

		return toggles;
	}

	/**
	 * Create a toggle button for a source book
	 * @param {string} source - The source book identifier
	 * @param {Function} formatSourceName - Function to format source names
	 * @param {Function} onToggleClick - Callback for toggle click
	 * @returns {HTMLElement} The created toggle button
	 */
	createSourceToggle(source, formatSourceName, onToggleClick) {
		const toggle = document.createElement('button');
		toggle.className = 'source-toggle';
		toggle.setAttribute('data-source', source);
		toggle.setAttribute('role', 'checkbox');
		toggle.setAttribute('aria-checked', 'false');
		toggle.setAttribute('tabindex', '0');
		toggle.setAttribute('type', 'button');

		const icon = document.createElement('i');
		icon.className = 'fas fa-book';
		toggle.appendChild(icon);

		const name = document.createElement('span');
		name.textContent = formatSourceName(source);
		toggle.appendChild(name);

		this._setupToggleEventListeners(toggle, onToggleClick);
		return toggle;
	}

	/**
	 * Set up event listeners for a source toggle
	 * @param {HTMLElement} toggle - The toggle button element
	 * @param {Function} onToggleClick - Callback for toggle click
	 * @private
	 */
	_setupToggleEventListeners(toggle, onToggleClick) {
		toggle.addEventListener('click', (e) => {
			e.preventDefault();
			onToggleClick(toggle);
		});
		toggle.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onToggleClick(toggle);
			}
		});
	}

	/**
	 * Create the source selection header with links
	 * @param {Function} onSelectAll - Callback for "Select All" link
	 * @param {Function} onSelectNone - Callback for "None" link
	 * @returns {HTMLElement} The header container with links
	 */
	createSourceHeader(onSelectAll, onSelectNone) {
		const headerContainer = document.createElement('div');
		headerContainer.className = 'mb-1';

		const header = document.createElement('label');
		header.className = 'form-label';
		header.textContent = 'Source Books';
		headerContainer.appendChild(header);

		const linksContainer = document.createElement('div');
		linksContainer.className = 'd-flex align-items-center gap-2 ps-2';

		const selectAllLink = this._createHeaderLink('Select All', onSelectAll);
		const divider = document.createElement('span');
		divider.className = 'text-muted';
		divider.textContent = '|';
		const selectNoneLink = this._createHeaderLink('None', onSelectNone);

		linksContainer.append(selectAllLink, divider, selectNoneLink);
		headerContainer.appendChild(linksContainer);

		return headerContainer;
	}

	/**
	 * Create a header link with the given text and click handler
	 * @param {string} text - Link text
	 * @param {Function} onClick - Click handler
	 * @returns {HTMLElement} The created link element
	 * @private
	 */
	_createHeaderLink(text, onClick) {
		const link = document.createElement('a');
		link.href = '#';
		link.className = 'text-decoration-none text-accent';
		link.textContent = text;
		link.addEventListener('click', (e) => {
			e.preventDefault();
			onClick();
		});
		return link;
	}

	/**
	 * Update toggle selection state
	 * @param {HTMLElement} toggle - The toggle button
	 * @param {boolean} isSelected - Whether the toggle should be selected
	 */
	updateToggleState(toggle, isSelected) {
		toggle.classList.toggle('selected', isSelected);
		toggle.setAttribute('aria-checked', String(isSelected));
	}

	/**
	 * Select all toggles in container
	 * @param {HTMLElement} container - Container element
	 * @returns {Array<HTMLElement>} Array of selected toggles
	 */
	selectAllToggles(container) {
		const toggles = container.querySelectorAll('.source-toggle');
		const changedToggles = [];

		for (const toggle of toggles) {
			if (!toggle.classList.contains('selected')) {
				changedToggles.push(toggle);
			}
		}

		return changedToggles;
	}

	/**
	 * Deselect all toggles in container
	 * @param {HTMLElement} container - Container element
	 * @returns {Array<HTMLElement>} Array of deselected toggles
	 */
	deselectAllToggles(container) {
		const toggles = container.querySelectorAll('.source-toggle');
		const changedToggles = [];

		for (const toggle of toggles) {
			if (toggle.classList.contains('selected')) {
				changedToggles.push(toggle);
			}
		}

		return changedToggles;
	}
}

export const sourcePickerView = new SourcePickerView();
