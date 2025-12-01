/**
 * DataLoader.js
 * Core data loader for loading, caching, and managing game data
 * Based on 5etools DataUtil architecture
 *
 * Features:
 * - Automatic data caching
 * - Metadata merging (classic, prerelease, homebrew)
 * - Promise-based async loading
 * - Data validation
 */

class DataLoader {
	constructor() {
		this._cache = {};
		this._loading = {};
		this._baseUrl = 'data/';
	}

	setBaseUrl(url) {
		this._baseUrl = url;
		return this;
	}

	/**
	 * Load JSON data from file
	 * Implements automatic caching and error handling
	 * Works with both file:// URLs (Electron) and http/https
	 * @param {string} url Path to JSON file
	 * @returns {Promise<Object>} Parsed JSON data
	 */
	async loadJSON(url) {
		// Return cached data if available
		if (this._cache[url]) {
			return this._cache[url];
		}

		// Return existing promise if already loading
		if (this._loading[url]) {
			return this._loading[url];
		}

		// Load new data
		this._loading[url] = (async () => {
			try {
				let data;

				// Check if running in Electron environment
				if (typeof window !== 'undefined' && window.electron) {
					// Use Electron's file system API
					const result = await window.electron.loadJSON(url);
					if (result.success) {
						data = result.data;
					} else {
						throw new Error(result.error || `Failed to load ${url}`);
					}
				} else {
					// Fall back to fetch for browser environments
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}
					data = await response.json();
				}

				this._cache[url] = data;
				delete this._loading[url];
				return data;
			} catch (error) {
				delete this._loading[url];
				console.error(`Failed to load ${url}:`, error);
				throw error;
			}
		})();

		return this._loading[url];
	}

	/**
	 * Load multiple data files in parallel
	 * @param {string[]} urls Array of URLs to load
	 * @returns {Promise<Object[]>} Array of parsed data
	 */
	async loadJSONs(urls) {
		return Promise.all(urls.map((url) => this.loadJSON(url)));
	}

	/**
	 * Get or load spell data
	 * Note: Use SpellManager for aggregated spell data
	 * @param {string} source Source abbreviation
	 * @returns {Promise<Object>} Spell data from single file
	 */
	async loadSpells(source = 'PHB') {
		return this.loadJSON(
			`${this._baseUrl}spells/spells-${source.toLowerCase()}.json`,
		);
	}

	/**
	 * Get or load item data
	 * Note: Use ItemManager for merged item/baseItem data
	 * @returns {Promise<Object>} Item data
	 */
	async loadItems() {
		return this.loadJSON(`${this._baseUrl}items.json`);
	}

	/**
	 * Get or load base items data (weapons, armor, etc.)
	 * @returns {Promise<Object>} Base items data
	 */
	async loadBaseItems() {
		return this.loadJSON(`${this._baseUrl}items-base.json`);
	}

	/**
	 * Get or load skills data
	 * @returns {Promise<Object>} Skills data
	 */
	async loadSkills() {
		return this.loadJSON(`${this._baseUrl}skills.json`);
	}

	/**
	 * Get or load actions data
	 * @returns {Promise<Object>} Actions data
	 */
	async loadActions() {
		return this.loadJSON(`${this._baseUrl}actions.json`);
	}

	/**
	 * Get or load monster/creature data
	 * @returns {Promise<Object>} Monster data
	 */
	async loadMonsters() {
		return this.loadJSON(`${this._baseUrl}bestiary.json`);
	}

	/**
	 * Get or load race data
	 * @returns {Promise<Object>} Race data
	 */
	async loadRaces() {
		return this.loadJSON(`${this._baseUrl}races.json`);
	}

	/**
	 * Get or load race fluff data
	 * @returns {Promise<Object>} Race fluff data
	 */
	async loadRaceFluff() {
		return this.loadJSON(`${this._baseUrl}fluff-races.json`);
	}

	/**
	 * Get or load class data
	 * Note: Use ClassManager for aggregated class data
	 * @param {string} className Class name (e.g., 'Fighter', 'Wizard')
	 * @returns {Promise<Object>} Class data from single file
	 */
	async loadClasses(className = 'Fighter') {
		return this.loadJSON(
			`${this._baseUrl}class/class-${className.toLowerCase()}.json`,
		);
	}

	/**
	 * Get or load background data
	 * @returns {Promise<Object>} Background data
	 */
	async loadBackgrounds() {
		return this.loadJSON(`${this._baseUrl}backgrounds.json`);
	}

	/**
	 * Get or load feat data
	 * @returns {Promise<Object>} Feat data
	 */
	async loadFeats() {
		return this.loadJSON(`${this._baseUrl}feats.json`);
	}

	/**
	 * Get or load condition data
	 * @returns {Promise<Object>} Condition data
	 */
	async loadConditions() {
		return this.loadJSON(`${this._baseUrl}conditionsdiseases.json`);
	}

	/**
	 * Get or load fluff feats data
	 * @returns {Promise<Object>} Fluff feats data
	 */
	async loadFluffFeats() {
		return this.loadJSON(`${this._baseUrl}fluff-feats.json`);
	}

	/**
	 * Get or load optional features data
	 * @returns {Promise<Object>} Optional features data
	 */
	async loadOptionalFeatures() {
		return this.loadJSON(`${this._baseUrl}optionalfeatures.json`);
	}

	/**
	 * Get or load fluff optional features data
	 * @returns {Promise<Object>} Fluff optional features data
	 */
	async loadFluffOptionalFeatures() {
		return this.loadJSON(`${this._baseUrl}fluff-optionalfeatures.json`);
	}

	/**
	 * Get or load sources data
	 * @returns {Promise<Object>} Sources data
	 */
	async loadSources() {
		try {
			// Load from books.json in the data directory
			return await this.loadJSON(`${this._baseUrl}books.json`);
		} catch (error) {
			console.warn('Could not find sources data:', error);
			return { source: [] };
		}
	}

	/**
	 * Get or load subclass spells data
	 * @param {string} subclassId - The subclass ID
	 * @returns {Promise<Object>} Subclass spells data
	 */
	async loadSubclassSpells(subclassId) {
		try {
			// Try to load from spells subdirectory
			return await this.loadJSON(`${this._baseUrl}spells/sources.json`);
		} catch (error) {
			console.warn(`Could not find subclass spells for ${subclassId}:`, error);
			return { spell: [] };
		}
	}

	/**
	 * Clear all cached data
	 */
	clearCache() {
		this._cache = {};
		this._loading = {};
		return this;
	}

	/**
	 * Clear specific cached data
	 * @param {string} url URL to clear from cache
	 */
	clearCacheForUrl(url) {
		delete this._cache[url];
		delete this._loading[url];
		return this;
	}

	/**
	 * Get cache statistics
	 * @returns {Object} Cache info
	 */
	getCacheStats() {
		return {
			cachedUrls: Object.keys(this._cache).length,
			loadingUrls: Object.keys(this._loading).length,
			totalSize: JSON.stringify(this._cache).length,
		};
	}
}

/**
 * Global DataLoader instance
 */
let _dataLoaderInstance = null;

/**
 * Get the global DataLoader instance
 * @returns {DataLoader}
 */
DataLoader.getInstance = () => {
	if (!_dataLoaderInstance) {
		_dataLoaderInstance = new DataLoader();
	}
	return _dataLoaderInstance;
};

// Convenience methods
DataLoader.loadJSON = (url) => DataLoader.getInstance().loadJSON(url);
DataLoader.loadJSONs = (urls) => DataLoader.getInstance().loadJSONs(urls);
DataLoader.loadSpells = () => DataLoader.getInstance().loadSpells();
DataLoader.loadItems = () => DataLoader.getInstance().loadItems();
DataLoader.loadBaseItems = () => DataLoader.getInstance().loadBaseItems();
DataLoader.loadSkills = () => DataLoader.getInstance().loadSkills();
DataLoader.loadActions = () => DataLoader.getInstance().loadActions();
DataLoader.loadMonsters = () => DataLoader.getInstance().loadMonsters();
DataLoader.loadRaces = () => DataLoader.getInstance().loadRaces();
DataLoader.loadRaceFluff = () => DataLoader.getInstance().loadRaceFluff();
DataLoader.loadClasses = () => DataLoader.getInstance().loadClasses();
DataLoader.loadBackgrounds = () => DataLoader.getInstance().loadBackgrounds();
DataLoader.loadFeats = () => DataLoader.getInstance().loadFeats();
DataLoader.loadConditions = () => DataLoader.getInstance().loadConditions();
DataLoader.loadFluffFeats = () => DataLoader.getInstance().loadFluffFeats();
DataLoader.loadOptionalFeatures = () =>
	DataLoader.getInstance().loadOptionalFeatures();
DataLoader.loadFluffOptionalFeatures = () =>
	DataLoader.getInstance().loadFluffOptionalFeatures();
DataLoader.loadSources = () => DataLoader.getInstance().loadSources();
DataLoader.loadSubclassSpells = (subclassId) =>
	DataLoader.getInstance().loadSubclassSpells(subclassId);
DataLoader.clearCache = () => DataLoader.getInstance().clearCache();

export { DataLoader };
