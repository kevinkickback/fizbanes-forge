import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        access: vi.fn(),
        stat: vi.fn(),
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'new-uuid-1234'),
}));

vi.mock('../../src/lib/CharacterSchema.js', () => ({
    CharacterSchema: {
        validate: vi.fn(),
    },
}));

import fs from 'node:fs/promises';
import { CharacterSchema } from '../../src/lib/CharacterSchema.js';
import { CharacterImportService } from '../../src/services/CharacterImportService.js';

describe('CharacterImportService', () => {
    let service;
    const savePath = '/test/saves';

    beforeEach(() => {
        vi.clearAllMocks();
        fs.readFile.mockImplementation(() => { });
        fs.access.mockImplementation(() => { });
        fs.stat.mockImplementation(() => { });
        CharacterSchema.validate.mockReturnValue({ valid: true, errors: [] });
        service = new CharacterImportService(savePath);
    });

    describe('readCharacterFile', () => {
        it('should reject non-ffp files', async () => {
            const result = await service.readCharacterFile('char.json');
            expect(result.error).toContain('.ffp');
        });

        it('should read and parse valid ffp file', async () => {
            const charData = { id: '123', name: 'Gandalf' };
            fs.readFile.mockResolvedValue(JSON.stringify(charData));

            const result = await service.readCharacterFile('char.ffp');
            expect(result.character).toEqual(charData);
        });

        it('should return error for invalid JSON', async () => {
            fs.readFile.mockResolvedValue('not valid json{{{');

            const result = await service.readCharacterFile('char.ffp');
            expect(result.error).toContain('valid JSON');
        });

        it('should return error for filesystem failures', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT'));

            const result = await service.readCharacterFile('char.ffp');
            expect(result.error).toContain('Failed to read file');
        });
    });

    describe('validateCharacter', () => {
        it('should return valid when schema passes', async () => {
            CharacterSchema.validate.mockReturnValue({ valid: true, errors: [] });
            const result = await service.validateCharacter({ id: '1', name: 'Test' });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return errors when schema fails', async () => {
            CharacterSchema.validate.mockReturnValue({
                valid: false,
                errors: ['Missing name'],
            });
            const result = await service.validateCharacter({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing name');
        });
    });

    describe('checkForConflict', () => {
        it('should return exists false when no conflict', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));

            const result = await service.checkForConflict('char-123');
            expect(result.exists).toBe(false);
        });

        it('should return existing character when conflict found', async () => {
            const existing = { id: 'char-123', name: 'Existing' };
            fs.access.mockResolvedValue(undefined);
            fs.readFile.mockResolvedValue(JSON.stringify(existing));
            fs.stat.mockResolvedValue({
                birthtime: new Date('2024-01-01T00:00:00Z'),
            });

            const result = await service.checkForConflict('char-123');
            expect(result.exists).toBe(true);
            expect(result.existing).toEqual(existing);
            expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
        });
    });

    describe('processConflictResolution', () => {
        it('should return canceled when action is cancel', () => {
            const result = service.processConflictResolution({}, 'cancel');
            expect(result.canceled).toBe(true);
        });

        it('should assign new ID when action is keepBoth', () => {
            const character = { id: 'old-id', name: 'Test' };
            const result = service.processConflictResolution(character, 'keepBoth');
            expect(result.character.id).toBe('new-uuid-1234');
        });

        it('should return character unchanged for replace action', () => {
            const character = { id: 'original', name: 'Test' };
            const result = service.processConflictResolution(character, 'replace');
            expect(result.character.id).toBe('original');
        });
    });

    describe('importCharacter', () => {
        it('should return read error on invalid file', async () => {
            const result = await service.importCharacter('char.json');
            expect(result.step).toBe('read');
            expect(result.success).toBe(false);
        });

        it('should return validation error for invalid data', async () => {
            fs.readFile.mockResolvedValue(JSON.stringify({ id: '1' }));
            CharacterSchema.validate.mockReturnValue({
                valid: false,
                errors: ['Missing name'],
            });

            const result = await service.importCharacter('char.ffp');
            expect(result.step).toBe('validate');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing name');
        });

        it('should return conflict when character exists', async () => {
            const charData = { id: 'char-123', name: 'Test' };
            fs.readFile.mockResolvedValue(JSON.stringify(charData));
            CharacterSchema.validate.mockReturnValue({ valid: true, errors: [] });
            fs.access.mockResolvedValue(undefined);
            fs.stat.mockResolvedValue({
                birthtime: new Date('2024-01-01T00:00:00Z'),
            });

            const result = await service.importCharacter('char.ffp');
            expect(result.step).toBe('conflict');
            expect(result.success).toBe(false);
            expect(result.existing).toEqual(charData);
        });

        it('should return ready when no conflict', async () => {
            const charData = { id: 'char-123', name: 'Test' };
            fs.readFile.mockResolvedValue(JSON.stringify(charData));
            CharacterSchema.validate.mockReturnValue({ valid: true, errors: [] });
            fs.access.mockRejectedValue(new Error('ENOENT'));

            const result = await service.importCharacter('char.ffp');
            expect(result.step).toBe('ready');
            expect(result.success).toBe(true);
            expect(result.character).toEqual(charData);
        });
    });
});
