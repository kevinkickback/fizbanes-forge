import { eventBus, EVENTS } from '../lib/EventBus.js';
import TextProcessor from '../lib/TextProcessor.js';

/** Shared helpers for renderer data services: caching, initialization, and event emission. */
export class BaseDataService {
	constructor({
		loadEvent = null,
		loggerScope = 'DataService',
	} = {}) {
		this._data = null;
		this._loadEvent = loadEvent;
		this._loggerScope = loggerScope;
		this._initPromise = null;
		this._eventListeners = [];

		// Listen for cache invalidation so auto-update can force re-init
		this._onDataInvalidated = () => this.resetData();
		this._trackListener(EVENTS.DATA_INVALIDATED, this._onDataInvalidated);
	}

	_trackListener(event, handler) {
		eventBus.on(event, handler);
		this._eventListeners.push({ event, handler });
	}

	dispose() {
		for (const { event, handler } of this._eventListeners) {
			eventBus.off(event, handler);
		}
		this._eventListeners = [];
		this._data = null;
		this._initPromise = null;
		console.debug(`[${this._loggerScope}]`, 'Disposed');
	}

	isInitialized() {
		return Boolean(this._data);
	}

	resetData() {
		this._data = null;
		this._initPromise = null;
		console.debug(`[${this._loggerScope}]`, 'Data reset via invalidation');
	}

	setData(data) {
		this._data = data;
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
