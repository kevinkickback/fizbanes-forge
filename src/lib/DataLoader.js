/** DataLoader.js - Caches and loads game data JSON via IPC or fetch (plain module). */

const state = {
	cache: {},
	loading: {},
	baseUrl: '', // Base URL now empty since data is at root
	persisted: null,
};

const PERSIST_KEY = 'ff:data-cache:v1';

function _loadPersistedCache() {
	if (state.persisted) return state.persisted;
	try {
		const raw = window?.localStorage?.getItem(PERSIST_KEY);
		if (!raw) {
			state.persisted = {};
			return state.persisted;
		}
		state.persisted = JSON.parse(raw) || {};
	} catch (error) {
		console.warn('DataLoader', 'Failed to load persisted cache', error);
		state.persisted = {};
	}
	return state.persisted;
}

function _savePersistedCache() {
	try {
		if (!state.persisted) return;
		window?.localStorage?.setItem(PERSIST_KEY, JSON.stringify(state.persisted));
	} catch (error) {
		console.warn('DataLoader', 'Failed to save persisted cache', error);
	}
}

async function _hashData(data) {
	try {
		const json = JSON.stringify(data || {});
		const encoded = new TextEncoder().encode(json);
		const digest = await crypto.subtle.digest('SHA-256', encoded);
		const bytes = new Uint8Array(digest);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	} catch (error) {
		console.warn('DataLoader', 'Hashing failed, skipping version tag', error);
		return null;
	}
}

function _getPersistedEntry(url) {
	const persisted = _loadPersistedCache();
	return persisted?.[url] || null;
}

function _setPersistedEntry(url, data, hash) {
	const persisted = _loadPersistedCache();
	persisted[url] = { data, hash: hash || null };
	_savePersistedCache();
}

function setBaseUrl(url) {
	state.baseUrl = url;
	return dataLoader;
}

async function loadJSON(url) {
	if (state.cache[url]) return state.cache[url];

	const persisted = _getPersistedEntry(url);
	if (persisted?.data) {
		state.cache[url] = persisted.data;
		return persisted.data;
	}
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

			const hash = await _hashData(data);
			state.cache[url] = data;
			_setPersistedEntry(url, data, hash);
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

async function loadBaseItems() {
	const data = await loadJSON(`${state.baseUrl}items-base.json`);
	return data;
}

async function loadSkills() {
	const data = await loadJSON(`${state.baseUrl}skills.json`);
	return data;
}

async function loadActions() {
	const data = await loadJSON(`${state.baseUrl}actions.json`);
	return data;
}

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

async function loadRaces() {
	return loadJSON(`${state.baseUrl}races.json`);
}

async function loadRaceFluff() {
	return loadJSON(`${state.baseUrl}fluff-races.json`);
}

// Note: Use ClassManager for aggregated class data
async function loadClasses(className = 'Fighter') {
	return loadJSON(
		`${state.baseUrl}class/class-${className.toLowerCase()}.json`,
	);
}

async function loadBackgrounds() {
	return loadJSON(`${state.baseUrl}backgrounds.json`);
}

async function loadFeats() {
	const data = await loadJSON(`${state.baseUrl}feats.json`);
	return data;
}

async function loadConditions() {
	const data = await loadJSON(`${state.baseUrl}conditionsdiseases.json`);
	return data;
}

async function loadFluffFeats() {
	return loadJSON(`${state.baseUrl}fluff-feats.json`);
}

async function loadOptionalFeatures() {
	const data = await loadJSON(`${state.baseUrl}optionalfeatures.json`);
	return data;
}

async function loadFluffOptionalFeatures() {
	return loadJSON(`${state.baseUrl}fluff-optionalfeatures.json`);
}

async function loadRewards() {
	const data = await loadJSON(`${state.baseUrl}rewards.json`);
	return data;
}

async function loadTrapsHazards() {
	return loadJSON(`${state.baseUrl}trapshazards.json`);
}

async function loadVehicles() {
	const data = await loadJSON(`${state.baseUrl}vehicles.json`);
	return data;
}

async function loadObjects() {
	const data = await loadJSON(`${state.baseUrl}objects.json`);
	return data;
}

async function loadVariantRules() {
	return loadJSON(`${state.baseUrl}variantrules.json`);
}

async function loadSources() {
	try {
		return await loadJSON(`${state.baseUrl}books.json`);
	} catch (error) {
		console.warn('DataLoader', 'Could not find sources data', error);
		return { source: [] };
	}
}

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
	state.persisted = {};
	try {
		window?.localStorage?.removeItem(PERSIST_KEY);
	} catch (error) {
		console.warn('DataLoader', 'Failed to clear persisted cache', error);
	}
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
