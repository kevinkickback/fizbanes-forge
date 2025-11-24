/**
 * Event bus for decoupled component communication.
 * 
 * ARCHITECTURE: Infrastructure Layer - No dependencies on other app code
 * 
 * PURPOSE:
 * - Enables loose coupling between components
 * - Components don't need direct references to each other
 * - Easy to add/remove event listeners
 * - Prevents circular dependencies
 * 
 * USAGE EXAMPLES:
 *   import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
 *   
 *   // Component A - Emit event
 *   eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
 *   
 *   // Component B - Listen for event
 *   eventBus.on(EVENTS.CHARACTER_SELECTED, (character) => {
 *     console.log('Character changed:', character);
 *   });
 *   
 *   // Component B - Cleanup
 *   eventBus.off(EVENTS.CHARACTER_SELECTED, handlerFunction);
 *   
 *   // One-time listener
 *   eventBus.once(EVENTS.APP_READY, () => {
 *     console.log('App is ready!');
 *   });
 * 
 * @module infrastructure/EventBus
 */

import { Logger } from './Logger.js';

/**
 * Standard event names used throughout the application.
 * Add new events here as needed.
 */
export const EVENTS = {
    // Application lifecycle
    APP_READY: 'app:ready',
    APP_SHUTDOWN: 'app:shutdown',

    // State changes
    STATE_CHANGED: 'state:changed',

    // Character events
    CHARACTER_SELECTED: 'character:selected',
    CHARACTER_CREATED: 'character:created',
    CHARACTER_DELETED: 'character:deleted',
    CHARACTER_UPDATED: 'character:updated',
    CHARACTER_SAVED: 'character:saved',
    CHARACTER_LOADED: 'character:loaded',

    // Navigation events
    PAGE_CHANGED: 'page:changed',
    PAGE_LOADED: 'page:loaded',

    // Data events
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error',

    // UI events
    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',

    // Error events
    ERROR_OCCURRED: 'error:occurred',

    // Storage events
    STORAGE_CHARACTER_LOADED: 'storage:characterLoaded',
    STORAGE_CHARACTER_SAVED: 'storage:characterSaved',
    STORAGE_CHARACTER_DELETED: 'storage:characterDeleted',

    // Proficiency events
    PROFICIENCY_ADDED: 'proficiency:added',
    PROFICIENCY_REMOVED_BY_SOURCE: 'proficiency:removedBySource',
    PROFICIENCY_REFUNDED: 'proficiency:refunded',
    PROFICIENCY_OPTIONAL_CONFIGURED: 'proficiency:optionalConfigured',
    PROFICIENCY_OPTIONAL_CLEARED: 'proficiency:optionalCleared',
    PROFICIENCY_OPTIONAL_SELECTED: 'proficiency:optionalSelected',
    PROFICIENCY_OPTIONAL_DESELECTED: 'proficiency:optionalDeselected'
};

class EventBusImpl {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
    }

    /**
     * Register an event listener.
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            Logger.error('EventBus', 'Handler must be a function', { event });
            return;
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        this.listeners.get(event).push(handler);
        Logger.debug('EventBus', 'Listener registered', { event, totalListeners: this.listeners.get(event).length });
    }

    /**
     * Register a one-time event listener.
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    once(event, handler) {
        if (typeof handler !== 'function') {
            Logger.error('EventBus', 'Handler must be a function', { event });
            return;
        }

        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, []);
        }

        this.onceListeners.get(event).push(handler);
        Logger.debug('EventBus', 'One-time listener registered', { event });
    }

    /**
     * Remove an event listener.
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function to remove
     */
    off(event, handler) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);

            if (index !== -1) {
                handlers.splice(index, 1);
                Logger.debug('EventBus', 'Listener removed', { event, remainingListeners: handlers.length });

                if (handlers.length === 0) {
                    this.listeners.delete(event);
                }
            }
        }
    }

    /**
     * Emit an event with optional data.
     * @param {string} event - Event name
     * @param {...*} args - Arguments to pass to handlers
     */
    emit(event, ...args) {
        Logger.debug('EventBus', 'Event emitted', { event, argsCount: args.length });

        // Handle regular listeners
        if (this.listeners.has(event)) {
            const handlers = [...this.listeners.get(event)];

            for (const handler of handlers) {
                try {
                    handler(...args);
                } catch (error) {
                    Logger.error('EventBus', 'Error in event handler', { event, error });
                }
            }
        }

        // Handle once listeners
        if (this.onceListeners.has(event)) {
            const handlers = [...this.onceListeners.get(event)];
            this.onceListeners.delete(event);

            for (const handler of handlers) {
                try {
                    handler(...args);
                } catch (error) {
                    Logger.error('EventBus', 'Error in once handler', { event, error });
                }
            }
        }
    }

    /**
     * Remove all listeners for a specific event.
     * @param {string} event - Event name
     */
    clearEvent(event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
        Logger.debug('EventBus', 'Event cleared', { event });
    }

    /**
     * Remove all listeners for all events.
     */
    clearAll() {
        this.listeners.clear();
        this.onceListeners.clear();
        Logger.debug('EventBus', 'All events cleared');
    }

    /**
     * Get count of listeners for an event.
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        const regularCount = this.listeners.has(event) ? this.listeners.get(event).length : 0;
        const onceCount = this.onceListeners.has(event) ? this.onceListeners.get(event).length : 0;
        return regularCount + onceCount;
    }

    /**
     * Get all registered event names.
     * @returns {string[]} Array of event names
     */
    eventNames() {
        const regular = Array.from(this.listeners.keys());
        const once = Array.from(this.onceListeners.keys());
        return [...new Set([...regular, ...once])];
    }
}

export const eventBus = new EventBusImpl();
export { EventBusImpl };
