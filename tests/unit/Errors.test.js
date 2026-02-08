import { describe, expect, it } from 'vitest';
import {
    AppError,
    CharacterStateError,
    DataError,
    NotFoundError,
    SerializationError,
    ServiceError,
    ValidationError,
} from '../../src/lib/Errors.js';

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create error with message and details', () => {
            const error = new AppError('Test error', { key: 'value' });

            expect(error.message).toBe('Test error');
            expect(error.name).toBe('AppError');
            expect(error.details).toEqual({ key: 'value' });
            expect(error.timestamp).toBeDefined();
        });

        it('should have a stack trace', () => {
            const error = new AppError('Test error');

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('Test error');
        });

        it('should serialize to JSON', () => {
            const error = new AppError('Test error', { key: 'value' });
            const json = error.toJSON();

            expect(json.name).toBe('AppError');
            expect(json.message).toBe('Test error');
            expect(json.details).toEqual({ key: 'value' });
            expect(json.timestamp).toBeDefined();
            expect(json.stack).toBeDefined();
        });

        it('should work without details', () => {
            const error = new AppError('Test error');

            expect(error.details).toEqual({});
        });

        it('should be instance of Error', () => {
            const error = new AppError('Test error');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
        });
    });

    describe('ValidationError', () => {
        it('should extend AppError', () => {
            const error = new ValidationError('Invalid input');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.name).toBe('ValidationError');
        });

        it('should store validation details', () => {
            const error = new ValidationError('Invalid input', {
                field: 'name',
                value: '',
                reason: 'Required field',
            });

            expect(error.details.field).toBe('name');
            expect(error.details.reason).toBe('Required field');
        });
    });

    describe('NotFoundError', () => {
        it('should format message with resource and identifier', () => {
            const error = new NotFoundError('Race', 'Elf (PHB)');

            expect(error.message).toBe('Race not found: Elf (PHB)');
            expect(error.name).toBe('NotFoundError');
        });

        it('should store resource and identifier in details', () => {
            const error = new NotFoundError('Spell', 'Fireball', { source: 'PHB' });

            expect(error.details.resource).toBe('Spell');
            expect(error.details.identifier).toBe('Fireball');
            expect(error.details.source).toBe('PHB');
        });

        it('should extend AppError', () => {
            const error = new NotFoundError('Class', 'Wizard');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(NotFoundError);
        });
    });

    describe('ServiceError', () => {
        it('should format message with service name', () => {
            const error = new ServiceError('RaceService', 'Failed to initialize');

            expect(error.message).toBe('RaceService: Failed to initialize');
            expect(error.name).toBe('ServiceError');
        });

        it('should store service name in details', () => {
            const error = new ServiceError('ClassService', 'Data load failed', {
                reason: 'Network error',
            });

            expect(error.details.serviceName).toBe('ClassService');
            expect(error.details.reason).toBe('Network error');
        });

        it('should extend AppError', () => {
            const error = new ServiceError('SpellService', 'Error');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ServiceError);
        });
    });

    describe('DataError', () => {
        it('should create data error', () => {
            const error = new DataError('Invalid JSON format', {
                file: 'races.json',
                line: 42,
            });

            expect(error.message).toBe('Invalid JSON format');
            expect(error.name).toBe('DataError');
            expect(error.details.file).toBe('races.json');
        });

        it('should extend AppError', () => {
            const error = new DataError('Parse error');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(DataError);
        });
    });

    describe('CharacterStateError', () => {
        it('should create character state error', () => {
            const error = new CharacterStateError('Cannot level down from level 1', {
                currentLevel: 1,
                action: 'levelDown',
            });

            expect(error.message).toBe('Cannot level down from level 1');
            expect(error.name).toBe('CharacterStateError');
            expect(error.details.currentLevel).toBe(1);
        });

        it('should extend AppError', () => {
            const error = new CharacterStateError('Invalid state');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(CharacterStateError);
        });
    });

    describe('SerializationError', () => {
        it('should create serialization error', () => {
            const error = new SerializationError('Failed to serialize character', {
                characterId: '123',
                phase: 'JSON.stringify',
            });

            expect(error.message).toBe('Failed to serialize character');
            expect(error.name).toBe('SerializationError');
            expect(error.details.characterId).toBe('123');
        });

        it('should extend AppError', () => {
            const error = new SerializationError('Serialize error');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(SerializationError);
        });
    });

    describe('Error Catching', () => {
        it('should be catchable with try-catch', () => {
            try {
                throw new ValidationError('Test error');
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);
                expect(error.message).toBe('Test error');
            }
        });

        it('should preserve error type through async calls', async () => {
            const asyncFunction = async () => {
                throw new NotFoundError('Resource', 'ID');
            };

            await expect(asyncFunction()).rejects.toThrow(NotFoundError);
        });

        it('should allow instanceof checks', () => {
            const error = new ServiceError('Service', 'Error');

            if (error instanceof ServiceError) {
                expect(error.details.serviceName).toBe('Service');
            } else {
                throw new Error('instanceof check failed');
            }
        });
    });
});
