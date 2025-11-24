import { test, expect } from '@playwright/test';
import { AppState } from '../../app/js/core/AppState.js';
import { eventBus, EVENTS } from '../../app/js/infrastructure/EventBus.js';

test.describe('AppState - Basic Operations', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should get entire state', () => {
        const state = AppState.getState();

        expect(state).toHaveProperty('currentCharacter');
        expect(state).toHaveProperty('currentPage');
        expect(state).toHaveProperty('isLoading');
    });

    test('should update state with setState', () => {
        AppState.setState({ currentPage: 'build' });

        expect(AppState.get('currentPage')).toBe('build');
    });

    test('should emit state changed event', () => {
        let eventEmitted = false;

        eventBus.once(EVENTS.STATE_CHANGED, () => {
            eventEmitted = true;
        });

        AppState.setState({ currentPage: 'equipment' });

        expect(eventEmitted).toBe(true);
    });

    test('should get nested state values', () => {
        AppState.setState({
            settings: { autoSave: false }
        });

        expect(AppState.get('settings.autoSave')).toBe(false);
    });

    test('should emit specific key change events', () => {
        let eventEmitted = false;
        let newValue = null;

        eventBus.once('state:currentPage:changed', (value) => {
            eventEmitted = true;
            newValue = value;
        });

        AppState.setState({ currentPage: 'spells' });

        expect(eventEmitted).toBe(true);
        expect(newValue).toBe('spells');
    });

    test('should not emit event if value unchanged', () => {
        AppState.setState({ currentPage: 'home' }); // Set to initial value

        let eventCount = 0;
        eventBus.on('state:currentPage:changed', () => {
            eventCount++;
        });

        AppState.setState({ currentPage: 'home' }); // Same value

        expect(eventCount).toBe(0);
    });
});

test.describe('AppState - Character Management', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should set and get current character', () => {
        const character = { id: '123', name: 'Test' };

        AppState.setCurrentCharacter(character);

        expect(AppState.getCurrentCharacter()).toEqual(character);
    });

    test('should emit character selected event', () => {
        let selectedCharacter = null;

        eventBus.once(EVENTS.CHARACTER_SELECTED, (char) => {
            selectedCharacter = char;
        });

        const character = { id: '123', name: 'Test' };
        AppState.setCurrentCharacter(character);

        expect(selectedCharacter).toEqual(character);
    });

    test('should track unsaved changes', () => {
        AppState.setHasUnsavedChanges(true);
        expect(AppState.get('hasUnsavedChanges')).toBe(true);

        AppState.setHasUnsavedChanges(false);
        expect(AppState.get('hasUnsavedChanges')).toBe(false);
    });

    test('should not emit event if unsaved changes unchanged', () => {
        AppState.setHasUnsavedChanges(false); // Set to false

        let eventCount = 0;
        eventBus.on(EVENTS.STATE_CHANGED, () => {
            eventCount++;
        });

        AppState.setHasUnsavedChanges(false); // Same value

        expect(eventCount).toBe(0);
    });

    test('should set and get characters list', () => {
        const characters = [
            { id: '1', name: 'Character 1' },
            { id: '2', name: 'Character 2' }
        ];

        AppState.setCharacters(characters);

        expect(AppState.getCharacters()).toEqual(characters);
        expect(AppState.getCharacters().length).toBe(2);
    });

    test('should clear current character', () => {
        const character = { id: '123', name: 'Test' };
        AppState.setCurrentCharacter(character);

        AppState.setCurrentCharacter(null);

        expect(AppState.getCurrentCharacter()).toBeNull();
    });
});

test.describe('AppState - Page Navigation', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should set and get current page', () => {
        AppState.setCurrentPage('equipment');
        expect(AppState.getCurrentPage()).toBe('equipment');
    });

    test('should emit page changed event', () => {
        let newPage = null;

        eventBus.once(EVENTS.PAGE_CHANGED, (page) => {
            newPage = page;
        });

        AppState.setCurrentPage('details');

        expect(newPage).toBe('details');
    });

    test('should track page transitions', () => {
        const pages = [];

        eventBus.on(EVENTS.PAGE_CHANGED, (page) => {
            pages.push(page);
        });

        AppState.setCurrentPage('build');
        AppState.setCurrentPage('equipment');
        AppState.setCurrentPage('spells');

        expect(pages).toEqual(['build', 'equipment', 'spells']);
    });
});

test.describe('AppState - Data Management', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should set and get loaded data', () => {
        const classes = [{ name: 'Fighter' }];

        AppState.setLoadedData('classes', classes);

        expect(AppState.getLoadedData('classes')).toEqual(classes);
    });

    test('should emit data loaded event', () => {
        let loadedType = null;
        let loadedData = null;

        eventBus.once(EVENTS.DATA_LOADED, (type, data) => {
            loadedType = type;
            loadedData = data;
        });

        const races = [{ name: 'Elf' }];
        AppState.setLoadedData('races', races);

        expect(loadedType).toBe('races');
        expect(loadedData).toEqual(races);
    });

    test('should store multiple data types', () => {
        const classes = [{ name: 'Fighter' }];
        const races = [{ name: 'Elf' }];
        const backgrounds = [{ name: 'Soldier' }];

        AppState.setLoadedData('classes', classes);
        AppState.setLoadedData('races', races);
        AppState.setLoadedData('backgrounds', backgrounds);

        expect(AppState.getLoadedData('classes')).toEqual(classes);
        expect(AppState.getLoadedData('races')).toEqual(races);
        expect(AppState.getLoadedData('backgrounds')).toEqual(backgrounds);
    });

    test('should return null for unloaded data', () => {
        expect(AppState.getLoadedData('nonexistent')).toBeUndefined();
    });
});

test.describe('AppState - Loading State', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should set loading state', () => {
        AppState.setLoading(true);
        expect(AppState.get('isLoading')).toBe(true);

        AppState.setLoading(false);
        expect(AppState.get('isLoading')).toBe(false);
    });

    test('should emit state change on loading', () => {
        let eventEmitted = false;

        eventBus.once(EVENTS.STATE_CHANGED, () => {
            eventEmitted = true;
        });

        AppState.setLoading(true);

        expect(eventEmitted).toBe(true);
    });
});

test.describe('AppState - State Reset', () => {

    test.beforeEach(() => {
        AppState.clear();
        eventBus.clearAll();
    });

    test('should clear all state', () => {
        // Set some state
        AppState.setCurrentCharacter({ id: '123', name: 'Test' });
        AppState.setCurrentPage('equipment');
        AppState.setLoading(true);

        // Clear state
        AppState.clear();

        // Verify state is reset
        expect(AppState.getCurrentCharacter()).toBeNull();
        expect(AppState.getCurrentPage()).toBe('home');
        expect(AppState.get('isLoading')).toBe(false);
    });

    test('should emit state changed event on clear', () => {
        let eventEmitted = false;

        eventBus.once(EVENTS.STATE_CHANGED, () => {
            eventEmitted = true;
        });

        AppState.clear();

        expect(eventEmitted).toBe(true);
    });
});
