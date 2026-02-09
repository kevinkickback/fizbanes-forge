// View for rendering and handling source book toggle buttons

export class SourcePickerView {
	renderSourceToggles(
		container,
		availableSources,
		formatSourceName,
		onToggleClick,
		cleanup = null,
	) {
		container.innerHTML = '';
		const toggles = [];

		for (const source of availableSources) {
			const toggle = this.createSourceToggle(
				source,
				formatSourceName,
				onToggleClick,
				cleanup,
			);
			container.appendChild(toggle);
			toggles.push(toggle);
		}

		return toggles;
	}

	createSourceToggle(source, formatSourceName, onToggleClick, cleanup = null) {
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

		this._setupToggleEventListeners(toggle, onToggleClick, cleanup);
		return toggle;
	}

	_setupToggleEventListeners(toggle, onToggleClick, cleanup = null) {
		const clickHandler = (e) => {
			e.preventDefault();
			onToggleClick(toggle);
		};
		const keyHandler = (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onToggleClick(toggle);
			}
		};

		if (cleanup) {
			cleanup.on(toggle, 'click', clickHandler);
			cleanup.on(toggle, 'keydown', keyHandler);
		} else {
			toggle.addEventListener('click', clickHandler);
			toggle.addEventListener('keydown', keyHandler);
		}
	}

	createSourceHeader(onSelectAll, onSelectNone, cleanup = null) {
		const headerContainer = document.createElement('div');
		headerContainer.className = 'mb-1';

		const header = document.createElement('label');
		header.className = 'form-label';
		header.textContent = 'Source Books';
		headerContainer.appendChild(header);

		const linksContainer = document.createElement('div');
		linksContainer.className = 'd-flex align-items-center gap-2 ps-2';

		const selectAllLink = this._createHeaderLink('Select All', onSelectAll, cleanup);
		const divider = document.createElement('span');
		divider.className = 'text-muted';
		divider.textContent = '|';
		const selectNoneLink = this._createHeaderLink('None', onSelectNone, cleanup);

		linksContainer.append(selectAllLink, divider, selectNoneLink);
		headerContainer.appendChild(linksContainer);

		return headerContainer;
	}

	_createHeaderLink(text, onClick, cleanup = null) {
		const link = document.createElement('a');
		link.href = '#';
		link.className = 'text-decoration-none text-accent';
		link.textContent = text;
		const handler = (e) => {
			e.preventDefault();
			onClick();
		};

		if (cleanup) {
			cleanup.on(link, 'click', handler);
		} else {
			link.addEventListener('click', handler);
		}
		return link;
	}

	updateToggleState(toggle, isSelected) {
		toggle.classList.toggle('selected', isSelected);
		toggle.setAttribute('aria-checked', String(isSelected));
	}

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
