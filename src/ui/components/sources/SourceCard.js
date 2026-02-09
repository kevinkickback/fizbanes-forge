// Controller for source book selection during character creation

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { showNotification } from '../../../lib/Notifications.js';
import { sourceService } from '../../../services/SourceService.js';
import { SourcePickerView } from './SourcePickerView.js';

export class SourceCard {
	constructor() {
		this._container = null;
		this._headerContainer = null;
		this._sourceManager = sourceService;
		this._selectedSources = new Set();
		this._initialized = false;

		// Initialize view
		this._view = new SourcePickerView();

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();
	}

	async initializeSourceSelection() {
		try {
			if (!this._container) {
				console.error('[SourceCard]', 'Source selection container not found');
				return;
			}

			this._headerContainer = document.getElementById('sourceBookHeader');
			if (!this._headerContainer) {
				console.error('[SourceCard]', 'Source book header container not found');
				return;
			}

			if (!this._initialized) {
				await this._sourceManager.initialize();
				this._initialized = true;
			}

			this._container.innerHTML = '';
			this._headerContainer.innerHTML = '';

			// Render header with callbacks
			const header = this._view.createSourceHeader(
				() => this.selectAllSources(),
				() => this.deselectAllSources(),
				this._cleanup,
			);
			this._headerContainer.appendChild(header);

			// Render source toggles
			const availableSources = this._sourceManager.getAvailableSources();
			this._view.renderSourceToggles(
				this._container,
				availableSources,
				(source) => this._sourceManager.formatSourceName(source),
				(toggle) => this._handleSourceClick(toggle),
				this._cleanup,
			);

			// Pre-select default sources (PHB) on first visit
			if (this._selectedSources.size === 0) {
				this._preselectDefaultSources();
			}
		} catch (error) {
			console.error(
				'SourceCard',
				'Error initializing source selection:',
				error,
			);
		}
	}

	_preselectDefaultSources() {
		const defaultSources = new Set([
			'PHB', // Player's Handbook (2014)
		]);

		const toggles = this._container.querySelectorAll('.source-toggle');
		for (const toggle of toggles) {
			const source = toggle.getAttribute('data-source')?.toUpperCase();
			if (source && defaultSources.has(source)) {
				this._handleSourceClick(toggle);
			}
		}
	}

	_handleSourceClick(toggle) {
		try {
			toggle.preventDefault?.();

			const source = toggle.getAttribute('data-source');
			const isSelected = toggle.classList.contains('selected');

			// Update view
			this._view.updateToggleState(toggle, !isSelected);

			// Update model
			if (!isSelected) {
				this._selectedSources.add(source);
			} else {
				this._selectedSources.delete(source);
			}

			this._validateSourceSelection();
		} catch (error) {
			console.error('[SourceCard]', 'Error handling source click:', error);
		}
	}

	selectAllSources() {
		try {
			const toggles = this._view.selectAllToggles(this._container);
			for (const toggle of toggles) {
				this._handleSourceClick(toggle);
			}
		} catch (error) {
			console.error('[SourceCard]', 'Error selecting all sources:', error);
		}
	}

	deselectAllSources() {
		try {
			const toggles = this._view.deselectAllToggles(this._container);
			for (const toggle of toggles) {
				this._handleSourceClick(toggle);
			}
		} catch (error) {
			console.error('[SourceCard]', 'Error deselecting all sources:', error);
		}
	}

	validateSourceSelection(selectedSources) {
		if (!selectedSources.has('PHB') && !selectedSources.has('XPHB')) {
			showNotification(
				"Please select at least one Player's Handbook (PHB'14 or PHB'24)",
				'warning',
			);
			return false;
		}
		return true;
	}

	_validateSourceSelection() {
		if (
			!this._selectedSources.has('PHB') &&
			!this._selectedSources.has('XPHB')
		) {
			showNotification(
				"Please select at least one Player's Handbook (PHB'14 or PHB'24)",
				'warning',
			);
		}
	}

	async loadSources() {
		try {
			return await this._sourceManager.loadSources();
		} catch (error) {
			console.error('[SourceCard]', 'Error loading sources:', error);
			showNotification('Error loading sources', 'error');
			return [];
		}
	}

	addSource(sourceId) {
		try {
			this._selectedSources.add(sourceId);
			this._sourceManager.addSource(sourceId);
		} catch (error) {
			console.error('[SourceCard]', 'Error adding source:', error);
		}
	}

	removeSource(sourceId) {
		try {
			if (this._selectedSources.has(sourceId)) {
				this._selectedSources.delete(sourceId);
				this._sourceManager.removeSource(sourceId);
				return true;
			}
			return false;
		} catch (error) {
			console.error('[SourceCard]', 'Error removing source:', error);
			return false;
		}
	}

	clearSources() {
		try {
			this._selectedSources.clear();
			this._sourceManager.clearSources();
		} catch (error) {
			console.error('[SourceCard]', 'Error clearing sources:', error);
		}
	}

	get selectedSources() {
		return Array.from(this._selectedSources);
	}

	set selectedSources(sources) {
		this._selectedSources = new Set(sources);
	}

	set container(container) {
		this._container = container;
	}

	get container() {
		return this._container;
	}

	_cleanupEventListeners() {
		// Clean up all tracked DOM listeners
		this._cleanup.cleanup();
	}
}
