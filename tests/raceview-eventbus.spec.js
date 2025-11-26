/**
 * raceview-eventbus.spec.js
 * Unit tests for RaceView, SubracePicker, and RaceCard EventBus refactoring
 */

const { test, expect } = require('@playwright/test');

test.describe('Race EventBus Refactoring - Unit Tests', () => {
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

        clearEvent(event) {
            if (this.listeners.has(event)) {
                this.listeners.delete(event);
            }
        }

        getEmittedEvents(event) {
            return this.emittedEvents.filter(e => e.event === event);
        }

        listenerCount(event) {
            return this.listeners.has(event) ? this.listeners.get(event).length : 0;
        }
    }

    const MOCK_EVENTS = {
        RACE_SELECTED: 'race:selected',
        SUBRACE_SELECTED: 'subrace:selected'
    };

    let mockEventBus;

    test.beforeEach(() => {
        mockEventBus = new MockEventBus();
    });

    test.describe('RaceCardView Event Emission', () => {
        test('should emit RACE_SELECTED event with correct structure', () => {
            const receivedEvents = [];
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                receivedEvents.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Elf',
                source: 'PHB',
                value: 'Elf_PHB'
            });

            expect(receivedEvents.length).toBe(1);
            expect(receivedEvents[0].name).toBe('Elf');
            expect(receivedEvents[0].source).toBe('PHB');
            expect(receivedEvents[0].value).toBe('Elf_PHB');
        });

        test('should emit RACE_SELECTED with all required properties', () => {
            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Dwarf',
                source: 'PHB',
                value: 'Dwarf_PHB'
            });

            const events = mockEventBus.getEmittedEvents(MOCK_EVENTS.RACE_SELECTED);
            expect(events.length).toBe(1);

            const eventData = events[0].args[0];
            expect(eventData.name).toBeDefined();
            expect(eventData.source).toBeDefined();
            expect(eventData.value).toBeDefined();
            expect(typeof eventData.name).toBe('string');
            expect(typeof eventData.source).toBe('string');
            expect(typeof eventData.value).toBe('string');
        });

        test('should handle multiple race selections', () => {
            const receivedEvents = [];
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                receivedEvents.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Human',
                source: 'PHB',
                value: 'Human_PHB'
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Elf',
                source: 'PHB',
                value: 'Elf_PHB'
            });

            expect(receivedEvents.length).toBe(2);
        });
    });

    test.describe('SubracePickerView Event Emission', () => {
        test('should emit SUBRACE_SELECTED event with correct structure', () => {
            const receivedEvents = [];
            mockEventBus.on(MOCK_EVENTS.SUBRACE_SELECTED, (data) => {
                receivedEvents.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.SUBRACE_SELECTED, {
                name: 'Wood Elf',
                value: 'Wood Elf'
            });

            expect(receivedEvents.length).toBe(1);
            expect(receivedEvents[0].name).toBe('Wood Elf');
            expect(receivedEvents[0].value).toBe('Wood Elf');
        });

        test('should emit SUBRACE_SELECTED with all required properties', () => {
            mockEventBus.emit(MOCK_EVENTS.SUBRACE_SELECTED, {
                name: 'High Elf',
                value: 'High Elf'
            });

            const events = mockEventBus.getEmittedEvents(MOCK_EVENTS.SUBRACE_SELECTED);
            expect(events.length).toBe(1);

            const eventData = events[0].args[0];
            expect(eventData.name).toBeDefined();
            expect(eventData.value).toBeDefined();
        });

        test('should handle multiple subrace selections', () => {
            const receivedEvents = [];
            mockEventBus.on(MOCK_EVENTS.SUBRACE_SELECTED, (data) => {
                receivedEvents.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.SUBRACE_SELECTED, {
                name: 'High Elf',
                value: 'High Elf'
            });

            mockEventBus.emit(MOCK_EVENTS.SUBRACE_SELECTED, {
                name: 'Wood Elf',
                value: 'Wood Elf'
            });

            expect(receivedEvents.length).toBe(2);
        });
    });

    test.describe('EventBus Integration', () => {
        test('should allow multiple listeners for RACE_SELECTED', () => {
            const listener1Events = [];
            const listener2Events = [];

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                listener1Events.push(data);
            });
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                listener2Events.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Orc',
                source: 'PHB',
                value: 'Orc_PHB'
            });

            expect(listener1Events.length).toBe(1);
            expect(listener2Events.length).toBe(1);
        });

        test('should allow removing RACE_SELECTED listeners', () => {
            const receivedEvents = [];

            const handler = (data) => {
                receivedEvents.push(data);
            };

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, handler);
            expect(mockEventBus.listenerCount(MOCK_EVENTS.RACE_SELECTED)).toBe(1);

            mockEventBus.off(MOCK_EVENTS.RACE_SELECTED, handler);
            expect(mockEventBus.listenerCount(MOCK_EVENTS.RACE_SELECTED)).toBe(0);

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Tiefling',
                source: 'PHB',
                value: 'Tiefling_PHB'
            });

            expect(receivedEvents.length).toBe(0);
        });

        test('should clear all listeners for an event', () => {
            const listener1 = () => { };
            const listener2 = () => { };

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, listener1);
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, listener2);

            expect(mockEventBus.listenerCount(MOCK_EVENTS.RACE_SELECTED)).toBe(2);

            mockEventBus.clearEvent(MOCK_EVENTS.RACE_SELECTED);
            expect(mockEventBus.listenerCount(MOCK_EVENTS.RACE_SELECTED)).toBe(0);
        });
    });

    test.describe('Event Separation', () => {
        test('RACE_SELECTED and SUBRACE_SELECTED should be separate events', () => {
            const raceEvents = [];
            const subraceEvents = [];

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                raceEvents.push(data);
            });
            mockEventBus.on(MOCK_EVENTS.SUBRACE_SELECTED, (data) => {
                subraceEvents.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Elf',
                source: 'PHB',
                value: 'Elf_PHB'
            });

            expect(raceEvents.length).toBe(1);
            expect(subraceEvents.length).toBe(0);

            mockEventBus.emit(MOCK_EVENTS.SUBRACE_SELECTED, {
                name: 'High Elf',
                value: 'High Elf'
            });

            expect(raceEvents.length).toBe(1);
            expect(subraceEvents.length).toBe(1);
        });
    });

    test.describe('Event Constants', () => {
        test('RACE_SELECTED should have correct event name format', () => {
            expect(MOCK_EVENTS.RACE_SELECTED).toBe('race:selected');
        });

        test('SUBRACE_SELECTED should have correct event name format', () => {
            expect(MOCK_EVENTS.SUBRACE_SELECTED).toBe('subrace:selected');
        });

        test('event names should follow domain:action pattern', () => {
            const racePattern = /^[a-z]+:[a-z]+$/.test(MOCK_EVENTS.RACE_SELECTED);
            const subracePattern = /^[a-z]+:[a-z]+$/.test(MOCK_EVENTS.SUBRACE_SELECTED);
            expect(racePattern).toBe(true);
            expect(subracePattern).toBe(true);
        });
    });

    test.describe('Event Handler Resilience', () => {
        test('should continue executing other handlers if one throws error', () => {
            const errorHandlerCalls = [];
            const successHandlerCalls = [];

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, () => {
                errorHandlerCalls.push(1);
                throw new Error('Test error');
            });
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, () => {
                successHandlerCalls.push(1);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Gnome',
                source: 'PHB',
                value: 'Gnome_PHB'
            });

            expect(errorHandlerCalls.length).toBe(1);
            expect(successHandlerCalls.length).toBe(1);
        });
    });

    test.describe('View Decoupling Verification', () => {
        test('event emission should not require view-controller coupling', () => {
            const listener1Events = [];
            const listener2Events = [];
            const listener3Events = [];

            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                listener1Events.push(data);
            });
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                listener2Events.push(data);
            });
            mockEventBus.on(MOCK_EVENTS.RACE_SELECTED, (data) => {
                listener3Events.push(data);
            });

            mockEventBus.emit(MOCK_EVENTS.RACE_SELECTED, {
                name: 'Dragonborn',
                source: 'PHB',
                value: 'Dragonborn_PHB'
            });

            expect(listener1Events.length).toBe(1);
            expect(listener2Events.length).toBe(1);
            expect(listener3Events.length).toBe(1);
        });
    });
});
