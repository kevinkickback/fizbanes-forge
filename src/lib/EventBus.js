/** Decoupled event bus for renderer components (infrastructure layer). */

import EventEmitter from 'eventemitter3';

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
	DATA_FILE_LOADING: 'data:fileLoading',

	// UI events
	MODAL_OPENED: 'modal:opened',
	MODAL_CLOSED: 'modal:closed',

	// Error events
	ERROR_OCCURRED: 'error:occurred',

	// Proficiency events
	PROFICIENCY_ADDED: 'proficiency:added',
	PROFICIENCY_REMOVED_BY_SOURCE: 'proficiency:removedBySource',
	PROFICIENCY_REFUNDED: 'proficiency:refunded',
	PROFICIENCY_OPTIONAL_CONFIGURED: 'proficiency:optionalConfigured',
	PROFICIENCY_OPTIONAL_CLEARED: 'proficiency:optionalCleared',
	PROFICIENCY_OPTIONAL_SELECTED: 'proficiency:optionalSelected',
	PROFICIENCY_OPTIONAL_DESELECTED: 'proficiency:optionalDeselected',

	// Feat events
	FEATS_SELECTED: 'feats:selected',

	// Character creation events
	CLASS_SELECTED: 'class:selected',
	SUBCLASS_SELECTED: 'subclass:selected',
	RACE_SELECTED: 'race:selected',
	SUBRACE_SELECTED: 'subrace:selected',
	BACKGROUND_SELECTED: 'background:selected',
	NEW_CHARACTER_MODAL_OPENED: 'modal:newCharacterOpened',
	NEW_CHARACTER_MODAL_CLOSED: 'modal:newCharacterClosed',

	// Data loading events
	SPELLS_LOADED: 'spells:loaded',
	ITEMS_LOADED: 'items:loaded',

	// Equipment/Inventory events
	ITEM_ADDED: 'item:added',
	ITEM_REMOVED: 'item:removed',
	ITEM_EQUIPPED: 'item:equipped',
	ITEM_UNEQUIPPED: 'item:unequipped',
	ITEM_ATTUNED: 'item:attuned',
	ITEM_UNATTUNED: 'item:unattuned',
	INVENTORY_UPDATED: 'inventory:updated',
	ENCUMBRANCE_CHANGED: 'encumbrance:changed',

	// Spell events
	SPELL_ADDED: 'spell:added',
	SPELL_REMOVED: 'spell:removed',
	SPELL_PREPARED: 'spell:prepared',
	SPELL_UNPREPARED: 'spell:unprepared',
	SPELL_SLOTS_USED: 'spell-slots:used',
	SPELL_SLOTS_RESTORED: 'spell-slots:restored',
	SPELLS_UPDATED: 'spells:updated',

	// Level-up and progression events
	CHARACTER_LEVEL_CHANGED: 'character:levelChanged',
	CHARACTER_LEVELED_UP: 'character:leveledUp',
	CHARACTER_LEVELED_DOWN: 'character:leveledDown',
	MULTICLASS_ADDED: 'multiclass:added',
	MULTICLASS_REMOVED: 'multiclass:removed',
	FEATURES_ADDED: 'features:added',
	FEATURES_REMOVED: 'features:removed',

	// Settings events
	SETTINGS_SAVE_PATH_CHANGED: 'settings:savePathChanged',
	SETTINGS_SAVE_PATH_RESET: 'settings:savePathReset',

	// Data source events
	DATA_SOURCE_CHANGED: 'dataSource:changed',

	// Service lifecycle
	SERVICE_INITIALIZED: 'service:initialized',
};

// Wrapper class to maintain existing API while using EventEmitter3 internally
class EventBusImpl extends EventEmitter {
	// Maintain existing on() behavior with debug logging
	on(event, handler) {
		if (typeof handler !== 'function') {
			console.error('[EventBus]', 'Handler must be a function', { event });
			return this;
		}

		super.on(event, handler);
		console.debug('[EventBus]', 'Listener registered', {
			event,
			totalListeners: this.listenerCount(event),
		});
		return this;
	}

	// Maintain existing once() behavior with debug logging
	once(event, handler) {
		if (typeof handler !== 'function') {
			console.error('[EventBus]', 'Handler must be a function', { event });
			return this;
		}

		super.once(event, handler);
		console.debug('[EventBus]', 'One-time listener registered', { event });
		return this;
	}

	// Maintain existing off() behavior with debug logging
	// IMPORTANT: Require handler to prevent accidentally removing ALL listeners
	off(event, handler) {
		if (!handler) {
			console.warn(
				'[EventBus]',
				'off() called without handler - ignoring to prevent removing all listeners',
				{ event },
			);
			return this;
		}

		const previousCount = this.listenerCount(event);
		super.off(event, handler);
		const newCount = this.listenerCount(event);

		if (previousCount !== newCount) {
			console.debug('[EventBus]', 'Listener removed', {
				event,
				remainingListeners: newCount,
			});
		}
		return this;
	}

	// Maintain existing emit() behavior with debug logging and error handling
	emit(event, ...args) {
		console.debug('[EventBus]', 'Event emitted', {
			event,
			argsCount: args.length,
		});

		try {
			return super.emit(event, ...args);
		} catch (error) {
			console.error('[EventBus]', 'Error in event handler', {
				event,
				error,
			});
			return false;
		}
	}

	// Maintain existing clearEvent() method
	clearEvent(event) {
		this.removeAllListeners(event);
		console.debug('[EventBus]', 'Event cleared', { event });
	}

	// Maintain existing clearAll() method
	clearAll() {
		this.removeAllListeners();
		console.debug('[EventBus]', 'All events cleared');
	}
}

export const eventBus = new EventBusImpl();
export { EventBusImpl };
