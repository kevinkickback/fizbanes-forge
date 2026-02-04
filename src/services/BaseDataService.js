import { AppState } from '../app/AppState.js';
import { eventBus } from '../lib/EventBus.js';
import TextProcessor from '../lib/TextProcessor.js';

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
		this._initPromise = null;
	}

	isInitialized() {
		return Boolean(this._data);
	}

	hydrateFromCache() {
		if (!this._cacheKey) return null;
		const cached = AppState.getLoadedData(this._cacheKey);
		if (cached) {
			this._data = cached;
			return cached;
		}
		return null;
	}

	setData(data) {
		this._data = data;
		if (this._cacheKey) {
			AppState.setLoadedData(this._cacheKey, data);
		}
		return this._data;
	}

	emitLoaded(payload = this._data) {
		if (!this._loadEvent) return;
		if (Array.isArray(payload)) {
			eventBus.emit(this._loadEvent, ...payload);
			return;
		}
		eventBus.emit(this._loadEvent, payload);
	}

	async initWithLoader(loaderFn, { onLoaded, emitPayload, onError } = {}) {
		if (this.isInitialized()) {
			return this._data;
		}

		if (this._initPromise) {
			return this._initPromise;
		}

		const cached = this.hydrateFromCache();
		if (cached) {
			if (onLoaded) onLoaded(cached, { fromCache: true });
			if (emitPayload)
				this.emitLoaded(emitPayload(cached, { fromCache: true }));
			return cached;
		}

		this._initPromise = (async () => {
			try {
				const data = await loaderFn();
				this.setData(data);
				if (onLoaded) onLoaded(data, { fromCache: false });
				if (emitPayload)
					this.emitLoaded(emitPayload(data, { fromCache: false }));
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
				this._initPromise = null;
			}
		})();

		return this._initPromise;
	}

	buildLookupMap(items = [], { allowMultiple = false } = {}) {
		const map = new Map();
		for (const item of items) {
			if (!item?.name) continue;
			const key = TextProcessor.normalizeForLookup(item.name);
			if (allowMultiple) {
				if (!map.has(key)) map.set(key, []);
				map.get(key).push(item);
			} else {
				map.set(key, item);
			}
		}
		return map;
	}

	lookupByNameAndSource(lookupMap, name, source = null) {
		if (!lookupMap || !name) return null;
		const normalized = TextProcessor.normalizeForLookup(name);
		let matches = lookupMap.get(normalized);

		if (!matches) return null;

		if (!Array.isArray(matches)) {
			matches = [matches];
		}

		if (!source) {
			return matches.length > 0 ? matches[0] : null;
		}

		const exactMatch = matches.find((m) => m.source === source);
		if (exactMatch) return exactMatch;

		return matches.length > 0 ? matches[0] : null;
	}
}
