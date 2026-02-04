/** Manages source book selection and filtering for character creation. */
import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';
import { BaseDataService } from './BaseDataService.js';

export class SourceService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'sources',
			loadEvent: EVENTS.SERVICE_INITIALIZED,
			loggerScope: 'SourceService',
		});
		this.availableSources = new Map();
		this.coreSources = new Set();
		this.sources = new Set();
		this.characterHandler = null;

		/**
		 * @type {Set<string>} Sources that are allowed for the current character
		 * @description Default to PHB as the minimum allowed source
		 */
		this.allowedSources = new Set(['PHB']);

		/**
		 * @type {Set<string>} Default sources that every character begins with
		 * @description These sources are core rulebooks required for character creation
		 * @private
		 */
		this._defaultSources = new Set(['PHB', 'DMG', 'MM']);

		/**
		 * @type {Set<string>} Sources that are banned from selection
		 * @description These sources are excluded because they contain content
		 * that is not compatible with the character creator
		 * @private
		 */
		this._bannedSources = new Set([
			'MPMM', // Mordenkainen Presents: Monsters of the Multiverse
			'AAG', // Astral Adventurer's Guide
			'BGG', // Bigby Presents: Glory of the Giants
			'SATO', // Sigil and the Outlands
			'BMT', // The Book of Many Things
			'MOT', // Mythic Odysseys of Theros
			'MMPM', // Mordenkainen's Monsters of the Multiverse
		]);

		// Setup event handlers
		this._setupEventListeners();
	}

	_setupEventListeners() {
		// Set up listeners for relevant application events
		eventBus.on(
			EVENTS.CHARACTER_LOADED,
			this._handleCharacterChange.bind(this),
		);
		eventBus.on(
			EVENTS.CHARACTER_CREATED,
			this._handleCharacterChange.bind(this),
		);
		eventBus.on(
			EVENTS.CHARACTER_SELECTED,
			this._handleCharacterChange.bind(this),
		);
	}

	_handleCharacterChange(character) {
		if (!character) {
			this.allowedSources = this._expandSourceVariants(new Set(['PHB']));
			return;
		}

		// Update allowed sources from character and expand variants (e.g., PHB-2014, XPHB)
		this.allowedSources = this._expandSourceVariants(
			new Set(character.allowedSources || ['PHB']),
		);

		// Notify that allowed sources have changed
		eventBus.emit('sources:allowed-changed', Array.from(this.allowedSources));
	}

	async initialize() {
		return this.initWithLoader(() => DataLoader.loadSources(), {
			onLoaded: (sourcesData) => {
				// Handle both direct data and Result-wrapped data
				const sources = sourcesData.data || sourcesData;

				if (sources.book && Array.isArray(sources.book)) {
					// Filter and sort sources
					const validSources = sources.book
						.filter((source) => {
							// Filter out banned sources (case insensitive)
							if (this.isBannedSource(source.id)) {
								return false;
							}

							// Then check if it has player options
							const hasOptions = source.contents?.some((content) => {
								// Check the section name
								if (
									[
										'Races',
										'Classes',
										'Backgrounds',
										'Feats',
										'Spells',
										'Equipment',
										'Magic Items',
										'Subclasses',
										'Subraces',
										'Class Options',
										'Character Options',
										'Customization Options',
										'Multiclassing',
										'Personality and Background',
									].some((keyword) =>
										content.name.toLowerCase().includes(keyword.toLowerCase()),
									)
								) {
									return true;
								}

								// Check headers if they exist
								if (content.headers && Array.isArray(content.headers)) {
									const hasPlayerHeader = content.headers.some((header) => {
										// Handle both string and object headers
										const headerText =
											typeof header === 'string' ? header : header.header;
										if (!headerText) return false;

										return [
											'Races',
											'Classes',
											'Backgrounds',
											'Feats',
											'Spells',
											'Equipment',
											'Magic Items',
											'Subclasses',
											'Subraces',
											'Class Options',
											'Character Options',
											'Customization Options',
											'Multiclassing',
											'Personality and Background',
										].some((keyword) =>
											headerText.toLowerCase().includes(keyword.toLowerCase()),
										);
									});

									if (hasPlayerHeader) return true;
								}

								return false;
							});

							return hasOptions;
						})
						.sort((a, b) => {
							// PHB and XPHB always first
							if (a.id === 'PHB') return -1;
							if (b.id === 'PHB') return 1;
							if (a.id === 'XPHB') return -1;
							if (b.id === 'XPHB') return 1;

							// Then sort by group priority: core > setting > supplement
							const groupPriority = { core: 0, setting: 1, supplement: 2 };
							return groupPriority[a.group] - groupPriority[b.group];
						});

					console.debug('[SourceService]', 'Valid sources after filtering', {
						sources: validSources.map((s) => s.id),
					});

					// Initialize available sources
					for (const source of validSources) {
						this.availableSources.set(source.id, {
							name: source.name,
							abbreviation: source.abbreviation,
							isCore: source.isCore || false,
							group: source.group,
							version: source.version,
							hasErrata: source.hasErrata,
							targetLanguage: source.targetLanguage,
							url: source.url,
							description: source.description,
							contents: source.contents,
							isDefault: source.isDefault,
						});

						if (source.isCore) {
							this.coreSources.add(source.id);
						}
					}

					console.debug('[SourceService]', 'Initialization complete', {
						sourceCount: this.availableSources.size,
					});
				} else {
					console.error(
						'SourceService',
						'Invalid source data format - missing source array',
						sources,
					);
					showNotification(
						'Error loading source books: Invalid data format',
						'error',
					);
				}
			},
			emitPayload: () => ['source', this],
			onError: (error) => {
				console.error('[SourceService]', 'Error during initialization', error);
				showNotification('Error loading source books', 'error');
				throw error;
			},
		});
	}

	isBannedSource(sourceId) {
		return this._bannedSources.has(sourceId.toUpperCase());
	}

	getDefaultSources() {
		return Array.from(this._defaultSources);
	}

	getAvailableSources() {
		return Array.from(this.availableSources.keys());
	}

	getCoreSources() {
		return this.coreSources;
	}

	isValidSource(source) {
		return this.availableSources.has(source);
	}

	isSourceAllowed(source) {
		// Check direct and normalized variants
		if (this.allowedSources.has(source)) return true;
		const norm = this._normalizeSource(source);
		return this.allowedSources.has(norm);
	}

	getSourceDetails(source) {
		return this.availableSources.get(source) || null;
	}

	getAllowedSources() {
		return Array.from(this.allowedSources);
	}

	addAllowedSource(source) {
		if (!this.isValidSource(source)) {
			return false;
		}

		const added = !this.allowedSources.has(source);
		if (added) {
			this.allowedSources.add(source);

			// Notify that allowed sources have changed
			eventBus.emit('sources:allowed-changed', Array.from(this.allowedSources));

			// Update character if available
			if (this.characterHandler?.getCurrentCharacter()) {
				this.characterHandler.getCurrentCharacter().allowedSources = new Set(
					this.allowedSources,
				);
			}
		}

		return added;
	}

	removeAllowedSource(source) {
		// Don't allow removing PHB
		if (source === 'PHB') {
			return false;
		}

		const removed = this.allowedSources.has(source);
		if (removed) {
			this.allowedSources.delete(source);

			// Notify that allowed sources have changed
			eventBus.emit('sources:allowed-changed', Array.from(this.allowedSources));

			// Update character if available
			if (this.characterHandler?.getCurrentCharacter()) {
				this.characterHandler.getCurrentCharacter().allowedSources = new Set(
					this.allowedSources,
				);
			}
		}

		return removed;
	}

	isCoreSource(source) {
		return this.coreSources.has(source);
	}

	resetAllowedSources() {
		this.allowedSources = this._expandSourceVariants(new Set(['PHB']));

		// Notify that allowed sources have changed
		eventBus.emit('sources:allowed-changed', Array.from(this.allowedSources));

		// Update character if available
		if (this.characterHandler?.getCurrentCharacter()) {
			this.characterHandler.getCurrentCharacter().allowedSources = new Set(
				this.allowedSources,
			);
		}
	}

	formatSourceName(source) {
		// First check if we have this source in our available sources
		if (this.availableSources.has(source)) {
			return this.availableSources.get(source).name;
		}

		// Fall back to known abbreviations
		const sourceMap = {
			PHB: "Player's Handbook",
			XPHB: "Player's Handbook (2024)",
			DMG: "Dungeon Master's Guide",
			MM: 'Monster Manual',
			XGE: "Xanathar's Guide to Everything",
			TCE: "Tasha's Cauldron of Everything",
			VGM: "Volo's Guide to Monsters",
			MTF: "Mordenkainen's Tome of Foes",
			SCAG: "Sword Coast Adventurer's Guide",
			ERLW: 'Eberron: Rising from the Last War',
			EGW: "Explorer's Guide to Wildemount",
		};

		// Return the mapped name or the original source code with better formatting
		return sourceMap[source] || source.replace(/([A-Z])/g, ' $1').trim();
	}

	_normalizeSource(source) {
		if (!source) return source;
		const s = String(source).toUpperCase();
		if (s === 'PHB-2014' || s === 'PHB_2014') return 'PHB';
		return s;
	}

	_expandSourceVariants(sources) {
		const expanded = new Set();
		for (const src of sources) {
			const norm = this._normalizeSource(src);
			expanded.add(norm);
			// Map PHB to 2014 variant only; do NOT implicitly include XPHB
			if (norm === 'PHB') {
				expanded.add('PHB-2014');
			}
		}
		return expanded;
	}

	// Use BaseDataService's isInitialized() method (inherited)
}

export const sourceService = new SourceService();
