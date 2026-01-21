/** Handles page-specific initialization after templates render. */

import { eventBus, EVENTS } from '../lib/EventBus.js';

import { ALIGNMENTS } from '../lib/constants.js';
import { showNotification } from '../lib/Notifications.js';
import { deityService } from '../services/DeityService.js';
import { settingsService } from '../services/SettingsService.js';
import { AbilityScoreCard } from '../ui/components/abilities/AbilityScoreCard.js';
import { BackgroundCard } from '../ui/components/background/BackgroundCard.js';
import { ClassFeatSelector } from '../ui/components/class-progression/ClassFeatSelector.js';
import { ClassCard } from '../ui/components/class/ClassSelectionCard.js';
import { FeatListView, FeatSourcesView } from '../ui/components/feats/FeatSelectionModal.js';
import { ProficiencyCard } from '../ui/components/proficiencies/ProficiencyCard.js';
import { RaceCard } from '../ui/components/race/RaceCard.js';
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
		console.debug('PageHandler', 'Initialized successfully');
	}

	async handlePageLoaded(pageName) {
		console.debug('PageHandler', 'Handling page loaded', { pageName });
		try {
			// Clean up home page listeners when leaving home
			if (pageName !== 'home') {
				if (this._homeCharacterSelectedHandler) {
					eventBus.off(
						EVENTS.CHARACTER_SELECTED,
						this._homeCharacterSelectedHandler,
					);
					this._homeCharacterSelectedHandler = null;
				}
				if (this._homeCharacterCreatedHandler) {
					eventBus.off(
						EVENTS.CHARACTER_CREATED,
						this._homeCharacterCreatedHandler,
					);
					this._homeCharacterCreatedHandler = null;
				}
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
				case 'feats':
					await this.initializeFeatsPage();
					break;
				case 'equipment':
					await this.initializeEquipmentPage();
					break;
				case 'spells':
					await this.initializeSpellsPage();
					break;
				case 'preview':
					await this.initializePreviewPage();
					break;
				case 'layout-test':
					await this.initializeLayoutTestPage();
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

			// Listen for character creation to refresh the list
			// Remove any existing listener to avoid duplicates
			eventBus.off(
				EVENTS.CHARACTER_CREATED,
				this._homeCharacterCreatedHandler,
			);

			// Store the handler so we can remove it later
			this._homeCharacterCreatedHandler = async () => {
				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			};

			eventBus.on(
				EVENTS.CHARACTER_CREATED,
				this._homeCharacterCreatedHandler,
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
			characterList.classList.add('empty-state-mode');
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
		characterList.classList.remove('empty-state-mode');

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
				const characterRace = character.race?.name || 'No Race';
				const progressionClasses = Array.isArray(character.progression?.classes)
					? character.progression.classes
					: [];
				const characterLevel = character.getTotalLevel();
				const classDisplay = progressionClasses.length
					? progressionClasses
						.map((cls) => {
							return cls.name || 'Unknown Class';
						})
						.join('<br>')
					: 'No Class';
				// Default placeholder portraits
				const placeholderImages = ['assets/images/characters/placeholder_char_card.webp',
					'assets/images/characters/placeholder_char_card2.webp',
					'assets/images/characters/placeholder_char_card3.webp'
				];
				const defaultPlaceholder = placeholderImages[0];

				const rawPortrait =
					character.portrait || character.image || character.avatar || defaultPlaceholder;
				const portraitUrl = (() => {
					if (!rawPortrait) return defaultPlaceholder;
					// Already a data URL or file URL
					if (rawPortrait.startsWith('data:') || rawPortrait.startsWith('file://')) {
						return rawPortrait;
					}
					// Windows absolute path -> file URL
					if (/^[A-Za-z]:\\/.test(rawPortrait)) {
						return `file://${rawPortrait.replace(/\\/g, '/')}`;
					}
					// Normalize backslashes to forward slashes for CSS url()
					return rawPortrait.replace(/\\/g, '/');
				})();
				const lastModified = character.lastModified
					? new Date(character.lastModified).toLocaleDateString()
					: 'Unknown';

				return `
					<div class="card character-card ${isActive ? 'selected' : ''}" data-character-id="${character.id}">
						<div class="character-portrait" style="background-image: url('${portraitUrl}');"></div>
						<div class="card-header py-2">
							<h5 class="mb-0">
								<i class="fas fa-user me-2"></i>
								${character.name || 'Unnamed Character'}
							</h5>
							${isActive ? '<div class="active-profile-badge">Active</div>' : ''}
						</div>
						<div class="card-body">
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
								</div>

								<div class="card-actions-wrap mt-3">
									<div class="card-actions">
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
									<div class="last-modified">
										<i class="fas fa-clock me-2"></i>
										<span>Last modified: ${lastModified}</span>
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

					// Character loaded successfully
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
			this._updateFeatAvailabilitySection(character);
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
			this._updateFeatAvailabilitySection(character || AppState.getCurrentCharacter());
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
			this._updateFeatAvailabilitySection(character || AppState.getCurrentCharacter());
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

		// Always enable Add Feat button to allow unconventional feat sources
		if (addFeatBtn) {
			addFeatBtn.disabled = false;
			addFeatBtn.title = availability.max > 0
				? `${availability.remaining} feat choice(s) remaining`
				: 'Add feats from any source (racial features, magic items, etc.)';
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

			// Populate alignment dropdown
			const alignmentInput = document.getElementById('alignment');
			if (alignmentInput) {
				// Clear existing options except the first (placeholder)
				while (alignmentInput.options.length > 1) {
					alignmentInput.remove(1);
				}
				// Populate from constants
				ALIGNMENTS.forEach((alignment) => {
					const option = document.createElement('option');
					option.value = alignment.value;
					option.textContent = alignment.label;
					alignmentInput.appendChild(option);
				});
				alignmentInput.value = character.alignment || '';
			}

			// Populate deity datalist
			const deityInput = document.getElementById('deity');
			const deityList = document.getElementById('deityList');
			if (deityList) {
				// Clear existing options
				deityList.innerHTML = '';
				// Populate from deity service
				const deityNames = deityService.getDeityNames();
				deityNames.forEach((name) => {
					const option = document.createElement('option');
					option.value = name;
					deityList.appendChild(option);
				});
			}
			if (deityInput) {
				deityInput.value = character.deity || '';
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
			'alignment',
			'deity',
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
	 * Initialize the feats page
	 */
	async initializeFeatsPage() {
		console.info('PageHandler', 'Initializing feats page');

		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for feats page');
				return;
			}

			// Set up feat sources footer rendering and listeners
			this._initializeFeatSources();

			// --- Feat Selection Modal integration ---
			// Add event listener to the "+ Add Feat" button
			const addFeatBtn = document.getElementById('addFeatBtn');
			if (addFeatBtn) {
				// Remove any existing listeners by replacing the node
				const newAddFeatBtn = addFeatBtn.cloneNode(true);
				addFeatBtn.parentNode.replaceChild(newAddFeatBtn, addFeatBtn);
				newAddFeatBtn.addEventListener('click', async () => {
					const availability = character.getFeatAvailability?.();
					const maxFeats = availability?.max || 0;

					// Inform user if they have no standard feat choices, but still allow selection
					if (maxFeats <= 0) {
						showNotification(
							'Adding feats beyond normal choices (from racial features, magic items, etc.)',
							'info'
						);
					}

					const selector = new ClassFeatSelector();
					await selector.show({
						currentSelection: character.feats || [],
						multiSelect: true,
						maxSelections: maxFeats,
						onConfirm: async (feats) => {
							if (feats && feats.length > 0) {
								// Enrich feats with origin information
								// Only assign reasons to feats up to the number of available reasons
								// Additional feats beyond that are marked as "Manual selection"
								const reasons = availability?.reasons || [];
								const enrichedFeats = feats.map((feat, idx) => ({
									...feat,
									origin: feat.origin || (idx < reasons.length ? this._formatFeatOrigin(reasons[idx]) : 'Manual selection')
								}));

								// Update character feats
								character.setFeats(enrichedFeats, 'Manual selection');

								// Update UI
								this._featListView.update(this._featListContainer, character);
								this._featSourcesView.update(this._featSourcesContainer, character);
								this._updateFeatUIState(character);
								this._updateFeatAvailabilitySection(character);

								eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
								showNotification(`${feats.length} feat(s) selected!`, 'success');
							}
						}
					});
				});

				this._updateFeatUIState(character);
			}

			// Update feat availability info
			this._updateFeatAvailabilitySection(character);

			console.info('PageHandler', 'Feats page initialized');
		} catch (error) {
			console.error('PageHandler', 'Error initializing feats page', error);
			showNotification('Error loading feats page', 'error');
		}
	}

	_updateFeatAvailabilitySection(character) {
		const featSourcesContainer = document.getElementById('featSources');

		if (!character) return;

		// Show/hide feat sources if feats exist
		if (featSourcesContainer) {
			featSourcesContainer.style.display = character.feats?.length > 0 ? 'block' : 'none';
		}
	}

	/**
	 * Format feat origin/reason for display
	 * Extracts the category portion from the reason
	 * @param {string} reason - Raw reason string from FeatService (e.g., "Race: Human", "Ability Score Improvement at level 4 (Fighter)")
	 * @returns {string} The category (e.g., "Race", "Ability Score Improvement")
	 */
	_formatFeatOrigin(reason) {
		if (!reason) return '';

		// Handle "ASI" abbreviation from level-up
		if (reason === 'ASI') return 'Ability Score Improvement';

		// Extract "Ability Score Improvement" from full text
		if (reason.startsWith('Ability Score Improvement')) {
			return 'Ability Score Improvement';
		}

		// For other reasons with colons, extract the category prefix
		const match = reason.match(/^([^:]+):/);
		return match ? match[1].trim() : reason.trim();
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

			// Initialize equipment manager component
			const { EquipmentManager } = await import(
				'../ui/components/equipment/EquipmentManager.js'
			);
			const equipmentManager = new EquipmentManager();
			equipmentManager.render();

			// Listen for updates and re-render
			const updateHandler = () => equipmentManager.render();
			eventBus.on(EVENTS.CHARACTER_UPDATED, updateHandler);
			eventBus.on(EVENTS.ITEM_ADDED, updateHandler);
			eventBus.on(EVENTS.ITEM_REMOVED, updateHandler);
			eventBus.on(EVENTS.ITEM_EQUIPPED, updateHandler);
			eventBus.on(EVENTS.ITEM_UNEQUIPPED, updateHandler);

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

	/**
	 * Initialize the spells page
	 */
	async initializeSpellsPage() {
		console.info('PageHandler', 'Initializing spells page');

		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for spells page');
				return;
			}

			// Initialize spells manager component
			const { SpellsManager } = await import(
				'../ui/components/spells/SpellManager.js'
			);
			const spellsManager = new SpellsManager();
			spellsManager.render();

			// Listen for updates and re-render
			const updateHandler = () => spellsManager.render();
			eventBus.on(EVENTS.CHARACTER_UPDATED, updateHandler);
			eventBus.on(EVENTS.SPELL_ADDED, updateHandler);
			eventBus.on(EVENTS.SPELL_REMOVED, updateHandler);
			eventBus.on(EVENTS.SPELL_PREPARED, updateHandler);
			eventBus.on(EVENTS.SPELL_UNPREPARED, updateHandler);
			eventBus.on(EVENTS.SPELL_SLOTS_USED, updateHandler);
			eventBus.on(EVENTS.SPELL_SLOTS_RESTORED, updateHandler);

			console.info('PageHandler', 'Spells page initialized');
		} catch (error) {
			console.error('PageHandler', 'Error initializing spells page', error);
			showNotification('Error loading spells page', 'error');
		}
	}

	async initializeLayoutTestPage() {
		console.info('PageHandler', 'Initializing layout test page');

		try {
			// Import and initialize the demo module
			const { SplitCardDemo } = await import('../ui/scripts/layout-test.js');

			// Create instance and await initialization
			const demo = new SplitCardDemo();
			await demo.init();

			// Store for cleanup if needed
			window._splitCardDemoInstance = demo;

			console.info('PageHandler', 'Layout test page initialized successfully');
		} catch (error) {
			console.error('PageHandler', 'Error initializing layout test page', error);
			showNotification('Error loading layout test page', 'error');
		}
	}
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
