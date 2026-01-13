/**
 * Utility for managing DOM cleanup, event listeners, and memory management.
 * Prevents listener stacking and memory leaks when components are reused or destroyed.
 */

export class DOMCleanup {
    constructor() {
        this._listeners = new Map(); // Store [element, event, handler] tuples for removal
        this._timers = new Set(); // Store timeout/interval IDs for cleanup
        this._bootstrapModals = new Map(); // Store Bootstrap modal instances
    }

    /**
     * Safely attach an event listener and track it for cleanup
     * @param {HTMLElement} element - The element to attach listener to
     * @param {string} event - The event name (e.g., 'click')
     * @param {Function} handler - The event handler
     * @param {Object} options - Optional addEventListener options
     */
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

    /**
     * Safely attach a one-time event listener
     * @param {HTMLElement} element - The element to attach listener to
     * @param {string} event - The event name
     * @param {Function} handler - The event handler
     * @param {Object} options - Optional addEventListener options
     */
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

    /**
     * Remove a specific event listener
     * @param {HTMLElement} element - The element
     * @param {string} event - The event name
     * @param {Function} handler - The handler to remove (optional - removes all if not provided)
     */
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

    /**
     * Remove all listeners from an element
     * @param {HTMLElement} element - The element to clean
     */
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

    /**
     * Track a setTimeout for cleanup
     * @param {Function} callback - The callback
     * @param {number} delay - The delay in ms
     * @returns {number} The timeout ID
     */
    setTimeout(callback, delay) {
        const id = window.setTimeout(callback, delay);
        this._timers.add(id);
        return id;
    }

    /**
     * Track a setInterval for cleanup
     * @param {Function} callback - The callback
     * @param {number} interval - The interval in ms
     * @returns {number} The interval ID
     */
    setInterval(callback, interval) {
        const id = window.setInterval(callback, interval);
        this._timers.add(id);
        return id;
    }

    /**
     * Clear a specific timer
     * @param {number} id - The timeout/interval ID
     */
    clearTimer(id) {
        if (this._timers.has(id)) {
            clearTimeout(id);
            clearInterval(id);
            this._timers.delete(id);
        }
    }

    /**
     * Register a Bootstrap modal instance for cleanup
     * @param {HTMLElement} element - The modal element
     * @param {bootstrap.Modal} instance - The Bootstrap Modal instance
     */
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

    /**
     * Get a tracked Bootstrap modal instance
     * @param {HTMLElement} element - The modal element
     * @returns {bootstrap.Modal|null} The instance or null
     */
    getBootstrapModal(element) {
        return this._bootstrapModals.get(element) || null;
    }

    /**
     * Cleans up all tracked resources
     * @returns {Object} Summary of cleanup operations
     */
    cleanup() {
        const summary = {
            listenersRemoved: 0,
            timersCleared: 0,
            modalsDisposed: 0,
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

        console.debug('[DOMCleanup]', 'Cleanup complete', summary);
        return summary;
    }

    /**
     * Get current state for debugging
     * @returns {Object} Current tracked resources
     */
    getState() {
        return {
            totalElements: this._listeners.size,
            totalListeners: Array.from(this._listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
            totalTimers: this._timers.size,
            totalModals: this._bootstrapModals.size,
        };
    }

    /**
     * Static factory to create per-component cleanup manager
     * @returns {DOMCleanup} New instance
     */
    static create() {
        return new DOMCleanup();
    }
}

export default DOMCleanup;
