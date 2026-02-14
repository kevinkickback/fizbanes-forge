import { EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { AppState } from '../AppState.js';
import { CharacterManager } from '../CharacterManager.js';
import { Modal } from '../Modal.js';
import { BasePageController } from './BasePageController.js';

export class HomePageController extends BasePageController {
    constructor() {
        super('HomePageController');
        this._homeCharacterSelectedHandler = null;
        this._homeCharacterCreatedHandler = null;
        this._homeCharacterUpdatedHandler = null;
    }

    async initialize() {
        try {
            const modal = Modal.getInstance();

            const importBtn = document.getElementById('importCharacterBtn');
            if (importBtn) {
                const freshBtn = importBtn.cloneNode(true);
                importBtn.parentNode.replaceChild(freshBtn, importBtn);
                freshBtn.addEventListener('click', async () => {
                    await this.handleImportCharacter();
                });
            }

            const characterList = document.getElementById('characterList');
            if (characterList) {
                this._setupCharacterCardListeners(characterList);
            }

            const characters = await CharacterManager.loadCharacterList();
            await this._renderCharacterList(characters);

            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) {
                const newSortSelect = sortSelect.cloneNode(true);
                sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);

                newSortSelect.addEventListener('change', async () => {
                    const reloadCharacters = await CharacterManager.loadCharacterList();
                    await this._renderCharacterList(reloadCharacters);
                });
            }

            modal.setupEventListeners({
                onShowModal: async (e) => {
                    await modal.showNewCharacterModal(e);
                },
                onCreateCharacter: async () => {
                    const reloadCharacters = await CharacterManager.loadCharacterList();
                    await this._renderCharacterList(reloadCharacters);
                },
            });

            modal.ensureInitialized();

            this._homeCharacterSelectedHandler = (character) => {
                this._updateCharacterCardSelection(character?.id);
            };
            this._trackListener(EVENTS.CHARACTER_SELECTED, this._homeCharacterSelectedHandler);

            this._homeCharacterCreatedHandler = async () => {
                const reloadCharacters = await CharacterManager.loadCharacterList();
                await this._renderCharacterList(reloadCharacters);
            };
            this._trackListener(EVENTS.CHARACTER_CREATED, this._homeCharacterCreatedHandler);
            this._trackListener(EVENTS.CHARACTER_SAVED, this._homeCharacterCreatedHandler);

            this._homeCharacterUpdatedHandler = async () => {
                const reloadCharacters = await CharacterManager.loadCharacterList();
                await this._renderCharacterList(reloadCharacters);
                const currentCharacter = CharacterManager.getCurrentCharacter();
                if (currentCharacter?.id) {
                    this._updateCharacterCardSelection(currentCharacter.id);
                }
            };
            this._trackListener(EVENTS.CHARACTER_UPDATED, this._homeCharacterUpdatedHandler);
        } catch (error) {
            console.error('[HomePageController]', 'Error initializing home page', error);
            showNotification('Error loading home page', 'error');
        }
    }

    _updateCharacterCardSelection(selectedCharacterId) {
        const characterList = document.getElementById('characterList');
        if (!characterList) return;

        const allCards = characterList.querySelectorAll('.character-card');
        allCards.forEach(card => {
            card.classList.remove('selected');
            const badge = card.querySelector('.active-profile-badge');
            if (badge) badge.remove();
        });

        if (selectedCharacterId) {
            const activeCard = characterList.querySelector(`[data-character-id="${selectedCharacterId}"]`);
            if (activeCard) {
                activeCard.classList.add('selected');
                const cardHeader = activeCard.querySelector('.card-header h5');
                if (cardHeader && !cardHeader.nextElementSibling?.classList.contains('active-profile-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'active-profile-badge';
                    badge.textContent = 'Active';
                    cardHeader.parentElement.appendChild(badge);
                }
            }
        }
    }

    _sortCharacters(characters, sortOption) {
        const sorted = [...characters];

        switch (sortOption) {
            case 'name':
                sorted.sort((a, b) => (a.name || 'Unnamed').localeCompare(b.name || 'Unnamed'));
                break;
            case 'name-desc':
                sorted.sort((a, b) => (b.name || 'Unnamed').localeCompare(a.name || 'Unnamed'));
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
                    return dateB - dateA;
                });
                break;
            case 'modified-asc':
                sorted.sort((a, b) => {
                    const dateA = new Date(a.lastModified || 0).getTime();
                    const dateB = new Date(b.lastModified || 0).getTime();
                    return dateA - dateB;
                });
                break;
            default:
                sorted.sort((a, b) => (a.name || 'Unnamed').localeCompare(b.name || 'Unnamed'));
        }

        return sorted;
    }

    async _renderCharacterList(characters) {
        const characterList = document.getElementById('characterList');

        if (!characterList) {
            console.warn('[HomePageController]', 'Character list element not found');
            return;
        }

        if (characters.length === 0) {
            characterList.classList.add('empty-state-mode');
            this._showEmptyState(characterList);
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
        const sortedCharacters = this._sortCharacters(characters, sortOption);

        this.currentCharacters = sortedCharacters;

        const currentCharacter = AppState.getCurrentCharacter();
        const activeCharacterId = currentCharacter?.id;
        const defaultPlaceholder = 'assets/images/characters/placeholder_char_card0.jpg';

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
                        .map((cls) => cls.name || 'Unknown Class')
                        .join('<br>')
                    : 'No Class';

                const rawPortrait =
                    character.portrait || character.image || character.avatar || defaultPlaceholder;
                const portraitUrl = (() => {
                    if (!rawPortrait) return defaultPlaceholder;
                    if (rawPortrait.startsWith('data:') || rawPortrait.startsWith('file://')) {
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
						<div class="character-portrait" data-portrait-url="${portraitUrl}"></div>
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

        // Apply portrait backgrounds using data attributes (CSP-compliant).
        // Validate each image — fall back to the placeholder when it fails to load.
        characterList.querySelectorAll('.character-portrait[data-portrait-url]').forEach((el) => {
            const url = el.dataset.portraitUrl;
            const img = new Image();
            img.onload = () => {
                el.style.backgroundImage = `url('${url}')`;
            };
            img.onerror = () => {
                el.style.backgroundImage = `url('${defaultPlaceholder}')`;
            };
            img.src = url;
        });
    }

    _setupCharacterCardListeners(container) {
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
                    console.error('[HomePageController]', 'Failed to load character', {
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
                    console.error('[HomePageController]', 'Error exporting character', error);
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
                    message: 'Are you sure you want to delete this character? This cannot be undone.',
                    confirmButtonText: 'Delete',
                    confirmButtonClass: 'btn-danger',
                });

                if (confirmed) {
                    try {
                        await CharacterManager.deleteCharacter(characterId);
                        showNotification('Character deleted successfully', 'success');
                    } catch (error) {
                        console.error('[HomePageController]', 'Failed to delete character', error);
                        showNotification('Failed to delete character', 'error');
                    } finally {
                        const reloadCharacters = await CharacterManager.loadCharacterList();
                        await this._renderCharacterList(reloadCharacters);
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
                await this._renderCharacterList(reloadCharacters);
            } else if (result?.canceled) {
                // User canceled import
            } else {
                showNotification('Failed to import character', 'error');
            }
        } catch (error) {
            console.error('[HomePageController]', 'Error importing character', error);
            showNotification('Error importing character', 'error');
        }
    }

    _showEmptyState(container) {
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
}
