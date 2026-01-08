/** Handles page-specific initialization after templates render. */

import { eventBus, EVENTS } from '../utils/EventBus.js';

import { AbilityScoreCard } from '../modules/abilities/AbilityScoreCard.js';
import { BackgroundCard } from '../modules/background/BackgroundCard.js';
import { ClassCard } from '../modules/class/ClassCard.js';
import { FeatListView, FeatSourcesView } from '../modules/feats/FeatViews.js';
import { ProficiencyCard } from '../modules/proficiencies/ProficiencyCard.js';
import { RaceCard } from '../modules/race/RaceCard.js';
import { settingsService } from '../services/SettingsService.js';
import { showNotification } from '../utils/Notifications.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';
import { Modal } from './Modal.js';
import { storage } from './Storage.js';

class PageHandlerImpl {
	constructor() {
		this.isInitialized = false;
		this._featListView = new FeatListView();
		this._featListContainer = null;
		this._featSourcesView = new FeatSourcesView();
		this._featSourcesContainer = null;
		this._featListenersRegistered = false;
		this._onFeatsSelected = null;
		this._onCharacterUpdatedForFeats = null;
		this._onCharacterSelectedForFeats = null;
	}

	/**
	 * Initialize the page handler to listen for page load events
	 */
	initialize() {
		if (this.isInitialized) {
			console.warn('PageHandler', 'Already initialized');
			return;
		}

		// Listen for page loaded events
		eventBus.on(EVENTS.PAGE_LOADED, (pageName) => {
			this.handlePageLoaded(pageName);
		});

		this.isInitialized = true;
		console.info('PageHandler', 'Initialized successfully');
	}

	/**
	 * Handle a page being loaded
	 * @param {string} pageName - Name of the page that was loaded
	 */
	async handlePageLoaded(pageName) {
		console.info('PageHandler', 'Handling page loaded', { pageName });

		try {
			// Clean up home page listeners when leaving home
			if (pageName !== 'home' && this._homeCharacterSelectedHandler) {
				eventBus.off(
					EVENTS.CHARACTER_SELECTED,
					this._homeCharacterSelectedHandler,
				);
				this._homeCharacterSelectedHandler = null;
			}

			switch (pageName) {
				case 'home':
					await this.initializeHomePage();
					break;
				case 'settings':
					await this.initializeSettingsPage();
					break;
				case 'build':
					await this.initializeBuildPage();
					break;
				case 'details':
					await this.initializeDetailsPage();
					break;
				case 'equipment':
					await this.initializeEquipmentPage();
					break;
				case 'preview':
					await this.initializePreviewPage();
					break;
				default:
					console.debug('PageHandler', 'No special initialization for page', {
						pageName,
					});
			}
		} catch (error) {
			console.error('PageHandler', 'Error initializing page', {
				pageName,
				error,
			});
		}
	}

	/**
	 * Initialize the home page
	 */
	async initializeHomePage() {
		console.info('PageHandler', 'Initializing home page');

		try {
			// Ensure Modal button listeners are initialized (deferred until DOM is ready)
			const modal = Modal.getInstance();
			modal.ensureInitialized();

			// Get character list container and setup listeners once
			const characterList = document.getElementById('characterList');
			if (characterList) {
				this.setupCharacterCardListeners(characterList);
			}

			const characters = await CharacterManager.loadCharacterList();
			await this.renderCharacterList(characters);

			// Setup sort select listener
			const sortSelect = document.getElementById('sortSelect');
			if (sortSelect) {
				// Remove any existing listeners
				const newSortSelect = sortSelect.cloneNode(true);
				sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);

				newSortSelect.addEventListener('change', async (e) => {
					const sortOption = e.target.value;
					console.info('PageHandler', 'Sort option changed', { sortOption });

					// Re-render with current characters using new sort order
					if (this.currentCharacters) {
						await this.renderCharacterList(this.currentCharacters);
					}
				});
			}

			// Setup Modal event listeners for New Character and Import buttons
			modal.setupEventListeners({
				onShowModal: async (e) => {
					await modal.showNewCharacterModal(e);
				},
				onCreateCharacter: async (character) => {
					console.info('PageHandler', 'Character created', {
						id: character.id,
					});
					// Reload the character list
					const reloadCharacters = await CharacterManager.loadCharacterList();
					await this.renderCharacterList(reloadCharacters);
				},
			});

			// Setup import character button
			const importButton = document.getElementById('importCharacterBtn');
			if (importButton) {
				// Remove any existing listeners
				const newImportButton = importButton.cloneNode(true);
				importButton.parentNode.replaceChild(newImportButton, importButton);

				newImportButton.addEventListener('click', async () => {
					await this.handleImportCharacter();
				});
			}

			// Listen for character selection to update the active badge in real-time
			// Remove any existing listener to avoid duplicates
			eventBus.off(
				EVENTS.CHARACTER_SELECTED,
				this._homeCharacterSelectedHandler,
			);

			// Store the handler so we can remove it later
			this._homeCharacterSelectedHandler = async () => {
				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			};

			eventBus.on(
				EVENTS.CHARACTER_SELECTED,
				this._homeCharacterSelectedHandler,
			);
		} catch (error) {
			console.error('PageHandler', 'Error initializing home page', error);
			showNotification('Error loading home page', 'error');
		}
	}

	/**
	 * Sort characters based on the selected sorting option
	 * @param {Array} characters - Array of character objects
	 * @param {string} sortOption - The sorting option to apply
	 * @returns {Array} Sorted array of characters
	 */
	sortCharacters(characters, sortOption) {
		const sorted = [...characters]; // Create a copy to avoid mutating original

		switch (sortOption) {
			case 'name':
				sorted.sort((a, b) =>
					(a.name || 'Unnamed').localeCompare(b.name || 'Unnamed'),
				);
				break;
			case 'name-desc':
				sorted.sort((a, b) =>
					(b.name || 'Unnamed').localeCompare(a.name || 'Unnamed'),
				);
				break;
			case 'level':
				sorted.sort((a, b) => {
					const levelA = a.level || a.class?.level || 1;
					const levelB = b.level || b.class?.level || 1;
					return levelA - levelB;
				});
				break;
			case 'level-desc':
				sorted.sort((a, b) => {
					const levelA = a.level || a.class?.level || 1;
					const levelB = b.level || b.class?.level || 1;
					return levelB - levelA;
				});
				break;
			case 'modified':
				sorted.sort((a, b) => {
					const dateA = new Date(a.lastModified || 0).getTime();
					const dateB = new Date(b.lastModified || 0).getTime();
					return dateB - dateA; // Descending: most recent first
				});
				break;
			case 'modified-asc':
				sorted.sort((a, b) => {
					const dateA = new Date(a.lastModified || 0).getTime();
					const dateB = new Date(b.lastModified || 0).getTime();
					return dateA - dateB; // Ascending: oldest first
				});
				break;
			default:
				// Default to name sort
				sorted.sort((a, b) =>
					(a.name || 'Unnamed').localeCompare(b.name || 'Unnamed'),
				);
		}

		return sorted;
	}

	/**
	 * Render the character list on the home page
	 * @param {Array} characters - Array of character objects
	 */
	async renderCharacterList(characters) {
		const characterList = document.getElementById('characterList');

		if (!characterList) {
			console.warn('PageHandler', 'Character list element not found');
			return;
		}

		if (characters.length === 0) {
			this.showEmptyState(characterList);
			// Hide the top row with New Character button when there are no characters
			const topButtonRow = document.querySelector('.row.mb-4');
			if (topButtonRow) {
				topButtonRow.style.display = 'none';
			}
			return;
		}

		// Show the top row with New Character button when there are characters
		const topButtonRow = document.querySelector('.row.mb-4');
		if (topButtonRow) {
			topButtonRow.style.display = '';
		}

		// Get the sort option and apply sorting
		const sortSelect = document.getElementById('sortSelect');
		const sortOption = sortSelect ? sortSelect.value : 'name';
		const sortedCharacters = this.sortCharacters(characters, sortOption);

		// Store characters for later use when sort changes
		this.currentCharacters = sortedCharacters;

		// Get the currently active character ID
		const currentCharacter = AppState.getCurrentCharacter();
		const activeCharacterId = currentCharacter?.id;

		characterList.innerHTML = sortedCharacters
			.map((character) => {
				const isActive = character.id === activeCharacterId;
				const characterClass = character.class?.name || 'No Class';
				const characterRace = character.race?.name || 'No Race';
				const characterLevel = character.level || character.class?.level || 1;
				const subclassNameRaw = character.class?.subclass;
				const subclassName =
					typeof subclassNameRaw === 'string'
						? subclassNameRaw
						: subclassNameRaw?.name ||
						subclassNameRaw?.title ||
						subclassNameRaw?.id;
				const classDisplay = subclassName
					? `${subclassName} - ${characterClass}`
					: characterClass;
				const portraitUrl =
					character.portrait || character.image || character.avatar || '';
				const lastModified = character.lastModified
					? new Date(character.lastModified).toLocaleDateString()
					: 'Unknown';

				return `
                <div class="col-md-6 col-lg-4 mb-4">
					<div class="card character-card ${isActive ? 'selected' : ''}" data-character-id="${character.id}">
						<div class="card-header py-2">
							<h5 class="mb-0">
								<i class="fas fa-user me-2"></i>
								${character.name || 'Unnamed Character'}
							</h5>
							${isActive ? '<div class="active-profile-badge">Active</div>' : ''}
						</div>
						<div class="card-body">
							<div class="character-main">
								<div class="character-portrait">
									${portraitUrl
						? `<img src="${portraitUrl}" alt="${character.name || 'Character portrait'}" />`
						: '<div class="portrait-fallback"><i class="fas fa-user"></i></div>'
					}
								</div>
								<div class="character-info">
									<div class="character-details">
										<div class="detail-item">
											<i class="fas fa-crown me-2"></i>
											<span>Level ${characterLevel}</span>
										</div>
										<div class="detail-item">
											<i class="fas fa-user-friends me-2"></i>
											<span>${characterRace}</span>
										</div>
										<div class="detail-item">
											<i class="fas fa-hat-wizard me-2"></i>
											<span>${classDisplay}</span>
										</div>
									</div>
									<div class="last-modified">
										<i class="fas fa-clock me-2"></i>
										<span>Last modified: ${lastModified}</span>
									</div>
								</div>
							</div>
							<div class="card-actions mt-3">
								<button class="btn btn-lg btn-outline-secondary export-character" 
									data-character-id="${character.id}" 
									title="Export Character">
									<i class="fas fa-file-export"></i>
								</button>
								<button class="btn btn-lg btn-outline-danger delete-character" 
									data-character-id="${character.id}" 
									title="Delete Character">
									<i class="fas fa-trash"></i>
								</button>
							</div>
						</div>
					</div>
                </div>
            `;
			})
			.join('');

		console.info('PageHandler', 'Character list rendered', {
			count: sortedCharacters.length,
		});
	}

	/**
	 * Setup event listeners for character card actions (initialized once)
	 * @param {HTMLElement} container - The container with character cards
	 */
	setupCharacterCardListeners(container) {
		if (!container || container._listenersAttached) return;

		container._listenersAttached = true;

		// Handle character card clicks to load the character
		container.addEventListener('click', async (e) => {
			const card = e.target.closest('.character-card');
			if (!card) return;

			// Don't load if clicking on action buttons
			if (e.target.closest('.card-actions')) return;

			const characterId = card.dataset.characterId;
			if (characterId) {
				console.debug(
					'PageHandler',
					`[${new Date().toISOString()}] Character card clicked: ${characterId}`,
				);
				try {
					const character = await CharacterManager.loadCharacter(characterId);
					console.info(
						'PageHandler',
						`✓ Character loaded from card: ${characterId}`,
						{
							character: character?.name,
						},
					);

					// Check floating bar state AFTER load
					const floatingBar = document.querySelector('.floating-actions');
					const floatingBarVisible = floatingBar
						? window.getComputedStyle(floatingBar).display !== 'none'
						: false;
					console.debug(
						'PageHandler',
						`After character load - floating bar visible: ${floatingBarVisible}`,
						{
							dataCurrentPage: document.body.getAttribute('data-current-page'),
						},
					);
				} catch (error) {
					console.error('PageHandler', 'Failed to load character', {
						id: characterId,
						error: error.message,
					});
					showNotification('Failed to load character', 'error');
				}
			}
		});

		// Handle export button clicks
		container.addEventListener('click', async (e) => {
			const exportBtn = e.target.closest('.export-character');
			if (!exportBtn) return;

			e.stopPropagation();
			const characterId = exportBtn.dataset.characterId;
			if (characterId) {
				const success = await storage.exportCharacter(characterId);
				if (success) {
					showNotification('Character exported successfully', 'success');
				} else {
					showNotification('Failed to export character', 'error');
				}
			}
		});

		// Handle delete button clicks
		container.addEventListener('click', async (e) => {
			const deleteBtn = e.target.closest('.delete-character');
			if (!deleteBtn) return;

			e.stopPropagation();
			const characterId = deleteBtn.dataset.characterId;
			if (characterId) {
				const modal = Modal.getInstance();
				const confirmed = await modal.showConfirmationModal({
					title: 'Delete Character',
					message:
						'Are you sure you want to delete this character? This cannot be undone.',
					confirmButtonText: 'Delete',
					confirmButtonClass: 'btn-danger',
				});

				if (confirmed) {
					try {
						await CharacterManager.deleteCharacter(characterId);
						showNotification('Character deleted successfully', 'success');
						const reloadCharacters = await CharacterManager.loadCharacterList();
						await this.renderCharacterList(reloadCharacters);
					} catch (error) {
						console.error('PageHandler', 'Failed to delete character', error);
						showNotification('Failed to delete character', 'error');
					}
				}
			}
		});
	}

	/**
	 * Handle import character button click
	 */
	async handleImportCharacter() {
		try {
			console.info('PageHandler', 'Importing character');

			const result = await storage.importCharacter();

			if (result.success && result.character) {
				showNotification('Character imported successfully', 'success');

				// Reload character list
				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			} else if (result.canceled) {
				console.info('PageHandler', 'Import canceled');
				showNotification('Import cancelled', 'info');
			} else {
				showNotification('Failed to import character', 'error');
			}
		} catch (error) {
			console.error('PageHandler', 'Error importing character', error);
			showNotification('Error importing character', 'error');
		}
	}

	/**
	 * Show the empty state when no characters exist
	 * @param {HTMLElement} container - The container element to show empty state in
	 */
	showEmptyState(container) {
		if (!container) return;

		container.innerHTML = `
            <div class="content-center-vertical">
                <div class="empty-state text-center">
                    <i class="fas fa-users fa-5x mb-4 text-muted"></i>
                    <h2 class="mb-3">No Characters</h2>
                    <p class="lead">Create or import a character to get started!</p>
                    <div class="d-flex justify-content-center gap-2">
                        <button id="welcomeCreateCharacterBtn" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Create Character
                        </button>
                        <button id="emptyStateImportBtn" class="btn btn-secondary">
                            <i class="fas fa-file-import"></i> Import Character
                        </button>
                    </div>
                </div>
            </div>
        `;

		// Add event listener to the Create Character button
		const createBtn = container.querySelector('#welcomeCreateCharacterBtn');
		if (createBtn) {
			createBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				const modal = Modal.getInstance();
				await modal.showNewCharacterModal(e);
			});
		}

		// Add event listener to the Import Character button
		const importBtn = container.querySelector('#emptyStateImportBtn');
		if (importBtn) {
			importBtn.addEventListener('click', async () => {
				await this.handleImportCharacter();
			});
		}
	}

	/**
	 * Initialize the settings page
	 */
	async initializeSettingsPage() {
		console.info('PageHandler', 'Initializing settings page');

		try {
			await settingsService.initializeSettingsPage();
		} catch (error) {
			console.error('PageHandler', 'Error initializing settings page', error);
			showNotification('Error loading settings page', 'error');
		}
	}

	/**
	 * Initialize the build page
	 */
	async initializeBuildPage() {
		console.info('PageHandler', 'Initializing build page');

		try {
			// Initialize all build page cards
			// These components will handle populating dropdowns and fields based on character data
			new RaceCard();
			new ClassCard();
			new BackgroundCard();

			// AbilityScoreCard and ProficiencyCard require explicit initialize() call
			// Use singleton instance to ensure proper state management across page navigations
			const abilityScoreCard = AbilityScoreCard.getInstance();
			await abilityScoreCard.initialize();

			const proficiencyCard = new ProficiencyCard();
			await proficiencyCard.initialize();

			// Set up feat sources footer rendering and listeners
			this._initializeFeatSources();

			// --- FeatSelectionModal integration ---
			// Add event listener to the "+ Add Feat" button
			const addFeatBtn = document.getElementById('addFeatBtn');
			if (addFeatBtn) {
				// Remove any existing listeners by replacing the node
				const newAddFeatBtn = addFeatBtn.cloneNode(true);
				addFeatBtn.parentNode.replaceChild(newAddFeatBtn, addFeatBtn);
				newAddFeatBtn.addEventListener('click', async () => {
					// Dynamically import the FeatSelectionModal to avoid circular deps
					const { FeatSelectionModal } = await import(
						'../modules/feats/FeatSelectionModal.js'
					);
					const modal = new FeatSelectionModal();
					await modal.show();
				});

				this._updateFeatUIState(AppState.getCurrentCharacter());
			}

			console.info('PageHandler', 'Build page cards initialized');
		} catch (error) {
			console.error('PageHandler', 'Error initializing build page', error);
			showNotification('Error initializing build page', 'error');
		}
	}

	_initializeFeatSources() {
		this._featListContainer = document.getElementById('featList');
		this._featSourcesContainer = document.getElementById('featSources');
		if (!this._featSourcesContainer) {
			console.debug('PageHandler', 'Feat sources container not found');
			return;
		}

		const character = AppState.getCurrentCharacter();
		this._featListView.update(this._featListContainer, character);
		this._featSourcesView.update(this._featSourcesContainer, character);
		this._updateFeatUIState(character);

		if (this._featListenersRegistered) {
			return;
		}

		this._onFeatsSelected = (selectedFeats) => {
			console.debug('PageHandler', 'FEATS_SELECTED event received', {
				count: Array.isArray(selectedFeats) ? selectedFeats.length : 0,
				feats: Array.isArray(selectedFeats)
					? selectedFeats.map((f) => f.name)
					: selectedFeats,
			});
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded');
				return;
			}

			const availability = character.getFeatAvailability?.();
			const allowedCount = Math.max(0, availability?.max || 0);
			const featsToStore = allowedCount
				? selectedFeats.slice(0, allowedCount)
				: [];

			console.debug('PageHandler', 'Setting feats on character', {
				allowedCount,
				count: featsToStore.length,
			});
			character.setFeats(featsToStore, 'Manual selection');
			this._featListView.update(this._featListContainer, character);
			this._featSourcesView.update(this._featSourcesContainer, character);
			this._updateFeatUIState(character);
			eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
		};

		this._onCharacterUpdatedForFeats = ({ character }) => {
			this._featListView.update(
				this._featListContainer,
				character || AppState.getCurrentCharacter(),
			);
			this._featSourcesView.update(
				this._featSourcesContainer,
				character || AppState.getCurrentCharacter(),
			);
			this._updateFeatUIState(character || AppState.getCurrentCharacter());
		};

		this._onCharacterSelectedForFeats = (character) => {
			this._featListView.update(
				this._featListContainer,
				character || AppState.getCurrentCharacter(),
			);
			this._featSourcesView.update(
				this._featSourcesContainer,
				character || AppState.getCurrentCharacter(),
			);
			this._updateFeatUIState(character || AppState.getCurrentCharacter());
		};

		eventBus.on(EVENTS.FEATS_SELECTED, this._onFeatsSelected);
		eventBus.on(EVENTS.CHARACTER_UPDATED, this._onCharacterUpdatedForFeats);
		eventBus.on(EVENTS.CHARACTER_SELECTED, this._onCharacterSelectedForFeats);

		this._featListenersRegistered = true;
	}

	_updateFeatUIState(character) {
		const featCountEl = document.getElementById('featCount');
		const maxFeatsEl = document.getElementById('maxFeats');
		const selectionCounter = document.querySelector('.selection-counter');
		const addFeatBtn = document.getElementById('addFeatBtn');

		const availability = character?.getFeatAvailability?.() || {
			used: character?.feats?.length || 0,
			max: 0,
			remaining: 0,
			reasons: [],
			blockedReason: 'No feat selections available.',
		};

		if (featCountEl) {
			featCountEl.textContent = availability.used ?? 0;
		}

		if (maxFeatsEl) {
			maxFeatsEl.textContent = availability.max ?? 0;
		}

		// Hide selection counter when no feats are available
		if (selectionCounter) {
			selectionCounter.style.display = availability.max > 0 ? '' : 'none';
		}

		if (addFeatBtn) {
			addFeatBtn.disabled = availability.max <= 0;
			addFeatBtn.title =
				availability.max > 0
					? ''
					: availability.blockedReason ||
					'No feat selections available. Choose Variant Human or reach level 4.';
		}
	}

	/**
	 * Initialize the details page
	 */
	async initializeDetailsPage() {
		console.info('PageHandler', 'Initializing details page');

		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for details page');
				return;
			}

			// Populate character info fields
			const characterNameInput = document.getElementById('characterName');
			const playerNameInput = document.getElementById('playerName');
			const heightInput = document.getElementById('height');
			const weightInput = document.getElementById('weight');
			const genderInput = document.getElementById('gender');
			const backstoryTextarea = document.getElementById('backstory');

			if (characterNameInput) characterNameInput.value = character.name || '';
			if (playerNameInput) playerNameInput.value = character.playerName || '';
			if (heightInput) heightInput.value = character.height || '';
			if (weightInput) weightInput.value = character.weight || '';
			if (genderInput) genderInput.value = character.gender || '';
			if (backstoryTextarea)
				backstoryTextarea.value = character.backstory || '';

			// Set up form change listeners for unsaved changes detection
			this._setupDetailsPageFormListeners();

			console.info('PageHandler', 'Details page populated with character data');
		} catch (error) {
			console.error('PageHandler', 'Error initializing details page', error);
			showNotification('Error loading details page', 'error');
		}
	}

	/**
	 * Set up event listeners for form fields on the details page
	 * @private
	 */
	_setupDetailsPageFormListeners() {
		const detailsFields = [
			'characterName',
			'playerName',
			'height',
			'weight',
			'gender',
			'backstory',
		];

		detailsFields.forEach((fieldId) => {
			const field = document.getElementById(fieldId);
			if (field) {
				// Use input event for real-time change detection
				field.addEventListener('input', () => {
					console.debug(
						'PageHandler',
						`Form field changed (${fieldId}), emitting CHARACTER_UPDATED`,
					);
					// Emit CHARACTER_UPDATED event for form input changes
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: AppState.getCurrentCharacter(),
					});
				});
			}
		});
	}

	/**
	 * Initialize the equipment page
	 */
	async initializeEquipmentPage() {
		console.info('PageHandler', 'Initializing equipment page');

		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for equipment page');
				return;
			}

			// Equipment page components can be initialized here
			// For now, just log that the page is ready
			console.info('PageHandler', 'Equipment page initialized');
		} catch (error) {
			console.error('PageHandler', 'Error initializing equipment page', error);
			showNotification('Error loading equipment page', 'error');
		}
	}



	/**
	 * Initialize the preview page
	 */
	async initializePreviewPage() {
		console.info('PageHandler', 'Initializing preview page');

		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for preview page');
				return;
			}

			// Preview page components can be initialized here
			// For now, just log that the page is ready
			console.info('PageHandler', 'Preview page initialized');
		} catch (error) {
			console.error('PageHandler', 'Error initializing preview page', error);
			showNotification('Error loading preview page', 'error');
		}
	}
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
