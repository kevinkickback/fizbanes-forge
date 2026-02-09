import { eventBus } from '../../lib/EventBus.js';

/**
 * Base class for per-page controllers. Subclasses implement initialize()
 * and optionally override cleanup() for page-specific teardown.
 */
export class BasePageController {
    constructor(name) {
        this._name = name;
        this._eventListeners = [];
    }

    _trackListener(event, handler) {
        eventBus.on(event, handler);
        this._eventListeners.push({ event, handler });
    }

    cleanup() {
        for (const { event, handler } of this._eventListeners) {
            eventBus.off(event, handler);
        }
        this._eventListeners = [];
        console.debug(`[${this._name}]`, 'Cleaned up');
    }
}
