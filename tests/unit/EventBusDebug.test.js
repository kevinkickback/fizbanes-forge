import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBusImpl } from '../../src/lib/EventBus.js';

describe('EventBus Debug Mode', () => {
    let testBus;

    beforeEach(() => {
        // Create a fresh instance for each test
        testBus = new EventBusImpl();
        testBus.enableDebugMode();
    });

    describe('History Tracking', () => {
        it('should record events when debug mode is enabled', () => {
            testBus.emit('test:event', 'arg1', 'arg2');

            const history = testBus.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].event).toBe('test:event');
            expect(history[0].listenerCount).toBe(0);
        });

        it('should not record events when debug mode is disabled', () => {
            testBus.disableDebugMode();
            testBus.emit('test:event');

            const history = testBus.getHistory();
            expect(history).toHaveLength(0);
        });

        it('should filter history by event name', () => {
            testBus.emit('event:one');
            testBus.emit('event:two');
            testBus.emit('event:one');

            const filtered = testBus.getHistory('event:one');
            expect(filtered).toHaveLength(2);
            expect(filtered.every(h => h.event === 'event:one')).toBe(true);
        });

        it('should limit history size to maxHistorySize', () => {
            testBus._maxHistorySize = 5;

            for (let i = 0; i < 10; i++) {
                testBus.emit('test:event', i);
            }

            const history = testBus.getHistory();
            expect(history).toHaveLength(5);
            // Should keep the most recent events (5-9)
            // Numbers are primitives, so they're stored directly
            expect(history[0].args[0]).toBe(5);
            expect(history[4].args[0]).toBe(9);
        });

        it('should serialize event arguments safely', () => {
            const complexObject = {
                nested: { data: 'test' },
                array: [1, 2, 3]
            };

            testBus.emit('test:event', 'string', 123, complexObject);

            const history = testBus.getHistory();
            expect(history[0].args).toHaveLength(3);
            expect(history[0].args[0]).toBe('string');
            expect(history[0].args[1]).toBe(123);
            expect(history[0].args[2].type).toBe('Object');
        });

        it('should include timestamp in history records', () => {
            const before = Date.now();
            testBus.emit('test:event');
            const after = Date.now();

            const history = testBus.getHistory();
            expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
            expect(history[0].timestamp).toBeLessThanOrEqual(after);
        });

        it('should clear history', () => {
            testBus.emit('test:event');
            expect(testBus.getHistory()).toHaveLength(1);

            testBus.clearHistory();
            expect(testBus.getHistory()).toHaveLength(0);
        });
    });

    describe('Performance Metrics', () => {
        it('should record performance metrics', () => {
            const handler = vi.fn();
            testBus.on('test:event', handler);

            testBus.emit('test:event');
            testBus.emit('test:event');

            const metrics = testBus.getMetrics('test:event');
            expect(metrics).toBeDefined();
            expect(metrics.count).toBe(2);
            expect(metrics.totalDuration).toBeGreaterThan(0);
            expect(metrics.maxDuration).toBeGreaterThan(0);
            expect(metrics.minDuration).toBeGreaterThan(0);
        });

        it('should track min and max durations', () => {
            const fastHandler = vi.fn();
            const slowHandler = vi.fn(() => {
                // Simulate slow operation
                const start = Date.now();
                while (Date.now() - start < 5) { }
            });

            testBus.on('fast:event', fastHandler);
            testBus.on('slow:event', slowHandler);

            testBus.emit('fast:event');
            testBus.emit('slow:event');

            const fastMetrics = testBus.getMetrics('fast:event');
            const slowMetrics = testBus.getMetrics('slow:event');

            expect(slowMetrics.totalDuration).toBeGreaterThan(fastMetrics.totalDuration);
        });

        it('should return null for non-existent event metrics', () => {
            const metrics = testBus.getMetrics('nonexistent:event');
            expect(metrics).toBeNull();
        });

        it('should return all metrics when no event name provided', () => {
            testBus.emit('event:one');
            testBus.emit('event:two');

            const allMetrics = testBus.getMetrics();
            expect(Object.keys(allMetrics)).toContain('event:one');
            expect(Object.keys(allMetrics)).toContain('event:two');
        });

        it('should clear metrics', () => {
            testBus.emit('test:event');
            expect(testBus.getMetrics('test:event')).toBeDefined();

            testBus.clearMetrics();
            expect(testBus.getMetrics('test:event')).toBeNull();
        });
    });

    describe('Listener Leak Detection', () => {
        it('should warn when listener count exceeds threshold', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            // Add more than 10 listeners
            for (let i = 0; i < 12; i++) {
                testBus.on('test:event', () => { });
            }

            expect(warnSpy).toHaveBeenCalledWith(
                '[EventBus]',
                'Possible listener leak detected',
                expect.objectContaining({
                    event: 'test:event',
                    listenerCount: expect.any(Number),
                })
            );

            warnSpy.mockRestore();
        });

        it('should not warn for different events', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            // Add listeners to different events
            for (let i = 0; i < 5; i++) {
                testBus.on(`event:${i}`, () => { });
            }

            expect(warnSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('Debug Mode Toggle', () => {
        it('should enable debug mode', () => {
            testBus.disableDebugMode();
            expect(testBus.isDebugMode()).toBe(false);

            testBus.enableDebugMode();
            expect(testBus.isDebugMode()).toBe(true);
        });

        it('should disable debug mode and clear data', () => {
            testBus.emit('test:event');
            expect(testBus.getHistory()).not.toHaveLength(0);

            testBus.disableDebugMode();
            expect(testBus.isDebugMode()).toBe(false);
            expect(testBus.getHistory()).toHaveLength(0);
        });

        it('should respect FF_DEBUG from window global', () => {
            // Note: This tests the constructor behavior
            const originalDebug = window.FF_DEBUG;

            window.FF_DEBUG = true;
            const debugBus = new EventBusImpl();
            expect(debugBus.isDebugMode()).toBe(true);

            window.FF_DEBUG = false;
            const normalBus = new EventBusImpl();
            expect(normalBus.isDebugMode()).toBe(false);

            // Restore
            window.FF_DEBUG = originalDebug;
        });
    });

    describe('Argument Serialization', () => {
        it('should handle null and undefined', () => {
            testBus.emit('test:event', null, undefined);

            const history = testBus.getHistory();
            expect(history[0].args[0]).toBeNull();
            expect(history[0].args[1]).toBeUndefined();
        });

        it('should handle primitive types', () => {
            testBus.emit('test:event', 'string', 123, true);

            const history = testBus.getHistory();
            expect(history[0].args[0]).toBe('string');
            expect(history[0].args[1]).toBe(123);
            expect(history[0].args[2]).toBe(true);
        });

        it('should only store first 3 arguments', () => {
            testBus.emit('test:event', 1, 2, 3, 4, 5);

            const history = testBus.getHistory();
            expect(history[0].args).toHaveLength(3);
        });

        it('should handle unserializable objects gracefully', () => {
            const circular = {};
            circular.self = circular;

            // Should not throw
            expect(() => {
                testBus._serializeArgs([circular]);
            }).not.toThrow();
        });
    });
});
