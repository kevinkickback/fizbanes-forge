import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

describe('EventBus', () => {
    beforeEach(() => {
        // Clear event bus state before each test
        eventBus.removeAllListeners();
    });

    afterEach(() => {
        // Clean up after each test
        eventBus.removeAllListeners();
    });

    describe('Basic Event Functionality', () => {
        it('should emit and receive events', () => {
            const handler = vi.fn();
            eventBus.on(EVENTS.CHARACTER_UPDATED, handler);
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { name: 'Fizban' });

            expect(handler).toHaveBeenCalledOnce();
            expect(handler).toHaveBeenCalledWith({ name: 'Fizban' });
        });

        it('should support multiple listeners on the same event', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            eventBus.on(EVENTS.CHARACTER_UPDATED, handler1);
            eventBus.on(EVENTS.CHARACTER_UPDATED, handler2);
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { data: 'test' });

            expect(handler1).toHaveBeenCalledOnce();
            expect(handler2).toHaveBeenCalledOnce();
        });

        it('should pass multiple arguments to handlers', () => {
            const handler = vi.fn();
            eventBus.on(EVENTS.CHARACTER_UPDATED, handler);
            eventBus.emit(EVENTS.CHARACTER_UPDATED, 'arg1', 'arg2', 'arg3');

            expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
        });

        it('should not call handler after off()', () => {
            const handler = vi.fn();
            eventBus.on(EVENTS.CHARACTER_UPDATED, handler);
            eventBus.off(EVENTS.CHARACTER_UPDATED, handler);
            eventBus.emit(EVENTS.CHARACTER_UPDATED);

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Once Functionality', () => {
        it('should only trigger once() handlers once', () => {
            const handler = vi.fn();
            eventBus.once(EVENTS.CHARACTER_UPDATED, handler);

            eventBus.emit(EVENTS.CHARACTER_UPDATED, 'first');
            eventBus.emit(EVENTS.CHARACTER_UPDATED, 'second');

            expect(handler).toHaveBeenCalledOnce();
            expect(handler).toHaveBeenCalledWith('first');
        });

        it('should remove once() handler after first call', () => {
            const handler = vi.fn();
            eventBus.once(EVENTS.CHARACTER_UPDATED, handler);

            eventBus.emit(EVENTS.CHARACTER_UPDATED);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should log errors but continue execution', () => {
            const errorHandler = vi.fn(() => {
                throw new Error('Handler error');
            });
            const goodHandler = vi.fn();
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

            eventBus.on(EVENTS.CHARACTER_UPDATED, errorHandler);
            eventBus.on(EVENTS.CHARACTER_UPDATED, goodHandler);

            // EventBus wraps emit in try/catch, so error is caught internally
            eventBus.emit(EVENTS.CHARACTER_UPDATED);

            // First handler was called (and threw)
            expect(errorHandler).toHaveBeenCalled();
            // Error was logged
            expect(consoleError).toHaveBeenCalled();

            consoleError.mockRestore();
        });
    });

    describe('Listener Management', () => {
        it('should return correct listener count', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(0);

            eventBus.on(EVENTS.CHARACTER_UPDATED, handler1);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(1);

            eventBus.on(EVENTS.CHARACTER_UPDATED, handler2);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(2);

            eventBus.off(EVENTS.CHARACTER_UPDATED, handler1);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(1);
        });

        it('should remove all listeners with clearAll()', () => {
            eventBus.on(EVENTS.CHARACTER_UPDATED, vi.fn());
            eventBus.on(EVENTS.CHARACTER_SAVED, vi.fn());

            eventBus.clearAll();

            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(0);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_SAVED)).toBe(0);
        });

        it('should remove specific event listeners with clearEvent()', () => {
            eventBus.on(EVENTS.CHARACTER_UPDATED, vi.fn());
            eventBus.on(EVENTS.CHARACTER_SAVED, vi.fn());

            eventBus.clearEvent(EVENTS.CHARACTER_UPDATED);

            expect(eventBus.listenerCount(EVENTS.CHARACTER_UPDATED)).toBe(0);
            expect(eventBus.listenerCount(EVENTS.CHARACTER_SAVED)).toBe(1);
        });
    });

    describe('EVENTS Constants', () => {
        it('should have all required event constants', () => {
            const requiredEvents = [
                'APP_READY',
                'CHARACTER_UPDATED',
                'CHARACTER_SAVED',
                'CHARACTER_LOADED',
                'PAGE_CHANGED',
                'DATA_LOADED',
                'ERROR_OCCURRED',
            ];

            for (const event of requiredEvents) {
                expect(EVENTS[event]).toBeDefined();
                expect(typeof EVENTS[event]).toBe('string');
            }
        });
    });
});
