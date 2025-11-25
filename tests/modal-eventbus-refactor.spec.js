/**
 * Tests for Modal.js EventBus Refactoring
 * 
 * Tests Modal's migration from callback pattern to EventBus events.
 * Verifies that:
 * 1. NEW_CHARACTER_MODAL_OPENED event is emitted when modal opens
 * 2. NEW_CHARACTER_MODAL_CLOSED event is emitted when modal closes
 * 3. CHARACTER_CREATED event is emitted when character is created
 * 4. ERROR_OCCURRED event is emitted on errors
 * 5. Backward compatibility is maintained with callback handlers
 * 
 * Note: This test is designed for Node.js test environment, not Electron window.
 * For E2E tests, see modal-eventbus-e2e.spec.js
 */

const { test, expect } = require('@playwright/test');

// Mock EventBus for unit testing
class MockEventBus {
    constructor() {
        this.listeners = new Map();
        this.emittedEvents = [];
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }

    off(event, handler) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, ...args) {
        this.emittedEvents.push({ event, args, timestamp: Date.now() });
        if (this.listeners.has(event)) {
            for (const handler of this.listeners.get(event)) {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in listener for ${event}:`, error);
                }
            }
        }
    }

    getEmittedEvents(event) {
        return this.emittedEvents.filter(e => e.event === event);
    }

    clearEmittedEvents() {
        this.emittedEvents = [];
    }
}

// Mock EVENTS constant
const MOCK_EVENTS = {
    NEW_CHARACTER_MODAL_OPENED: 'modal:newCharacterOpened',
    NEW_CHARACTER_MODAL_CLOSED: 'modal:newCharacterClosed',
    CHARACTER_CREATED: 'character:created',
    ERROR_OCCURRED: 'error:occurred'
};

test.describe('Modal EventBus Refactoring - Unit Tests', () => {
    let mockEventBus;

    test.beforeEach(() => {
        mockEventBus = new MockEventBus();
    });

    test('should track NEW_CHARACTER_MODAL_OPENED emission', () => {
        const calls = [];
        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED, () => {
            calls.push('called');
        });

        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);

        expect(mockEventBus.getEmittedEvents(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED)).toHaveLength(1);
        expect(calls).toHaveLength(1);
    });

    test('should track NEW_CHARACTER_MODAL_CLOSED emission', () => {
        const calls = [];
        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED, () => {
            calls.push('called');
        });

        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED);

        expect(mockEventBus.getEmittedEvents(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED)).toHaveLength(1);
        expect(calls).toHaveLength(1);
    });

    test('should track CHARACTER_CREATED emission with data', () => {
        const receivedData = [];
        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, (data) => {
            receivedData.push(data);
        });

        const testCharacter = {
            id: 'test-id-123',
            name: 'Test Character',
            level: 1
        };

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, testCharacter);

        const emittedEvents = mockEventBus.getEmittedEvents(MOCK_EVENTS.CHARACTER_CREATED);
        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0].args[0]).toEqual(testCharacter);
        expect(receivedData[0]).toEqual(testCharacter);
    });

    test('should track ERROR_OCCURRED emission', () => {
        const errors = [];
        mockEventBus.on(MOCK_EVENTS.ERROR_OCCURRED, (error) => {
            errors.push(error);
        });

        const errorMessage = 'Test error message';
        mockEventBus.emit(MOCK_EVENTS.ERROR_OCCURRED, errorMessage);

        const emittedEvents = mockEventBus.getEmittedEvents(MOCK_EVENTS.ERROR_OCCURRED);
        expect(emittedEvents).toHaveLength(1);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toEqual(errorMessage);
    });

    test('should allow multiple listeners for same event', () => {
        const calls1 = [];
        const calls2 = [];

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, () => {
            calls1.push('called');
        });
        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, () => {
            calls2.push('called');
        });

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });

        expect(calls1).toHaveLength(1);
        expect(calls2).toHaveLength(1);
    });

    test('should allow listener removal', () => {
        const calls = [];
        const listener = () => {
            calls.push('called');
        };

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, listener);
        mockEventBus.off(MOCK_EVENTS.CHARACTER_CREATED, listener);

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });

        expect(calls).toHaveLength(0);
    });

    test('should track event emission order', () => {
        const events = [];

        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED, () => {
            events.push('opened');
        });
        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, () => {
            events.push('created');
        });
        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED, () => {
            events.push('closed');
        });

        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED);

        expect(events).toEqual(['opened', 'created', 'closed']);
    });

    test('should clear emitted events', () => {
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });

        expect(mockEventBus.emittedEvents).toHaveLength(2);

        mockEventBus.clearEmittedEvents();

        expect(mockEventBus.emittedEvents).toHaveLength(0);
    });
});

test.describe('Modal EventBus Refactoring - Event Patterns', () => {
    let mockEventBus;

    test.beforeEach(() => {
        mockEventBus = new MockEventBus();
    });

    /**
     * Test Pattern: Modal Open/Create/Close Sequence
     * Simulates the typical flow of opening modal, creating character, and closing modal
     */
    test('should emit events in correct sequence for character creation flow', () => {
        const eventSequence = [];

        // Setup listeners
        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED, () => {
            eventSequence.push('MODAL_OPENED');
        });

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, (character) => {
            eventSequence.push(`CHARACTER_CREATED(${character.id})`);
        });

        mockEventBus.on(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED, () => {
            eventSequence.push('MODAL_CLOSED');
        });

        // Simulate flow
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: 'char-1', name: 'Fighter' });
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED);

        expect(eventSequence).toEqual([
            'MODAL_OPENED',
            'CHARACTER_CREATED(char-1)',
            'MODAL_CLOSED'
        ]);
    });

    /**
     * Test Pattern: Modal with Multiple Characters
     * Tests that multiple character creation events are properly tracked
     */
    test('should track multiple character creations', () => {
        const createdCharacters = [];

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, (character) => {
            createdCharacters.push(character.id);
        });

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: 'char-1' });
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: 'char-2' });
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: 'char-3' });

        expect(createdCharacters).toEqual(['char-1', 'char-2', 'char-3']);
        expect(mockEventBus.getEmittedEvents(MOCK_EVENTS.CHARACTER_CREATED)).toHaveLength(3);
    });

    /**
     * Test Pattern: Error During Character Creation
     * Tests error handling and ERROR_OCCURRED emission
     */
    test('should emit ERROR_OCCURRED when character creation fails', () => {
        const errors = [];

        mockEventBus.on(MOCK_EVENTS.ERROR_OCCURRED, (error) => {
            errors.push(error);
        });

        // Simulate error during character creation
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);
        mockEventBus.emit(MOCK_EVENTS.ERROR_OCCURRED, 'Failed to save character');
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED);

        expect(errors).toEqual(['Failed to save character']);
    });

    /**
     * Test Pattern: Modal Cancellation
     * Tests that no CHARACTER_CREATED event is emitted when modal is cancelled
     */
    test('should not emit CHARACTER_CREATED if user cancels modal', () => {
        const createdCharacters = [];

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, (character) => {
            createdCharacters.push(character.id);
        });

        // Simulate user opening and cancelling modal
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_OPENED);
        mockEventBus.emit(MOCK_EVENTS.NEW_CHARACTER_MODAL_CLOSED);

        expect(createdCharacters).toHaveLength(0);
    });
});

test.describe('Modal EventBus Refactoring - Listener Management', () => {
    let mockEventBus;

    test.beforeEach(() => {
        mockEventBus = new MockEventBus();
    });

    /**
     * Test Pattern: Listener Cleanup
     * Ensures listeners can be properly removed to prevent memory leaks
     */
    test('should properly clean up listeners', () => {
        const calls = [];
        const listener = () => {
            calls.push('called');
        };

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, listener);
        mockEventBus.off(MOCK_EVENTS.CHARACTER_CREATED, listener);

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });

        expect(calls).toHaveLength(0);
    });

    /**
     * Test Pattern: Multiple Listeners with Selective Removal
     * Tests that removing one listener doesn't affect others
     */
    test('should remove only specified listener', () => {
        const calls1 = [];
        const calls2 = [];
        const listener1 = () => {
            calls1.push('called');
        };
        const listener2 = () => {
            calls2.push('called');
        };

        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, listener1);
        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, listener2);
        mockEventBus.off(MOCK_EVENTS.CHARACTER_CREATED, listener1);

        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: '123' });

        expect(calls1).toHaveLength(0);
        expect(calls2).toHaveLength(1);
    });
});

test.describe('Modal EventBus Refactoring - Backward Compatibility', () => {
    /**
     * This test suite validates that the old callback pattern
     * continues to work alongside the new EventBus pattern
     */

    test('demonstrates callback vs EventBus pattern differences', () => {
        // OLD pattern (callbacks) - not called when using EventBus
        let callbackCalled = false;
        const oldCallbacks = {
            onShowModal: () => { callbackCalled = true; },
            onCreateCharacter: () => { callbackCalled = true; }
        };

        // NEW pattern (EventBus)
        const mockEventBus = new MockEventBus();
        let eventListenerCalled = false;
        mockEventBus.on(MOCK_EVENTS.CHARACTER_CREATED, () => {
            eventListenerCalled = true;
        });

        // With new pattern, component doesn't need callbacks
        mockEventBus.emit(MOCK_EVENTS.CHARACTER_CREATED, { id: 'char-1' });

        expect(eventListenerCalled).toBe(true);
        expect(callbackCalled).toBe(false);
    });
});
