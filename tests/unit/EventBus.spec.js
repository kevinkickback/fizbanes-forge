import { test, expect } from '@playwright/test';
import { EventBusImpl, EVENTS } from '../../app/js/infrastructure/EventBus.js';

test.describe('EventBus - Event Emission and Listening', () => {

    let eventBus;

    test.beforeEach(() => {
        eventBus = new EventBusImpl();
    });

    test('should emit and receive events', () => {
        let received = null;

        eventBus.on('test:event', (data) => {
            received = data;
        });

        eventBus.emit('test:event', { value: 'test' });

        expect(received).toEqual({ value: 'test' });
    });

    test('should support multiple listeners for same event', () => {
        const results = [];

        eventBus.on('test:event', (data) => results.push(`listener1: ${data}`));
        eventBus.on('test:event', (data) => results.push(`listener2: ${data}`));

        eventBus.emit('test:event', 'hello');

        expect(results).toEqual(['listener1: hello', 'listener2: hello']);
    });

    test('should pass multiple arguments to listeners', () => {
        let arg1, arg2, arg3;

        eventBus.on('test:event', (a, b, c) => {
            arg1 = a;
            arg2 = b;
            arg3 = c;
        });

        eventBus.emit('test:event', 'first', 'second', 'third');

        expect(arg1).toBe('first');
        expect(arg2).toBe('second');
        expect(arg3).toBe('third');
    });

    test('should not call listener if event not emitted', () => {
        let called = false;

        eventBus.on('test:event', () => {
            called = true;
        });

        eventBus.emit('other:event');

        expect(called).toBe(false);
    });
});

test.describe('EventBus - Listener Removal', () => {

    let eventBus;

    test.beforeEach(() => {
        eventBus = new EventBusImpl();
    });

    test('should remove listener with off()', () => {
        let count = 0;
        const listener = () => count++;

        eventBus.on('test:event', listener);
        eventBus.emit('test:event');
        expect(count).toBe(1);

        eventBus.off('test:event', listener);
        eventBus.emit('test:event');
        expect(count).toBe(1); // Not called again
    });

    test('should only remove specified listener', () => {
        let count1 = 0;
        let count2 = 0;
        const listener1 = () => count1++;
        const listener2 = () => count2++;

        eventBus.on('test:event', listener1);
        eventBus.on('test:event', listener2);

        eventBus.off('test:event', listener1);
        eventBus.emit('test:event');

        expect(count1).toBe(0);
        expect(count2).toBe(1);
    });

    test('should clear all listeners for an event', () => {
        let count1 = 0;
        let count2 = 0;

        eventBus.on('test:event', () => count1++);
        eventBus.on('test:event', () => count2++);

        eventBus.clearEvent('test:event');
        eventBus.emit('test:event');

        expect(count1).toBe(0);
        expect(count2).toBe(0);
    });

    test('should clear all listeners for all events', () => {
        let count1 = 0;
        let count2 = 0;

        eventBus.on('event1', () => count1++);
        eventBus.on('event2', () => count2++);

        eventBus.clearAll();
        eventBus.emit('event1');
        eventBus.emit('event2');

        expect(count1).toBe(0);
        expect(count2).toBe(0);
    });
});

test.describe('EventBus - One-Time Listeners', () => {

    let eventBus;

    test.beforeEach(() => {
        eventBus = new EventBusImpl();
    });

    test('should support once() for one-time listeners', () => {
        let count = 0;

        eventBus.once('test:event', () => count++);

        eventBus.emit('test:event');
        eventBus.emit('test:event');
        eventBus.emit('test:event');

        expect(count).toBe(1); // Only called once
    });

    test('should support multiple once listeners', () => {
        let count1 = 0;
        let count2 = 0;

        eventBus.once('test:event', () => count1++);
        eventBus.once('test:event', () => count2++);

        eventBus.emit('test:event');

        expect(count1).toBe(1);
        expect(count2).toBe(1);

        eventBus.emit('test:event');

        expect(count1).toBe(1); // Still 1
        expect(count2).toBe(1); // Still 1
    });

    test('should mix regular and once listeners', () => {
        let regularCount = 0;
        let onceCount = 0;

        eventBus.on('test:event', () => regularCount++);
        eventBus.once('test:event', () => onceCount++);

        eventBus.emit('test:event');
        eventBus.emit('test:event');

        expect(regularCount).toBe(2);
        expect(onceCount).toBe(1);
    });
});

test.describe('EventBus - Error Handling', () => {

    let eventBus;

    test.beforeEach(() => {
        eventBus = new EventBusImpl();
    });

    test('should continue executing listeners if one throws', () => {
        let count = 0;

        eventBus.on('test:event', () => {
            throw new Error('Handler error');
        });
        eventBus.on('test:event', () => count++);

        eventBus.emit('test:event');

        expect(count).toBe(1); // Second listener still executed
    });

    test('should not add non-function handlers', () => {
        eventBus.on('test:event', 'not a function');

        expect(eventBus.listenerCount('test:event')).toBe(0);
    });
});

test.describe('EventBus - Introspection', () => {

    let eventBus;

    test.beforeEach(() => {
        eventBus = new EventBusImpl();
    });

    test('should count listeners for an event', () => {
        eventBus.on('test:event', () => { });
        eventBus.on('test:event', () => { });
        eventBus.once('test:event', () => { });

        expect(eventBus.listenerCount('test:event')).toBe(3);
    });

    test('should return 0 for events with no listeners', () => {
        expect(eventBus.listenerCount('nonexistent:event')).toBe(0);
    });

    test('should list all registered event names', () => {
        eventBus.on('event1', () => { });
        eventBus.on('event2', () => { });
        eventBus.once('event3', () => { });

        const names = eventBus.eventNames();

        expect(names).toContain('event1');
        expect(names).toContain('event2');
        expect(names).toContain('event3');
        expect(names.length).toBe(3);
    });

    test('should return empty array when no events registered', () => {
        const names = eventBus.eventNames();
        expect(names).toEqual([]);
    });
});

test.describe('EventBus - Predefined Events', () => {

    test('should have standard event constants', () => {
        expect(EVENTS.APP_READY).toBe('app:ready');
        expect(EVENTS.CHARACTER_SELECTED).toBe('character:selected');
        expect(EVENTS.PAGE_CHANGED).toBe('page:changed');
        expect(EVENTS.STATE_CHANGED).toBe('state:changed');
    });

    test('should use predefined events', () => {
        const eventBus = new EventBusImpl();
        let received = false;

        eventBus.on(EVENTS.APP_READY, () => {
            received = true;
        });

        eventBus.emit(EVENTS.APP_READY);

        expect(received).toBe(true);
    });
});
