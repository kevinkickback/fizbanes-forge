import { DataError } from './Errors.js';
import { eventBus, EVENTS } from './EventBus.js';

const MAX_CACHE_SIZE = 200;

const state = {
	cache: {},
	loading: {},
	cacheAccessOrder: [],
	baseUrl: '', // Base URL now empty since data is at root
};

function _addToCache(url, data) {
	// Evict least recently used if cache is full
	if (Object.keys(state.cache).length >= MAX_CACHE_SIZE && !state.cache[url]) {
		const lruUrl = state.cacheAccessOrder.shift();
		if (lruUrl) {
			delete state.cache[lruUrl];
			console.debug('[DataLoader]', `Evicted LRU entry: ${lruUrl}`);
		}
	}

	state.cache[url] = data;
	_updateCacheAccess(url);
}

function _updateCacheAccess(url) {
	const index = state.cacheAccessOrder.indexOf(url);
	if (index > -1) {
		state.cacheAccessOrder.splice(index, 1);
	}
	state.cacheAccessOrder.push(url);
}

async function loadJSON(url) {
	const start = performance.now();

	// Check in-memory cache first
	if (state.cache[url]) {
		_updateCacheAccess(url);
		console.debug('[DataLoader]', `Cache hit for ${url}, duration: ${(performance.now() - start).toFixed(2)}ms`);
		return state.cache[url];
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
	state.cache = {};
	state.loading = {};
	state.cacheAccessOrder = [];
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
