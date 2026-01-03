/** DataLoader.js - Caches and loads game data JSON via IPC or fetch (plain module). */

const state = {
	cache: {},
	loading: {},
	baseUrl: '', // Base URL now empty since data is at root
};

function setBaseUrl(url) {
	state.baseUrl = url;
	return dataLoader;
}

/**
 * Load JSON data from file
 * Implements automatic caching and error handling
 * In Electron, uses IPC-based data loading; in browser, uses fetch
 * @param {string} url Path to JSON file (relative or absolute)
 * @returns {Promise<Object>} Parsed JSON data
 */
async function loadJSON(url) {
	if (state.cache[url]) return state.cache[url];
	if (state.loading[url]) return state.loading[url];

	state.loading[url] = (async () => {
		try {
			let data;

			// Check if running in Electron with data API available
			if (
				typeof window !== 'undefined' &&
				window.data &&
				window.data.loadJSON
			) {
				try {
					const result = await window.data.loadJSON(url);
					if (result.success) {
						data = result.data;
					} else {
						throw new Error(result.error || `Failed to load ${url}`);
					}
				} catch (electronError) {
					console.error(
						'DataLoader',
						`Electron IPC load failed for ${url}:`,
						electronError,
					);
					throw electronError;
				}
			} else {
				// Fall back to fetch (browser or Electron without preload)
				// This will require data to be served via http/https or proper file:// URLs
				const fullUrl =
					url.startsWith('http') || url.startsWith('file://') ? url : `/${url}`; // Prepend / to make it root-relative

				const response = await fetch(fullUrl);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				data = await response.json();
			}

			state.cache[url] = data;
			delete state.loading[url];
			return data;
		} catch (error) {
			delete state.loading[url];
			console.error('DataLoader', `Failed to load ${url}:`, error);
			throw error;
		}
	})();

	return state.loading[url];
}

async function loadJSONs(urls) {
	return Promise.all(urls.map((url) => loadJSON(url)));
}

async function loadSpells(source = 'PHB') {
	return loadJSON(`${state.baseUrl}spells/spells-${source.toLowerCase()}.json`);
}

async function loadItems() {
	const data = await loadJSON(`${state.baseUrl}items.json`);
	return data;
}

/**
 * Get or load base items data (weapons, armor, etc.)
 * @returns {Promise<Object>} Base items data
 */
async function loadBaseItems() {
	const data = await loadJSON(`${state.baseUrl}items-base.json`);
	return data;
}

/**
 * Get or load skills data
 * @returns {Promise<Object>} Skills data
 */
async function loadSkills() {
	const data = await loadJSON(`${state.baseUrl}skills.json`);
	return data;
}

/**
 * Get or load actions data
 * @returns {Promise<Object>} Actions data
 */
async function loadActions() {
	const data = await loadJSON(`${state.baseUrl}actions.json`);
	return data;
}

/**
 * Get or load monster/creature data
 * @returns {Promise<Object>} Monster data
 */
async function loadMonsters() {
	// Aggregate all bestiary files listed in the bestiary index
	const index = await loadJSON(`${state.baseUrl}bestiary/index.json`);
	const files = Object.values(index || {});

	// Load all bestiary chunks in parallel
	const datasets = await Promise.all(
		files.map((file) => loadJSON(`${state.baseUrl}bestiary/${file}`)),
	);

	// Merge array fields (primarily `monster`) across datasets
	const aggregated = {};
	for (const data of datasets) {
		if (!data || typeof data !== 'object') continue;
		for (const [key, value] of Object.entries(data)) {
			if (Array.isArray(value)) {
				aggregated[key] = aggregated[key] || [];
				aggregated[key].push(...value);
			}
		}
	}

	return aggregated;
}

/**
 * Get or load race data
 * @returns {Promise<Object>} Race data
 */
async function loadRaces() {
	return loadJSON(`${state.baseUrl}races.json`);
}

/**
 * Get or load race fluff data
 * @returns {Promise<Object>} Race fluff data
 */
async function loadRaceFluff() {
	return loadJSON(`${state.baseUrl}fluff-races.json`);
}

/**
 * Get or load class data
 * Note: Use ClassManager for aggregated class data
 * @param {string} className Class name (e.g., 'Fighter', 'Wizard')
 * @returns {Promise<Object>} Class data from single file
 */
async function loadClasses(className = 'Fighter') {
	return loadJSON(
		`${state.baseUrl}class/class-${className.toLowerCase()}.json`,
	);
}

/**
 * Get or load background data
 * @returns {Promise<Object>} Background data
 */
async function loadBackgrounds() {
	return loadJSON(`${state.baseUrl}backgrounds.json`);
}

/**
 * Get or load feat data
 * @returns {Promise<Object>} Feat data
 */
async function loadFeats() {
	const data = await loadJSON(`${state.baseUrl}feats.json`);
	return data;
}

/**
 * Get or load condition data
 * @returns {Promise<Object>} Condition data
 */
async function loadConditions() {
	const data = await loadJSON(`${state.baseUrl}conditionsdiseases.json`);
	return data;
}

/**
 * Get or load fluff feats data
 * @returns {Promise<Object>} Fluff feats data
 */
async function loadFluffFeats() {
	return loadJSON(`${state.baseUrl}fluff-feats.json`);
}

/**
 * Get or load optional features data
 * @returns {Promise<Object>} Optional features data
 */
async function loadOptionalFeatures() {
	const data = await loadJSON(`${state.baseUrl}optionalfeatures.json`);
	return data;
}

/**
 * Get or load fluff optional features data
 * @returns {Promise<Object>} Fluff optional features data
 */
async function loadFluffOptionalFeatures() {
	return loadJSON(`${state.baseUrl}fluff-optionalfeatures.json`);
}

/**
 * Get or load rewards data
 * @returns {Promise<Object>} Rewards data
 */
async function loadRewards() {
	const data = await loadJSON(`${state.baseUrl}rewards.json`);
	return data;
}

/**
 * Get or load traps and hazards data
 * @returns {Promise<Object>} Traps/hazards data
 */
async function loadTrapsHazards() {
	return loadJSON(`${state.baseUrl}trapshazards.json`);
}

/**
 * Get or load vehicles data
 * @returns {Promise<Object>} Vehicles data
 */
async function loadVehicles() {
	const data = await loadJSON(`${state.baseUrl}vehicles.json`);
	return data;
}

/**
 * Get or load objects data
 * @returns {Promise<Object>} Objects data
 */
async function loadObjects() {
	const data = await loadJSON(`${state.baseUrl}objects.json`);
	return data;
}

/**
 * Get or load variant rules data
 * @returns {Promise<Object>} Variant rules data
 */
async function loadVariantRules() {
	return loadJSON(`${state.baseUrl}variantrules.json`);
}

/**
 * Get or load sources data
 * @returns {Promise<Object>} Sources data
 */
async function loadSources() {
	try {
		return await loadJSON(`${state.baseUrl}books.json`);
	} catch (error) {
		console.warn('DataLoader', 'Could not find sources data', error);
		return { source: [] };
	}
}

/**
 * Get or load subclass spells data
 * @param {string} subclassId - The subclass ID
 * @returns {Promise<Object>} Subclass spells data
 */
async function loadSubclassSpells(subclassId) {
	try {
		return await loadJSON(`${state.baseUrl}spells/sources.json`);
	} catch (error) {
		console.warn(
			'DataLoader',
			`Could not find subclass spells for ${subclassId}:`,
			error,
		);
		return { spell: [] };
	}
}

function clearCache() {
	state.cache = {};
	state.loading = {};
	return dataLoader;
}

function clearCacheForUrl(url) {
	delete state.cache[url];
	delete state.loading[url];
	return dataLoader;
}

function getCacheStats() {
	return {
		cachedUrls: Object.keys(state.cache).length,
		loadingUrls: Object.keys(state.loading).length,
		totalSize: JSON.stringify(state.cache).length,
	};
}

/**
 * Backward-compatible object export (no class/instance needed).
 */
const dataLoader = {
	setBaseUrl,
	loadJSON,
	loadJSONs,
	loadSpells,
	loadItems,
	loadBaseItems,
	loadSkills,
	loadActions,
	loadMonsters,
	loadRaces,
	loadRaceFluff,
	loadClasses,
	loadBackgrounds,
	loadFeats,
	loadConditions,
	loadFluffFeats,
	loadOptionalFeatures,
	loadFluffOptionalFeatures,
	loadRewards,
	loadTrapsHazards,
	loadVehicles,
	loadObjects,
	loadVariantRules,
	loadSources,
	loadSubclassSpells,
	clearCache,
	clearCacheForUrl,
	getCacheStats,
};

// Static-style convenience methods (map directly to underlying functions)
dataLoader.loadJSON = loadJSON;
dataLoader.loadJSONs = loadJSONs;
dataLoader.loadSpells = loadSpells;
dataLoader.loadItems = loadItems;
dataLoader.loadBaseItems = loadBaseItems;
dataLoader.loadSkills = loadSkills;
dataLoader.loadActions = loadActions;
dataLoader.loadMonsters = loadMonsters;
dataLoader.loadRaces = loadRaces;
dataLoader.loadRaceFluff = loadRaceFluff;
dataLoader.loadClasses = loadClasses;
dataLoader.loadBackgrounds = loadBackgrounds;
dataLoader.loadFeats = loadFeats;
dataLoader.loadConditions = loadConditions;
dataLoader.loadFluffFeats = loadFluffFeats;
dataLoader.loadOptionalFeatures = loadOptionalFeatures;
dataLoader.loadFluffOptionalFeatures = loadFluffOptionalFeatures;
dataLoader.loadRewards = loadRewards;
dataLoader.loadTrapsHazards = loadTrapsHazards;
dataLoader.loadVehicles = loadVehicles;
dataLoader.loadObjects = loadObjects;
dataLoader.loadVariantRules = loadVariantRules;
dataLoader.loadSources = loadSources;
dataLoader.loadSubclassSpells = loadSubclassSpells;
dataLoader.clearCache = clearCache;
dataLoader.clearCacheForUrl = clearCacheForUrl;
dataLoader.getCacheStats = getCacheStats;

// Legacy convenience alias for DataLoader exports
const DataLoader = dataLoader;

export {
	DataLoader, clearCache,
	clearCacheForUrl, dataLoader,
	getCacheStats,
	loadActions,
	loadBackgrounds,
	loadBaseItems,
	loadClasses,
	loadConditions,
	loadFeats,
	loadFluffFeats,
	loadFluffOptionalFeatures,
	loadItems,
	loadJSON,
	loadJSONs,
	loadMonsters,
	loadObjects,
	loadOptionalFeatures,
	loadRaceFluff,
	loadRaces,
	loadRewards,
	loadSkills,
	loadSources,
	loadSpells,
	loadSubclassSpells,
	loadTrapsHazards,
	loadVariantRules,
	loadVehicles,
	setBaseUrl
};
