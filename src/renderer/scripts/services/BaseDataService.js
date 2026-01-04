import { AppState } from '../core/AppState.js';
import { eventBus } from '../utils/EventBus.js';

/**
 * Shared helpers for renderer data services.
 * Handles basic caching, initialization guard, and optional event emission.
 */
export class BaseDataService {
    constructor({ cacheKey = null, loadEvent = null, loggerScope = 'DataService' } = {}) {
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
            if (emitPayload) this.emitLoaded(emitPayload(cached, { fromCache: true }));
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
                    if (onLoaded) onLoaded(fallback, { fromCache: false, fromError: true });
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
}
