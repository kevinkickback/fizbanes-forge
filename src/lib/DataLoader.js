import { DataError } from './Errors.js';
import { eventBus, EVENTS } from './EventBus.js';

const state = {
	cache: {},
	loading: {},
	baseUrl: '', // Base URL now empty since data is at root
};

async function loadJSON(url) {
	const start = performance.now();

	// Check in-memory cache first
	if (state.cache[url]) {
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

			// Cache in memory for same-session reuse
			state.cache[url] = data;
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
	console.debug('[DataLoader]', 'Cache cleared');
}

function resetAll() {
	clearCache();
	eventBus.emit(EVENTS.DATA_INVALIDATED);
	console.debug('[DataLoader]', 'Full reset: L1 cache cleared + DATA_INVALIDATED emitted');
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
	resetAll,
};

// Legacy convenience alias for DataLoader exports
const DataLoader = dataLoader;

export { DataLoader };
