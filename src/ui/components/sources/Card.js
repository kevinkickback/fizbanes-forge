/** Controller for source book selection during character creation. */

import { showNotification } from '../../../lib/Notifications.js';
import { sourceService } from '../../../services/SourceService.js';
import { SourcePickerView } from './Picker.js';

/** Manages the source book selection UI component. */
export class SourceCard {
	/**
	 * Creates a new SourceCard instance
	 */
	constructor() {
		this._container = null;
		this._headerContainer = null;
		this._sourceManager = sourceService;
		this._selectedSources = new Set();
		this._initialized = false;

		// Initialize view
		this._view = new SourcePickerView();
	}

	/**
	 * Initialize the source book selection UI
	 * @returns {Promise<void>}
	 */
	async initializeSourceSelection() {
		try {
			if (!this._container) {
				console.error('SourceCard', 'Source selection container not found');
				return;
			}

			this._headerContainer = document.getElementById('sourceBookHeader');
			if (!this._headerContainer) {
				console.error('SourceCard', 'Source book header container not found');
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
			);
			this._headerContainer.appendChild(header);

			// Render source toggles
			const availableSources = this._sourceManager.getAvailableSources();
			this._view.renderSourceToggles(
				this._container,
				availableSources,
				(source) => this._sourceManager.formatSourceName(source),
				(toggle) => this._handleSourceClick(toggle),
			);

			// Pre-select PHB
			this._preselectDefaultSources();
		} catch (error) {
			console.error(
				'SourceCard',
				'Error initializing source selection:',
				error,
			);
		}
	}

	/**
	 * Pre-select default sources like the Player's Handbook
	 * @private
	 */
	_preselectDefaultSources() {
		const phbToggle = this._container.querySelector('[data-source="PHB"]');
		if (phbToggle) {
			this._handleSourceClick(phbToggle);
		}
	}

	/**
	 * Handle clicking a source toggle
	 * @param {HTMLElement} toggle - The clicked toggle button
	 * @private
	 */
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
			console.error('SourceCard', 'Error handling source click:', error);
		}
	}

	/**
	 * Select all available source books
	 */
	selectAllSources() {
		try {
			const toggles = this._view.selectAllToggles(this._container);
			for (const toggle of toggles) {
				this._handleSourceClick(toggle);
			}
		} catch (error) {
			console.error('SourceCard', 'Error selecting all sources:', error);
		}
	}

	/**
	 * Deselect all source books
	 */
	deselectAllSources() {
		try {
			const toggles = this._view.deselectAllToggles(this._container);
			for (const toggle of toggles) {
				this._handleSourceClick(toggle);
			}
		} catch (error) {
			console.error('SourceCard', 'Error deselecting all sources:', error);
		}
	}

	/**
	 * Validate the source selection
	 * @param {Set<string>} selectedSources - The set of selected source books
	 * @returns {boolean} Whether the selection is valid
	 */
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

	/**
	 * Validate the current source selection
	 * @private
	 */
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

	/**
	 * Load available source books
	 * @returns {Promise<Array>} Array of available sources
	 */
	async loadSources() {
		try {
			return await this._sourceManager.loadSources();
		} catch (error) {
			console.error('SourceCard', 'Error loading sources:', error);
			showNotification('Error loading sources', 'error');
			return [];
		}
	}

	/**
	 * Add a source to the selection
	 * @param {string} sourceId - The source book identifier
	 */
	addSource(sourceId) {
		try {
			this._selectedSources.add(sourceId);
			this._sourceManager.addSource(sourceId);
		} catch (error) {
			console.error('SourceCard', 'Error adding source:', error);
		}
	}

	/**
	 * Remove a source from the selection
	 * @param {string} sourceId - The source book identifier
	 * @returns {boolean} Whether the source was removed
	 */
	removeSource(sourceId) {
		try {
			if (this._selectedSources.has(sourceId)) {
				this._selectedSources.delete(sourceId);
				this._sourceManager.removeSource(sourceId);
				return true;
			}
			return false;
		} catch (error) {
			console.error('SourceCard', 'Error removing source:', error);
			return false;
		}
	}

	/**
	 * Clear all selected sources
	 */
	clearSources() {
		try {
			this._selectedSources.clear();
			this._sourceManager.clearSources();
		} catch (error) {
			console.error('SourceCard', 'Error clearing sources:', error);
		}
	}

	/**
	 * Get the currently selected sources
	 * @returns {Array<string>} Array of selected source IDs
	 */
	get selectedSources() {
		return Array.from(this._selectedSources);
	}

	/**
	 * Set the selected sources
	 * @param {Array<string>} sources - Array of source IDs to select
	 */
	set selectedSources(sources) {
		this._selectedSources = new Set(sources);
	}

	/**
	 * Set the container element for source toggles
	 * @param {HTMLElement} container - The container element
	 */
	set container(container) {
		this._container = container;
	}

	/**
	 * Get the container element for source toggles
	 * @returns {HTMLElement|null} The container element
	 */
	get container() {
		return this._container;
	}
}
