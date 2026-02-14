import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { actionService } from '../../src/services/ActionService.js';

describe('ActionService', () => {
    const mockActions = [
        { name: 'Attack', source: 'PHB', entries: ['Make a melee or ranged attack...'] },
        { name: 'Dash', source: 'PHB', entries: ['You gain extra movement...'] },
        { name: 'Dodge', source: 'PHB', entries: ['Until the start of your next turn...'] },
        { name: 'Help', source: 'PHB', entries: ['You lend your aid...'] },
        { name: 'Hide', source: 'PHB', entries: ['Make a Dexterity (Stealth) check...'] },
    ];

    beforeEach(async () => {
        actionService._data = null;
        actionService._initPromise = null;
        actionService._actionMap = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue({
            action: mockActions,
        });

        await actionService.initialize();
    });

    describe('initialize', () => {
        it('should load actions and build lookup map', () => {
            expect(actionService.isInitialized()).toBe(true);
            expect(actionService._actionMap).toBeInstanceOf(Map);
            expect(actionService._actionMap.size).toBe(5);
        });

        it('should handle empty action data gracefully', async () => {
            actionService._data = null;
            actionService._initPromise = null;
            actionService._actionMap = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockRejectedValue(
                new Error('Network error'),
            );

            await actionService.initialize();

            expect(actionService._actionMap).toBeInstanceOf(Map);
            expect(actionService._actionMap.size).toBe(0);
        });
    });

    describe('getAllActions', () => {
        it('should return all actions', () => {
            const actions = actionService.getAllActions();
            expect(actions).toHaveLength(5);
        });

        it('should return empty array when data is null', () => {
            actionService._data = null;
            expect(actionService.getAllActions()).toEqual([]);
        });
    });

    describe('getAction', () => {
        it('should find action by name', () => {
            const action = actionService.getAction('Attack');
            expect(action.name).toBe('Attack');
        });

        it('should find action case-insensitively', () => {
            const action = actionService.getAction('attack');
            expect(action.name).toBe('Attack');
        });

        it('should throw NotFoundError for non-existent action', () => {
            expect(() => actionService.getAction('Fly')).toThrow(NotFoundError);
        });

        it('should throw NotFoundError when action map is not initialized', () => {
            actionService._actionMap = null;
            expect(() => actionService.getAction('Attack')).toThrow(
                NotFoundError,
            );
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => actionService.getAction('')).toThrow();
        });
    });
});
