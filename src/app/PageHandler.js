import { eventBus, EVENTS } from '../lib/EventBus.js';

import { ALIGNMENTS } from '../lib/constants.js';
import { showNotification } from '../lib/Notifications.js';
import { deityService } from '../services/DeityService.js';
import { settingsService } from '../services/SettingsService.js';
import { AbilityScoreCard } from '../ui/components/abilities/AbilityScoreCard.js';
import { BackgroundCard } from '../ui/components/background/BackgroundCard.js';
import { ClassFeatSelector } from '../ui/components/class-progression/ClassFeatSelector.js';
import { ClassCard } from '../ui/components/class/ClassSelectionCard.js';
import {
	FeatListView,
	FeatSourcesView,
} from '../ui/components/feats/FeatSelectionModal.js';
import { ProficiencyCard } from '../ui/components/proficiencies/ProficiencyCard.js';
import { RaceCard } from '../ui/components/race/RaceCard.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';
import { Modal } from './Modal.js';

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
			return;
		}

		eventBus.on(EVENTS.PAGE_LOADED, (pageName) => {
			this.handlePageLoaded(pageName);
		});

		this.isInitialized = true;
	}

	async handlePageLoaded(pageName) {
		try {
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
		try {
			const modal = Modal.getInstance();
			modal.ensureInitialized();

			const characterList = document.getElementById('characterList');
			if (characterList) {
				this.setupCharacterCardListeners(characterList);
			}

			const characters = await CharacterManager.loadCharacterList();
			await this.renderCharacterList(characters);

			const sortSelect = document.getElementById('sortSelect');
			if (sortSelect) {
				const newSortSelect = sortSelect.cloneNode(true);
				sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);

				newSortSelect.addEventListener('change', async () => {
				});
			}

			// Setup Modal event listeners for New Character and Import buttons
			modal.setupEventListeners({
				onShowModal: async (e) => {
					await modal.showNewCharacterModal(e);
				},
				onCreateCharacter: async () => {
					const reloadCharacters = await CharacterManager.loadCharacterList();
					await this.renderCharacterList(reloadCharacters);
				},
			});

			const importButton = document.getElementById('importCharacterBtn');
			if (importButton) {
				const newImportButton = importButton.cloneNode(true);
				importButton.parentNode.replaceChild(newImportButton, importButton);

				newImportButton.addEventListener('click', async () => {
					await this.handleImportCharacter();
				});
			}

			// Remove old handler if it exists before adding new one
			if (this._homeCharacterSelectedHandler) {
				eventBus.off(
					EVENTS.CHARACTER_SELECTED,
					this._homeCharacterSelectedHandler,
				);
			}

			this._homeCharacterSelectedHandler = async () => {
				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			};

			eventBus.on(
				EVENTS.CHARACTER_SELECTED,
				this._homeCharacterSelectedHandler,
			);

			if (this._homeCharacterCreatedHandler) {
				eventBus.off(
					EVENTS.CHARACTER_CREATED,
					this._homeCharacterCreatedHandler,
				);
			}

			this._homeCharacterCreatedHandler = async () => {
				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			};

			eventBus.on(EVENTS.CHARACTER_CREATED, this._homeCharacterCreatedHandler);
		} catch (error) {
			console.error('PageHandler', 'Error initializing home page', error);
			showNotification('Error loading home page', 'error');
		}
	}

	sortCharacters(characters, sortOption) {
		const sorted = [...characters];

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
				sorted.sort((a, b) =>
					(a.name || 'Unnamed').localeCompare(b.name || 'Unnamed'),
				);
		}

		return sorted;
	}

	async renderCharacterList(characters) {
		const characterList = document.getElementById('characterList');

		if (!characterList) {
			console.warn('PageHandler', 'Character list element not found');
			return;
		}

		if (characters.length === 0) {
			characterList.classList.add('empty-state-mode');
			this.showEmptyState(characterList);
			const topButtonRow = document.querySelector('.row.mb-4');
			if (topButtonRow) {
				topButtonRow.style.display = 'none';
			}
			return;
		}

		const topButtonRow = document.querySelector('.row.mb-4');
		if (topButtonRow) {
			topButtonRow.style.display = '';
		}
		characterList.classList.remove('empty-state-mode');

		const sortSelect = document.getElementById('sortSelect');
		const sortOption = sortSelect ? sortSelect.value : 'name';
		const sortedCharacters = this.sortCharacters(characters, sortOption);

		this.currentCharacters = sortedCharacters;

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
				const placeholderImages = [
					'assets/images/characters/placeholder_char_card.webp',
					'assets/images/characters/placeholder_char_card2.webp',
					'assets/images/characters/placeholder_char_card3.webp',
				];
				const defaultPlaceholder = placeholderImages[0];

				const rawPortrait =
					character.portrait ||
					character.image ||
					character.avatar ||
					defaultPlaceholder;
				const portraitUrl = (() => {
					if (!rawPortrait) return defaultPlaceholder;
					if (
						rawPortrait.startsWith('data:') ||
						rawPortrait.startsWith('file://')
					) {
						return rawPortrait;
					}
					if (/^[A-Za-z]:\\/.test(rawPortrait)) {
						return `file://${rawPortrait.replace(/\\/g, '/')}`;
					}
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

	}

	setupCharacterCardListeners(container) {
		if (!container || container._listenersAttached) return;

		container._listenersAttached = true;

		container.addEventListener('click', async (e) => {
			const card = e.target.closest('.character-card');
			if (!card) return;

			if (e.target.closest('.card-actions')) return;

			const characterId = card.dataset.characterId;
			if (characterId) {
				try {
					await CharacterManager.loadCharacter(characterId);
				} catch (error) {
					console.error('PageHandler', 'Failed to load character', {
						id: characterId,
						error: error.message,
					});
					showNotification('Failed to load character', 'error');
				}
			}
		});

		container.addEventListener('click', async (e) => {
			const exportBtn = e.target.closest('.export-character');
			if (!exportBtn) return;

			e.stopPropagation();
			const characterId = exportBtn.dataset.characterId;
			if (characterId) {
				try {
					const result = await window.characterStorage.exportCharacter(characterId);
					if (result?.success) {
						showNotification('Character exported successfully', 'success');
					} else {
						showNotification('Failed to export character', 'error');
					}
				} catch (error) {
					console.error('PageHandler', 'Error exporting character', error);
					showNotification('Failed to export character', 'error');
				}
			}
		});

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

	async handleImportCharacter() {
		try {
			let result = await window.characterStorage.importCharacter();

			if (result?.duplicateId) {
				const modal = Modal.getInstance();
				const action = await modal.showDuplicateIdModal({
					characterName: result.character.name,
					characterId: result.character.id,
					createdAt: result.existingCharacter?.createdAt,
					lastModified: result.existingCharacter?.lastModified,
				});

				if (action === 'cancel') {
					return;
				}

				result = await window.characterStorage.importCharacter({
					character: result.character,
					sourceFilePath: result.sourceFilePath,
					action,
				});
			}

			if (result?.success && result.character) {
				showNotification('Character imported successfully', 'success');

				const reloadCharacters = await CharacterManager.loadCharacterList();
				await this.renderCharacterList(reloadCharacters);
			} else if (result?.canceled) {
				// User canceled import
			} else {
				showNotification('Failed to import character', 'error');
			}
		} catch (error) {
			console.error('PageHandler', 'Error importing character', error);
			showNotification('Error importing character', 'error');
		}
	}

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

		const createBtn = container.querySelector('#welcomeCreateCharacterBtn');
		if (createBtn) {
			createBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				const modal = Modal.getInstance();
				await modal.showNewCharacterModal(e);
			});
		}

		const importBtn = container.querySelector('#emptyStateImportBtn');
		if (importBtn) {
			importBtn.addEventListener('click', async () => {
				await this.handleImportCharacter();
			});
		}
	}

	async initializeSettingsPage() {
		try {
			await settingsService.initializeSettingsPage();
		} catch (error) {
			console.error('PageHandler', 'Error initializing settings page', error);
			showNotification('Error loading settings page', 'error');
		}
	}

	async initializeBuildPage() {
		try {
			new RaceCard();
			new ClassCard();
			new BackgroundCard();

			const abilityScoreCard = AbilityScoreCard.getInstance();
			await abilityScoreCard.initialize();

			const proficiencyCard = new ProficiencyCard();
			await proficiencyCard.initialize();
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
			this._updateFeatAvailabilitySection(
				character || AppState.getCurrentCharacter(),
			);
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
			this._updateFeatAvailabilitySection(
				character || AppState.getCurrentCharacter(),
			);
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

		if (selectionCounter) {
			selectionCounter.style.display = availability.max > 0 ? '' : 'none';
		}

		if (addFeatBtn) {
			addFeatBtn.disabled = false;
			addFeatBtn.title =
				availability.max > 0
					? `${availability.remaining} feat choice(s) remaining`
					: 'Add feats from any source (racial features, magic items, etc.)';
		}
	}

	async initializeDetailsPage() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for details page');
				return;
			}

			const alignmentInput = document.getElementById('alignment');
			if (alignmentInput) {
				while (alignmentInput.options.length > 1) {
					alignmentInput.remove(1);
				}
				ALIGNMENTS.forEach((alignment) => {
					const option = document.createElement('option');
					option.value = alignment.value;
					option.textContent = alignment.label;
					alignmentInput.appendChild(option);
				});
				alignmentInput.value = character.alignment || '';
			}

			const deityInput = document.getElementById('deity');
			const deityList = document.getElementById('deityList');
			if (deityList) {
				deityList.innerHTML = '';
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

			this._setupDetailsPageFormListeners();
		} catch (error) {
			console.error('PageHandler', 'Error initializing details page', error);
			showNotification('Error loading details page', 'error');
		}
	}

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
				field.addEventListener('input', () => {
					console.debug(
						'PageHandler',
						`Form field changed (${fieldId}), emitting CHARACTER_UPDATED`,
					);
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: AppState.getCurrentCharacter(),
					});
				});
			}
		});
	}

	async initializeFeatsPage() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for feats page');
				return;
			}

			this._initializeFeatSources();

			const addFeatBtn = document.getElementById('addFeatBtn');
			if (addFeatBtn) {
				const newAddFeatBtn = addFeatBtn.cloneNode(true);
				addFeatBtn.parentNode.replaceChild(newAddFeatBtn, addFeatBtn);
				newAddFeatBtn.addEventListener('click', async () => {
					const availability = character.getFeatAvailability?.();
					const maxFeats = availability?.max || 0;


					const selector = new ClassFeatSelector();
					await selector.show({
						currentSelection: character.feats || [],
						multiSelect: true,
						maxSelections: maxFeats,
						onConfirm: async (feats) => {
							if (feats && feats.length > 0) {
								const reasons = availability?.reasons || [];
								const enrichedFeats = feats.map((feat, idx) => ({
									...feat,
									origin:
										feat.origin ||
										(idx < reasons.length
											? this._formatFeatOrigin(reasons[idx])
											: 'Manual selection'),
								}));

								character.setFeats(enrichedFeats, 'Manual selection');

								this._featListView.update(this._featListContainer, character);
								this._featSourcesView.update(
									this._featSourcesContainer,
									character,
								);
								this._updateFeatUIState(character);
								this._updateFeatAvailabilitySection(character);

								eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
								showNotification(
									`${feats.length} feat(s) selected!`,
									'success',
								);
							}
						},
					});
				});

				this._updateFeatUIState(character);
			}

			this._updateFeatAvailabilitySection(character);
		} catch (error) {
			console.error('PageHandler', 'Error initializing feats page', error);
			showNotification('Error loading feats page', 'error');
		}
	}

	_updateFeatAvailabilitySection(character) {
		const featSourcesContainer = document.getElementById('featSources');

		if (!character) return;

		if (featSourcesContainer) {
			featSourcesContainer.style.display =
				character.feats?.length > 0 ? 'block' : 'none';
		}
	}

	_formatFeatOrigin(reason) {
		if (!reason) return '';

		if (reason === 'ASI') return 'Ability Score Improvement';

		if (reason.startsWith('Ability Score Improvement')) {
			return 'Ability Score Improvement';
		}

		const match = reason.match(/^([^:]+):/);
		return match ? match[1].trim() : reason.trim();
	}

	async initializeEquipmentPage() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for equipment page');
				return;
			}

			const { EquipmentManager } = await import(
				'../ui/components/equipment/EquipmentManager.js'
			);
			const equipmentManager = new EquipmentManager();
			equipmentManager.render();

			const updateHandler = () => equipmentManager.render();
			eventBus.on(EVENTS.CHARACTER_UPDATED, updateHandler);
			eventBus.on(EVENTS.ITEM_ADDED, updateHandler);
			eventBus.on(EVENTS.ITEM_REMOVED, updateHandler);
			eventBus.on(EVENTS.ITEM_EQUIPPED, updateHandler);
			eventBus.on(EVENTS.ITEM_UNEQUIPPED, updateHandler);
		} catch (error) {
			console.error('PageHandler', 'Error initializing equipment page', error);
			showNotification('Error loading equipment page', 'error');
		}
	}

	async initializePreviewPage() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for preview page');
				return;
			}

		} catch (error) {
			console.error('PageHandler', 'Error initializing preview page', error);
			showNotification('Error loading preview page', 'error');
		}
	}

	async initializeSpellsPage() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character) {
				console.warn('PageHandler', 'No character loaded for spells page');
				return;
			}

			const { SpellsManager } = await import(
				'../ui/components/spells/SpellManager.js'
			);
			const spellsManager = new SpellsManager();
			spellsManager.render();

			const updateHandler = () => spellsManager.render();
			eventBus.on(EVENTS.CHARACTER_UPDATED, updateHandler);
			eventBus.on(EVENTS.SPELL_ADDED, updateHandler);
			eventBus.on(EVENTS.SPELL_REMOVED, updateHandler);
			eventBus.on(EVENTS.SPELL_PREPARED, updateHandler);
			eventBus.on(EVENTS.SPELL_UNPREPARED, updateHandler);
			eventBus.on(EVENTS.SPELL_SLOTS_USED, updateHandler);
			eventBus.on(EVENTS.SPELL_SLOTS_RESTORED, updateHandler);
		} catch (error) {
			console.error('PageHandler', 'Error initializing spells page', error);
			showNotification('Error loading spells page', 'error');
		}
	}
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
