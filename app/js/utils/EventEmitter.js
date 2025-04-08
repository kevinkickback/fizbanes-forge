/**
 * EventEmitter.js
 * A centralized event emission and subscription system for application-wide events.
 * Allows components to communicate without direct dependencies.
 * 
 * @typedef {Object} EventSubscription
 * @property {Function} unsubscribe - Function to call to remove the event subscription
 */

/**
 * Event emitter for application-wide event handling
 * Provides methods to subscribe to, unsubscribe from, and emit events
 */
class EventEmitter {
    /**
     * Create a new EventEmitter instance
     */
    constructor() {
        /**
         * Storage for event listeners
         * @type {Object<string, Array<Function>>}
         * @private
         */
        this._events = {};
    }

    //-------------------------------------------------------------------------
    // Subscription Methods
    //-------------------------------------------------------------------------

    /**
     * Register an event listener for the specified event
     * 
     * @param {string} event - The event name to listen for
     * @param {Function} listener - The callback function to execute when the event occurs
     * @returns {Function} Unsubscribe function to remove this specific listener
     * @throws {Error} If event name or listener is invalid
     */
    on(event, listener) {
        try {
            if (!event || typeof event !== 'string') {
                throw new Error('Event name must be a valid string');
            }

            if (typeof listener !== 'function') {
                throw new Error('Event listener must be a function');
            }

            if (!this._events[event]) {
                this._events[event] = [];
            }

            this._events[event].push(listener);

            // Return an unsubscribe function for convenience
            return () => this.off(event, listener);
        } catch (error) {
            console.error(`Error registering listener for event '${event}':`, error);
            // Return a no-op unsubscribe function to avoid breaking calls
            return () => false;
        }
    }

    /**
     * Register a one-time event listener that will be removed after first execution
     * 
     * @param {string} event - The event name to listen for
     * @param {Function} listener - The callback function to execute when the event occurs
     * @returns {Function} Unsubscribe function to remove this specific listener
     * @throws {Error} If event name or listener is invalid
     */
    once(event, listener) {
        try {
            if (!event || typeof event !== 'string') {
                throw new Error('Event name must be a valid string');
            }

            if (typeof listener !== 'function') {
                throw new Error('Event listener must be a function');
            }

            const onceWrapper = (...args) => {
                this.off(event, onceWrapper);
                listener.apply(this, args);
            };

            return this.on(event, onceWrapper);
        } catch (error) {
            console.error(`Error registering one-time listener for event '${event}':`, error);
            // Return a no-op unsubscribe function to avoid breaking calls
            return () => false;
        }
    }

    /**
     * Remove an event listener for the specified event
     * 
     * @param {string} event - The event name
     * @param {Function} [listener] - The specific listener to remove. If not provided, all listeners for the event will be removed.
     * @returns {boolean} True if the listener was removed, false otherwise
     */
    off(event, listener) {
        try {
            if (!event || typeof event !== 'string') {
                console.warn('Invalid event name provided to off()');
                return false;
            }

            if (!this._events[event]) {
                return false;
            }

            // If no specific listener is provided, remove all listeners for this event
            if (!listener) {
                delete this._events[event];
                return true;
            }

            const index = this._events[event].indexOf(listener);

            if (index === -1) {
                return false;
            }

            this._events[event].splice(index, 1);

            // Clean up empty event arrays
            if (this._events[event].length === 0) {
                delete this._events[event];
            }

            return true;
        } catch (error) {
            console.error(`Error removing listener for event '${event}':`, error);
            return false;
        }
    }

    //-------------------------------------------------------------------------
    // Event Emission Methods
    //-------------------------------------------------------------------------

    /**
     * Emit an event with the specified arguments
     * 
     * @param {string} event - The event name to emit
     * @param {...any} args - Arguments to pass to the event listeners
     * @returns {boolean} True if the event had listeners, false otherwise
     */
    emit(event, ...args) {
        try {
            if (!event || typeof event !== 'string') {
                console.warn('Invalid event name provided to emit()');
                return false;
            }

            if (!this._events[event] || this._events[event].length === 0) {
                return false;
            }

            // Create a copy of the listeners array to avoid issues if a listener
            // registers or removes other listeners during execution
            const listeners = [...this._events[event]];

            console.debug(`Emitting event '${event}' to ${listeners.length} listeners`);

            for (const listener of listeners) {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`Error in event listener for '${event}':`, error);
                    // Continue execution of other listeners
                }
            }

            return true;
        } catch (error) {
            console.error(`Error emitting event '${event}':`, error);
            return false;
        }
    }

    //-------------------------------------------------------------------------
    // Utility Methods
    //-------------------------------------------------------------------------

    /**
     * Get the number of listeners for a specific event
     * 
     * @param {string} event - The event name
     * @returns {number} The number of listeners for the event
     */
    listenerCount(event) {
        if (!event || typeof event !== 'string') {
            return 0;
        }
        return this._events[event]?.length || 0;
    }

    /**
     * Get the list of event names that have registered listeners
     * 
     * @returns {string[]} Array of event names
     */
    eventNames() {
        return Object.keys(this._events);
    }

    /**
     * Removes all event listeners
     * Use with caution as this will remove all subscriptions across the application
     * 
     * @returns {void}
     */
    removeAllListeners() {
        try {
            this._events = {};
            console.debug('Removed all event listeners');
        } catch (error) {
            console.error('Error removing all listeners:', error);
        }
    }
}

// Create and export a singleton instance for use throughout the application
export const eventEmitter = new EventEmitter(); 