/** Utility for managing DOM cleanup, event listeners, and memory management. */

import { eventBus } from './EventBus.js';

export class DOMCleanup {
    constructor() {
        this._listeners = new Map(); // Store [element, event, handler] tuples for removal
        this._timers = new Set(); // Store timeout/interval IDs for cleanup
        this._bootstrapModals = new Map(); // Store Bootstrap modal instances
        this._eventBusListeners = []; // Store EventBus listeners for cleanup
    }

    on(element, event, handler, options = false) {
        if (!element || typeof event !== 'string' || typeof handler !== 'function') {
            console.warn('[DOMCleanup]', 'Invalid arguments to on()', {
                hasElement: !!element,
                eventType: typeof event,
                handlerType: typeof handler,
            });
            return;
        }

        element.addEventListener(event, handler, options);

        // Track for cleanup
        if (!this._listeners.has(element)) {
            this._listeners.set(element, []);
        }
        this._listeners.get(element).push({ event, handler, options });
    }

    once(element, event, handler, options = false) {
        if (!element || typeof event !== 'string' || typeof handler !== 'function') {
            return;
        }

        const wrappedHandler = (e) => {
            handler(e);
            this.off(element, event, wrappedHandler);
        };

        this.on(element, event, wrappedHandler, options);
    }

    off(element, event, handler = null) {
        if (!element || !this._listeners.has(element)) {
            return;
        }

        const listeners = this._listeners.get(element);
        for (let i = listeners.length - 1; i >= 0; i--) {
            const listener = listeners[i];
            if (listener.event === event && (!handler || listener.handler === handler)) {
                element.removeEventListener(listener.event, listener.handler, listener.options);
                listeners.splice(i, 1);
            }
        }

        // Clean up tracking if no listeners remain
        if (listeners.length === 0) {
            this._listeners.delete(element);
        }
    }

    offAll(element) {
        if (!element || !this._listeners.has(element)) {
            return;
        }

        const listeners = this._listeners.get(element);
        for (const listener of listeners) {
            element.removeEventListener(listener.event, listener.handler, listener.options);
        }

        this._listeners.delete(element);
    }

    setTimeout(callback, delay) {
        const id = window.setTimeout(callback, delay);
        this._timers.add(id);
        return id;
    }

    setInterval(callback, interval) {
        const id = window.setInterval(callback, interval);
        this._timers.add(id);
        return id;
    }

    clearTimer(id) {
        if (this._timers.has(id)) {
            clearTimeout(id);
            clearInterval(id);
            this._timers.delete(id);
        }
    }

    onEvent(event, handler) {
        if (typeof event !== 'string' || typeof handler !== 'function') {
            console.warn('[DOMCleanup]', 'Invalid arguments to onEvent()', {
                eventType: typeof event,
                handlerType: typeof handler,
            });
            return;
        }

        console.debug('[DOMCleanup]', 'Registering EventBus listener', { event });
        eventBus.on(event, handler);
        this._eventBusListeners.push({ event, handler });
    }

    offEvent(event, handler = null) {
        for (let i = this._eventBusListeners.length - 1; i >= 0; i--) {
            const listener = this._eventBusListeners[i];
            if (listener.event === event && (!handler || listener.handler === handler)) {
                eventBus.off(listener.event, listener.handler);
                this._eventBusListeners.splice(i, 1);
            }
        }
    }

    registerBootstrapModal(element, instance) {
        if (this._bootstrapModals.has(element)) {
            // Dispose old instance if exists
            try {
                this._bootstrapModals.get(element).dispose();
            } catch (e) {
                console.warn('[DOMCleanup]', 'Error disposing old Bootstrap modal', e);
            }
        }
        this._bootstrapModals.set(element, instance);
    }

    getBootstrapModal(element) {
        return this._bootstrapModals.get(element) || null;
    }

    cleanup() {
        const summary = {
            listenersRemoved: 0,
            timersCleared: 0,
            modalsDisposed: 0,
            eventBusListenersRemoved: 0,
        };

        // Remove all event listeners
        for (const [element, listeners] of this._listeners) {
            for (const listener of listeners) {
                try {
                    element.removeEventListener(listener.event, listener.handler, listener.options);
                    summary.listenersRemoved++;
                } catch (e) {
                    console.warn('[DOMCleanup]', 'Error removing listener', e);
                }
            }
        }
        this._listeners.clear();

        // Clear all timers
        for (const id of this._timers) {
            try {
                clearTimeout(id);
                clearInterval(id);
                summary.timersCleared++;
            } catch (e) {
                console.warn('[DOMCleanup]', 'Error clearing timer', e);
            }
        }
        this._timers.clear();

        // Dispose Bootstrap modals
        for (const [_element, modal] of this._bootstrapModals) {
            try {
                modal.dispose();
                summary.modalsDisposed++;
            } catch (e) {
                console.warn('[DOMCleanup]', 'Error disposing Bootstrap modal', e);
            }
        }
        this._bootstrapModals.clear();

        // Remove all EventBus listeners
        for (const listener of this._eventBusListeners) {
            try {
                eventBus.off(listener.event, listener.handler);
                summary.eventBusListenersRemoved++;
            } catch (e) {
                console.warn('[DOMCleanup]', 'Error removing EventBus listener', e);
            }
        }
        this._eventBusListeners = [];

        console.debug('[DOMCleanup]', 'Cleanup complete', summary);
        return summary;
    }

    getState() {
        return {
            totalElements: this._listeners.size,
            totalListeners: Array.from(this._listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
            totalTimers: this._timers.size,
            totalModals: this._bootstrapModals.size,
            totalEventBusListeners: this._eventBusListeners.length,
        };
    }

    static create() {
        return new DOMCleanup();
    }
}

export default DOMCleanup;
