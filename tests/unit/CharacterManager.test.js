import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '../../src/app/AppState.js';
import { Character } from '../../src/app/Character.js';
import { CharacterManager } from '../../src/app/CharacterManager.js';
import {
    DataError,
    NotFoundError,
    ServiceError,
    ValidationError,
} from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

describe('CharacterManager', () => {
    let mockCharacterStorage;

    beforeEach(() => {
        // Clear AppState
        AppState.setState({
            currentCharacter: null,
            characters: [],
            hasUnsavedChanges: false,
            isLoadingCharacter: false,
            failedServices: [],
        });

        // Mock window.characterStorage
        mockCharacterStorage = {
            generateUUID: vi.fn(),
            saveCharacter: vi.fn(),
            loadCharacters: vi.fn(),
            deleteCharacter: vi.fn(),
        };
        global.window = global.window || {};
        global.window.characterStorage = mockCharacterStorage;

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('createCharacter', () => {
        it('should create a new character', async () => {
            mockCharacterStorage.generateUUID.mockResolvedValue({
                success: true,
                data: 'test-uuid-123',
            });

            const character = await CharacterManager.createCharacter('Fizban');

            expect(character).toBeInstanceOf(Character);
            expect(character.name).toBe('Fizban');
            expect(character.id).toBe('test-uuid-123');
            expect(AppState.getCurrentCharacter()).toBe(character);
            expect(AppState.getState().hasUnsavedChanges).toBe(true);
        });

        it('should emit CHARACTER_CREATED event', async () => {
            mockCharacterStorage.generateUUID.mockResolvedValue({
                success: true,
                data: 'test-uuid-123',
            });

            const emitSpy = vi.spyOn(eventBus, 'emit');

            const character = await CharacterManager.createCharacter('Fizban');

            expect(emitSpy).toHaveBeenCalledWith(EVENTS.CHARACTER_CREATED, character);
        });

        it('should throw ServiceError if services failed', async () => {
            AppState.setState({ failedServices: ['RaceService', 'ClassService'] });

            await expect(CharacterManager.createCharacter('Fizban')).rejects.toThrow(
                ServiceError,
            );
        });

        it('should throw DataError if UUID generation fails', async () => {
            mockCharacterStorage.generateUUID.mockResolvedValue({
                success: false,
            });

            await expect(CharacterManager.createCharacter('Fizban')).rejects.toThrow(
                DataError,
            );
        });

        it('should handle empty name', async () => {
            mockCharacterStorage.generateUUID.mockResolvedValue({
                success: true,
                data: 'test-uuid-123',
            });

            // Empty name should throw ValidationError
            await expect(CharacterManager.createCharacter('')).rejects.toThrow(
                ValidationError,
            );
        });
    });

    describe('loadCharacter', () => {
        it('should load an existing character', async () => {
            // Provide complete valid character data
            const characterData = {
                id: 'char-123',
                name: 'Loaded Character',
                race: { name: 'Human', source: 'PHB', subrace: '', abilityChoices: [] },
                allowedSources: ['PHB'],
                abilityScores: {
                    strength: 10,
                    dexterity: 10,
                    constitution: 10,
                    intelligence: 10,
                    wisdom: 10,
                    charisma: 10,
                },
                proficiencies: {
                    armor: [],
                    weapons: [],
                    tools: [],
                    skills: [],
                    languages: [],
                    savingThrows: [],
                },
                hitPoints: {
                    current: 10,
                    max: 10,
                    temp: 0,
                },
            };

            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [characterData],
            });

            const character = await CharacterManager.loadCharacter('char-123');

            expect(character).toBeInstanceOf(Character);
            expect(character.id).toBe('char-123');
            expect(character.name).toBe('Loaded Character');
            expect(AppState.getCurrentCharacter()).toBe(character);
            expect(AppState.getState().hasUnsavedChanges).toBe(false);
        });

        it('should set loading state during load', async () => {
            const validChar = {
                id: 'char-123',
                name: 'Test',
                allowedSources: ['PHB'],
                abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                proficiencies: { armor: [], weapons: [], tools: [], skills: [], languages: [], savingThrows: [] },
                hitPoints: { current: 10, max: 10, temp: 0 },
            };

            mockCharacterStorage.loadCharacters.mockImplementation(() => {
                expect(AppState.getState().isLoadingCharacter).toBe(true);
                return Promise.resolve({
                    success: true,
                    characters: [validChar],
                });
            });

            await CharacterManager.loadCharacter('char-123');

            expect(AppState.getState().isLoadingCharacter).toBe(false);
        });

        it('should clear loading state on error', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: false,
            });

            await expect(CharacterManager.loadCharacter('char-123')).rejects.toThrow();

            expect(AppState.getState().isLoadingCharacter).toBe(false);
        });

        it('should throw NotFoundError if character does not exist', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [{ id: 'other-char', name: 'Other' }],
            });

            await expect(
                CharacterManager.loadCharacter('non-existent'),
            ).rejects.toThrow(NotFoundError);
        });

        it('should throw DataError if load fails', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: false,
            });

            await expect(CharacterManager.loadCharacter('char-123')).rejects.toThrow(
                DataError,
            );
        });

        it('should throw ValidationError if character data is invalid', async () => {
            // Create invalid character data (missing required fields)
            const invalidData = {
                id: 'char-123',
                // Missing required fields that CharacterSchema expects
            };

            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [invalidData],
            });

            // Should throw ValidationError for invalid data
            await expect(
                CharacterManager.loadCharacter('char-123'),
            ).rejects.toThrow(ValidationError);
        });

        it('should handle empty characters array', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [],
            });

            await expect(CharacterManager.loadCharacter('char-123')).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe('saveCharacter', () => {
        it('should save the current character', async () => {
            const character = new Character({ id: 'char-123', name: 'Save Test' });
            AppState.setCurrentCharacter(character);
            AppState.setHasUnsavedChanges(true);

            mockCharacterStorage.saveCharacter.mockResolvedValue({
                success: true,
            });

            const result = await CharacterManager.saveCharacter();

            expect(result).toBe(true);
            expect(mockCharacterStorage.saveCharacter).toHaveBeenCalled();
            expect(AppState.getState().hasUnsavedChanges).toBe(false);
        });

        it('should emit CHARACTER_SAVED event', async () => {
            const character = new Character({ id: 'char-123', name: 'Save Test' });
            AppState.setCurrentCharacter(character);

            mockCharacterStorage.saveCharacter.mockResolvedValue({
                success: true,
            });

            const emitSpy = vi.spyOn(eventBus, 'emit');

            await CharacterManager.saveCharacter();

            expect(emitSpy).toHaveBeenCalledWith(EVENTS.CHARACTER_SAVED, character);
        });

        it('should throw NotFoundError if no current character', async () => {
            AppState.setCurrentCharacter(null);

            await expect(CharacterManager.saveCharacter()).rejects.toThrow(
                NotFoundError,
            );
        });

        it('should throw DataError if save fails', async () => {
            const character = new Character({ id: 'char-123', name: 'Save Test' });
            AppState.setCurrentCharacter(character);

            mockCharacterStorage.saveCharacter.mockResolvedValue({
                success: false,
                error: 'Disk full',
            });

            await expect(CharacterManager.saveCharacter()).rejects.toThrow(DataError);
        });

        it('should update lastModified timestamp', async () => {
            const character = new Character({ id: 'char-123', name: 'Save Test' });
            const originalTimestamp = character.lastModified;
            AppState.setCurrentCharacter(character);

            // Wait a tiny bit to ensure timestamp changes
            await new Promise((resolve) => setTimeout(resolve, 10));

            mockCharacterStorage.saveCharacter.mockResolvedValue({
                success: true,
            });

            await CharacterManager.saveCharacter();

            expect(character.lastModified).not.toBe(originalTimestamp);
        });
    });

    describe('deleteCharacter', () => {
        it('should delete a character', async () => {
            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: true,
            });

            const result = await CharacterManager.deleteCharacter('char-123');

            expect(result).toBe(true);
            expect(mockCharacterStorage.deleteCharacter).toHaveBeenCalledWith(
                'char-123',
            );
        });

        it('should emit CHARACTER_DELETED event', async () => {
            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: true,
            });

            const emitSpy = vi.spyOn(eventBus, 'emit');

            await CharacterManager.deleteCharacter('char-123');

            expect(emitSpy).toHaveBeenCalledWith(EVENTS.CHARACTER_DELETED, 'char-123');
        });

        it('should remove character from state', async () => {
            const characters = [
                new Character({ id: 'char-1', name: 'Char 1' }),
                new Character({ id: 'char-2', name: 'Char 2' }),
            ];
            AppState.setCharacters(characters);

            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: true,
            });

            await CharacterManager.deleteCharacter('char-1');

            const remaining = AppState.getCharacters();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe('char-2');
        });

        it('should clear current character if deleted', async () => {
            const character = new Character({ id: 'char-123', name: 'Current' });
            AppState.setCurrentCharacter(character);

            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: true,
            });

            await CharacterManager.deleteCharacter('char-123');

            expect(AppState.getCurrentCharacter()).toBe(null);
            expect(AppState.getState().hasUnsavedChanges).toBe(false);
        });

        it('should not clear current character if different character deleted', async () => {
            const current = new Character({ id: 'char-123', name: 'Current' });
            AppState.setCurrentCharacter(current);

            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: true,
            });

            await CharacterManager.deleteCharacter('other-char');

            expect(AppState.getCurrentCharacter()).toBe(current);
        });

        it('should throw DataError if delete fails', async () => {
            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: false,
                error: 'File locked',
            });

            await expect(
                CharacterManager.deleteCharacter('char-123'),
            ).rejects.toThrow(DataError);
        });
    });

    describe('loadCharacterList', () => {
        it('should load list of characters', async () => {
            const charactersData = [
                { id: 'char-1', name: 'Character 1' },
                { id: 'char-2', name: 'Character 2' },
            ];

            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: charactersData,
            });

            const characters = await CharacterManager.loadCharacterList();

            expect(characters).toHaveLength(2);
            expect(characters[0]).toBeInstanceOf(Character);
            expect(characters[0].name).toBe('Character 1');
            expect(characters[1].name).toBe('Character 2');
        });

        it('should update AppState with characters', async () => {
            const charactersData = [{ id: 'char-1', name: 'Character 1' }];

            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: charactersData,
            });

            await CharacterManager.loadCharacterList();

            const stateCharacters = AppState.getCharacters();
            expect(stateCharacters).toHaveLength(1);
        });

        it('should handle empty character list', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [],
            });

            const characters = await CharacterManager.loadCharacterList();

            expect(characters).toEqual([]);
        });

        it('should throw DataError if load fails', async () => {
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: false,
                error: 'Network error',
            });

            await expect(CharacterManager.loadCharacterList()).rejects.toThrow(
                DataError,
            );
        });
    });

    describe('updateCharacter', () => {
        it('should update current character', () => {
            const character = new Character({ id: 'char-123', name: 'Original' });
            AppState.setCurrentCharacter(character);

            const emitSpy = vi.spyOn(eventBus, 'emit');

            CharacterManager.updateCharacter({ name: 'Updated' });

            const updated = AppState.getCurrentCharacter();
            expect(updated.name).toBe('Updated');
            expect(AppState.getState().hasUnsavedChanges).toBe(true);
            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.CHARACTER_UPDATED,
                expect.any(Character),
            );
        });

        it('should preserve unchanged fields', () => {
            const character = new Character({
                id: 'char-123',
                name: 'Original',
                playerName: 'Player',
            });
            AppState.setCurrentCharacter(character);

            CharacterManager.updateCharacter({ name: 'Updated' });

            const updated = AppState.getCurrentCharacter();
            expect(updated.name).toBe('Updated');
            expect(updated.playerName).toBe('Player');
        });

        it('should handle no current character gracefully', () => {
            AppState.setCurrentCharacter(null);

            // Should not throw
            expect(() =>
                CharacterManager.updateCharacter({ name: 'Updated' }),
            ).not.toThrow();
        });

        it('should update multiple fields', () => {
            const character = new Character({ id: 'char-123', name: 'Original' });
            AppState.setCurrentCharacter(character);

            CharacterManager.updateCharacter({
                name: 'New Name',
                playerName: 'New Player',
            });

            const updated = AppState.getCurrentCharacter();
            expect(updated.name).toBe('New Name');
            expect(updated.playerName).toBe('New Player');
        });
    });

    describe('getCurrentCharacter', () => {
        it('should return current character', () => {
            const character = new Character({ id: 'char-123', name: 'Test' });
            AppState.setCurrentCharacter(character);

            const result = CharacterManager.getCurrentCharacter();

            expect(result).toBe(character);
        });

        it('should return null if no current character', () => {
            AppState.setCurrentCharacter(null);

            const result = CharacterManager.getCurrentCharacter();

            expect(result).toBe(null);
        });
    });

    describe('Error Handling', () => {
        it('should throw appropriate error types', async () => {
            // ServiceError
            AppState.setState({ failedServices: ['TestService'] });
            await expect(CharacterManager.createCharacter('Test')).rejects.toThrow(
                ServiceError,
            );

            // NotFoundError
            AppState.setState({ failedServices: [] });
            AppState.setCurrentCharacter(null);
            await expect(CharacterManager.saveCharacter()).rejects.toThrow(
                NotFoundError,
            );

            // DataError
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: false,
            });
            await expect(CharacterManager.loadCharacter('id')).rejects.toThrow(
                DataError,
            );
        });

        it('should include error details', async () => {
            mockCharacterStorage.deleteCharacter.mockResolvedValue({
                success: false,
                error: 'Custom error message',
            });

            try {
                await CharacterManager.deleteCharacter('char-123');
            } catch (error) {
                expect(error).toBeInstanceOf(DataError);
                expect(error.message).toContain('Custom error message');
            }
        });
    });

    describe('Integration', () => {
        it('should handle complete create-save-load cycle', async () => {
            // Create
            mockCharacterStorage.generateUUID.mockResolvedValue({
                success: true,
                data: 'char-123',
            });
            const created = await CharacterManager.createCharacter('Test Char');
            expect(created.id).toBe('char-123');

            // Save
            mockCharacterStorage.saveCharacter.mockResolvedValue({
                success: true,
            });
            await CharacterManager.saveCharacter();
            expect(AppState.getState().hasUnsavedChanges).toBe(false);

            // Load - provide full valid character data
            mockCharacterStorage.loadCharacters.mockResolvedValue({
                success: true,
                characters: [
                    {
                        id: 'char-123',
                        name: 'Test Char',
                        allowedSources: ['PHB'],
                        abilityScores: {
                            strength: 10,
                            dexterity: 10,
                            constitution: 10,
                            intelligence: 10,
                            wisdom: 10,
                            charisma: 10,
                        },
                        proficiencies: {
                            armor: [],
                            weapons: [],
                            tools: [],
                            skills: [],
                            languages: [],
                            savingThrows: [],
                        },
                        hitPoints: {
                            current: 10,
                            max: 10,
                            temp: 0,
                        },
                    },
                ],
            });
            const loaded = await CharacterManager.loadCharacter('char-123');
            expect(loaded.name).toBe('Test Char');
        });
    });
});
