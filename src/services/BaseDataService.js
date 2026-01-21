import { AppState } from '../app/AppState.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * Shared helpers for renderer data services.
 * Handles basic caching, initialization guard, and optional event emission.
 */
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
	}

	/** Whether data is already initialized. */
	isInitialized() {
		return Boolean(this._data);
	}

	/**
	 * Hydrate service data from AppState cache when available.
	 * @returns {*} Cached data or null if unavailable
	 */
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

	/**
	 * Persist data locally and optionally into AppState.
	 * @param {*} data Data object to store
	 * @returns {*} Stored data
	 */
	setData(data) {
		this._data = data;
		if (this._cacheKey) {
			AppState.setLoadedData(this._cacheKey, data);
		}
		return this._data;
	}

	/**
	 * Emit the configured load event, if any.
	 * @param {*} payload Payload to emit (array is spread into args)
	 */
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

	/**
	 * Standardized initialization flow with caching and error handling.
	 * @param {Function} loaderFn Async loader returning data
	 * @param {Object} [options]
	 * @param {Function} [options.onLoaded] Callback invoked with data and meta flags
	 * @param {Function} [options.emitPayload] Function returning payload for emitLoaded
	 * @param {Function} [options.onError] Callback invoked on error, should return fallback data
	 * @returns {*} Loaded data
	 */
	async initWithLoader(loaderFn, { onLoaded, emitPayload, onError } = {}) {
		if (this.isInitialized()) return this._data;

		const cached = this.hydrateFromCache();
		if (cached) {
			if (onLoaded) onLoaded(cached, { fromCache: true });
			if (emitPayload)
				this.emitLoaded(emitPayload(cached, { fromCache: true }));
			return cached;
		}

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
		}
	}

	/**
	 * Build a lookup map from an array of items by normalized name.
	 * Supports both single values and arrays of values per name (for name collisions).
	 * @param {Array<Object>} items Array of items to index
	 * @param {Object} [options]
	 * @param {boolean} [options.allowMultiple=false] If true, stores arrays; otherwise single value
	 * @returns {Map} Map with normalized name keys and item(s) as values
	 */
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

	/**
	 * Lookup a single item by normalized name from a lookup map.
	 * @param {Map} lookupMap Map from buildLookupMap()
	 * @param {string} name Item name to look up
	 * @returns {Object|null} First matching item or null
	 */
	lookupByName(lookupMap, name) {
		if (!lookupMap || !name) return null;
		const normalized = DataNormalizer.normalizeForLookup(name);
		const result = lookupMap.get(normalized);
		// Handle both single items and arrays
		return Array.isArray(result) ? (result.length > 0 ? result[0] : null) : result || null;
	}

	/**
	 * Lookup an item by name and source code.
	 * Performs O(1) name lookup, then O(n) source verification within matches.
	 * Falls back to first match if exact source not found.
	 * @param {Map} lookupMap Map from buildLookupMap()
	 * @param {string} name Item name
	 * @param {string} [source=null] Source code to match (optional)
	 * @returns {Object|null} Matching item or null
	 */
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
