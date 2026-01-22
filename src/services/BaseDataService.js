import { AppState } from '../app/AppState.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus } from '../lib/EventBus.js';

/** Shared helpers for renderer data services: caching, initialization, and event emission. */
export class BaseDataService {
	constructor({
		cacheKey = null,
		loadEvent = null,
		loggerScope = 'DataService',
	} = {}) {
		this._data = null;
		this._cacheKey = cacheKey;
		this._loadEvent = loadEvent;
		this._loggerScope = loggerScope;
		this._initPromise = null; // Mutex for preventing concurrent initialization
	}

	/** Whether data is already initialized. */
	isInitialized() {
		return Boolean(this._data);
	}

	/** Hydrate service data from AppState cache when available. */
	hydrateFromCache() {
		if (!this._cacheKey) return null;
		const cached = AppState.getLoadedData(this._cacheKey);
		if (cached) {
			this._data = cached;
			console.debug(`[${this._loggerScope}]`, 'Hydrated from AppState cache');
			return cached;
		}
		return null;
	}

	/** Persist data locally and optionally into AppState. */
	setData(data) {
		this._data = data;
		if (this._cacheKey) {
			AppState.setLoadedData(this._cacheKey, data);
		}
		return this._data;
	}

	/** Emit the configured load event, if any. */
	emitLoaded(payload = this._data) {
		if (!this._loadEvent) return;
		if (Array.isArray(payload)) {
			eventBus.emit(this._loadEvent, ...payload);
			return;
		}
		eventBus.emit(this._loadEvent, payload);
	}

	/** Reset local data. */
	reset() {
		this._data = null;
	}

	/** Standardized initialization flow with caching and error handling. */
	async initWithLoader(loaderFn, { onLoaded, emitPayload, onError } = {}) {
		// If already initialized, return cached data
		if (this.isInitialized()) return this._data;

		// If initialization is in progress, wait for it
		if (this._initPromise) {
			console.debug(`[${this._loggerScope}]`, 'Initialization already in progress, waiting...');
			return this._initPromise;
		}

		const cached = this.hydrateFromCache();
		if (cached) {
			if (onLoaded) onLoaded(cached, { fromCache: true });
			if (emitPayload)
				this.emitLoaded(emitPayload(cached, { fromCache: true }));
			return cached;
		}

		// Create initialization promise to prevent concurrent calls
		this._initPromise = (async () => {
			try {
				const data = await loaderFn();
				this.setData(data);
				if (onLoaded) onLoaded(data, { fromCache: false });
				if (emitPayload) this.emitLoaded(emitPayload(data, { fromCache: false }));
				return data;
			} catch (error) {
				console.error(`[${this._loggerScope}]`, 'Initialization failed', error);
				if (onError) {
					const fallback = onError(error);
					if (fallback !== undefined) {
						this.setData(fallback);
						if (onLoaded)
							onLoaded(fallback, { fromCache: false, fromError: true });
						if (emitPayload)
							this.emitLoaded(
								emitPayload(fallback, { fromCache: false, fromError: true }),
							);
						return fallback;
					}
				}
				throw error;
			} finally {
				// Clear promise after completion to allow re-initialization if needed
				this._initPromise = null;
			}
		})();

		return this._initPromise;
	}

	/** Build a lookup map from an array of items by normalized name. */
	buildLookupMap(items = [], { allowMultiple = false } = {}) {
		const map = new Map();
		for (const item of items) {
			if (!item?.name) continue;
			const key = DataNormalizer.normalizeForLookup(item.name);
			if (allowMultiple) {
				if (!map.has(key)) map.set(key, []);
				map.get(key).push(item);
			} else {
				map.set(key, item);
			}
		}
		return map;
	}

	/** Lookup a single item by normalized name from a lookup map. */
	lookupByName(lookupMap, name) {
		if (!lookupMap || !name) return null;
		const normalized = DataNormalizer.normalizeForLookup(name);
		const result = lookupMap.get(normalized);
		// Handle both single items and arrays
		return Array.isArray(result) ? (result.length > 0 ? result[0] : null) : result || null;
	}

	/** Lookup an item by name and source code with O(1) name lookup. */
	lookupByNameAndSource(lookupMap, name, source = null) {
		if (!lookupMap || !name) return null;
		const normalized = DataNormalizer.normalizeForLookup(name);
		let matches = lookupMap.get(normalized);

		if (!matches) return null;

		// Normalize to array for uniform handling
		if (!Array.isArray(matches)) {
			matches = [matches];
		}

		// If no source specified, return first match
		if (!source) {
			return matches.length > 0 ? matches[0] : null;
		}

		// Find exact source match
		const exactMatch = matches.find((m) => m.source === source);
		if (exactMatch) return exactMatch;

		// Fall back to first match if exact source not found
		return matches.length > 0 ? matches[0] : null;
	}
}
