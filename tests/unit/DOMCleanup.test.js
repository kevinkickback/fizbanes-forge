import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMCleanup } from '../../src/lib/DOMCleanup.js';

describe('DOMCleanup', () => {
    let cleanup;
    let mockElement;

    beforeEach(() => {
        cleanup = DOMCleanup.create();
        mockElement = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
    });

    describe('Event Listener Management', () => {
        it('should add and track event listeners', () => {
            const handler = vi.fn();
            cleanup.on(mockElement, 'click', handler);

            expect(mockElement.addEventListener).toHaveBeenCalledWith(
                'click',
                handler,
                false,
            );
        });

        it('should add event listener with options', () => {
            const handler = vi.fn();
            const options = { capture: true, passive: true };
            cleanup.on(mockElement, 'scroll', handler, options);

            expect(mockElement.addEventListener).toHaveBeenCalledWith(
                'scroll',
                handler,
                options,
            );
        });

        it('should remove specific event listener', () => {
            const handler = vi.fn();
            cleanup.on(mockElement, 'click', handler);
            cleanup.off(mockElement, 'click', handler);

            expect(mockElement.removeEventListener).toHaveBeenCalledWith(
                'click',
                handler,
                false,
            );
        });

        it('should remove all event listeners on cleanup', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            cleanup.on(mockElement, 'click', handler1);
            cleanup.on(mockElement, 'mouseover', handler2);

            cleanup.cleanup();

            expect(mockElement.removeEventListener).toHaveBeenCalledWith(
                'click',
                handler1,
                false,
            );
            expect(mockElement.removeEventListener).toHaveBeenCalledWith(
                'mouseover',
                handler2,
                false,
            );
        });

        it('should handle once() event listeners', () => {
            const handler = vi.fn();
            cleanup.once(mockElement, 'click', handler);

            expect(mockElement.addEventListener).toHaveBeenCalled();
        });

        it('should not error when removing non-existent listener', () => {
            expect(() => {
                cleanup.off(mockElement, 'click', vi.fn());
            }).not.toThrow();
        });

        it('should validate arguments to on()', () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { });

            cleanup.on(null, 'click', vi.fn());
            expect(consoleWarn).toHaveBeenCalled();

            cleanup.on(mockElement, null, vi.fn());
            expect(consoleWarn).toHaveBeenCalled();

            cleanup.on(mockElement, 'click', null);
            expect(consoleWarn).toHaveBeenCalled();

            consoleWarn.mockRestore();
        });
    });

    describe('Timer Management', () => {
        it('should track and clear setTimeout', () => {
            vi.useFakeTimers();
            const callback = vi.fn();
            const id = cleanup.setTimeout(callback, 1000);

            expect(callback).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1000);
            expect(callback).toHaveBeenCalledOnce();

            vi.useRealTimers();
        });

        it('should track and clear setInterval', () => {
            vi.useFakeTimers();
            const callback = vi.fn();
            const id = cleanup.setInterval(callback, 100);

            vi.advanceTimersByTime(300);
            expect(callback).toHaveBeenCalledTimes(3);

            vi.useRealTimers();
        });

        it('should clear all timers on cleanup', () => {
            vi.useFakeTimers();
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            cleanup.setTimeout(callback1, 1000);
            cleanup.setInterval(callback2, 100);

            cleanup.cleanup();

            vi.advanceTimersByTime(2000);
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();

            vi.useRealTimers();
        });
    });

    describe('Static Factory Method', () => {
        it('should create new instance via static create()', () => {
            const instance = DOMCleanup.create();
            expect(instance).toBeInstanceOf(DOMCleanup);
        });

        it('should create independent instances', () => {
            const instance1 = DOMCleanup.create();
            const instance2 = DOMCleanup.create();

            expect(instance1).not.toBe(instance2);
        });
    });

    describe('Cleanup Behavior', () => {
        it('should allow multiple cleanup() calls safely', () => {
            const handler = vi.fn();
            cleanup.on(mockElement, 'click', handler);

            expect(() => {
                cleanup.cleanup();
                cleanup.cleanup();
            }).not.toThrow();
        });

        it('should clear internal state after cleanup', () => {
            const handler = vi.fn();
            cleanup.on(mockElement, 'click', handler);

            cleanup.cleanup();

            // Should not try to remove listener again
            mockElement.removeEventListener.mockClear();
            cleanup.cleanup();

            expect(mockElement.removeEventListener).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle cleanup with no tracked resources', () => {
            expect(() => {
                cleanup.cleanup();
            }).not.toThrow();
        });

        it('should handle offAll() on element with no listeners', () => {
            expect(() => {
                cleanup.offAll(mockElement);
            }).not.toThrow();
        });

        it('should handle null/undefined element in off()', () => {
            expect(() => {
                cleanup.off(null, 'click');
                cleanup.off(undefined, 'click');
            }).not.toThrow();
        });
    });
});
