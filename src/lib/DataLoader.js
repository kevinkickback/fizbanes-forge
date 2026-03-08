import { DataError } from './Errors.js';
import { eventBus, EVENTS } from './EventBus.js';

const MAX_CACHE_SIZE = 200;

const state = {
	cache: new Map(),
	loading: {},
	baseUrl: '', // Base URL now empty since data is at root
};

function _addToCache(url, data) {
	// Delete first so re-insert moves it to end (most recent)
	if (state.cache.has(url)) {
		state.cache.delete(url);
	}

	// Evict least recently used if cache is full
	if (state.cache.size >= MAX_CACHE_SIZE) {
		const lruUrl = state.cache.keys().next().value;
		state.cache.delete(lruUrl);
		console.debug('[DataLoader]', `Evicted LRU entry: ${lruUrl}`);
	}

	state.cache.set(url, data);
}

function _updateCacheAccess(url) {
	const data = state.cache.get(url);
	state.cache.delete(url);
	state.cache.set(url, data);
}

async function loadJSON(url) {
	const start = performance.now();

	// Check in-memory cache first
	if (state.cache.has(url)) {
		_updateCacheAccess(url);
		console.debug('[DataLoader]', `Cache hit for ${url}, duration: ${(performance.now() - start).toFixed(2)}ms`);
		return state.cache.get(url);
	}

	// Check if already loading
	if (state.loading[url]) return state.loading[url];

	state.loading[url] = (async () => {
		try {
			const loadStart = performance.now();
			let data;

			eventBus.emit(EVENTS.DATA_FILE_LOADING, { url });

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
						throw new DataError(result.error || `Failed to load ${url}`);
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
				throw new DataError(
					`DataLoader: window.data.loadJSON not available. ` +
					`This is an Electron app and requires the preload bridge. ` +
					`Ensure the preload script is properly loaded.`,
				);
			}

			// Cache in memory for same-session reuse (LRU bounded)
			_addToCache(url, data);
			delete state.loading[url];

			console.debug('[DataLoader]', `Loaded ${url} from disk, duration: ${(performance.now() - loadStart).toFixed(2)}ms, total: ${(performance.now() - start).toFixed(2)}ms`);
			return data;
		} catch (error) {
			delete state.loading[url];
			console.error('[DataLoader]', `Failed to load ${url}:`, error);
			throw error;
		}
	})();

	return state.loading[url];
}

async function loadSkills() {
	const data = await loadJSON(`${state.baseUrl}skills.json`);
	return data;
}

async function loadRaces() {
	return loadJSON(`${state.baseUrl}races.json`);
}

async function loadRaceFluff() {
	return loadJSON(`${state.baseUrl}fluff-races.json`);
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

async function loadVariantRules() {
	return loadJSON(`${state.baseUrl}variantrules.json`);
}

async function loadSources() {
	try {
		return await loadJSON(`${state.baseUrl}books.json`);
	} catch (error) {
		console.warn('[DataLoader]', 'Could not find sources data', error);
		return { source: [] };
	}
}

function clearCache() {
	state.cache.clear();
	state.loading = {};
	console.debug('[DataLoader]', 'Cache cleared');
}

// Auto-clear cache when data is invalidated by external sources
eventBus.on(EVENTS.DATA_INVALIDATED, clearCache);

function resetAll() {
	eventBus.emit(EVENTS.DATA_INVALIDATED);
	console.debug('[DataLoader]', 'Full reset: cache cleared + DATA_INVALIDATED emitted');
}

const dataLoader = {
	loadJSON,
	loadSkills,
	loadRaces,
	loadRaceFluff,
	loadBackgrounds,
	loadFeats,
	loadConditions,
	loadVariantRules,
	loadSources,
	clearCache,
	resetAll,
};

// Legacy convenience alias for DataLoader exports
const DataLoader = dataLoader;

export { DataLoader };
