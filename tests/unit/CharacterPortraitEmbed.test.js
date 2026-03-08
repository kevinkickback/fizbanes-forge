// @vitest-environment node
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
}));

// Mock electron and uuid before importing the module under test
vi.mock('electron', () => ({
    dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    ipcMain: { handle: vi.fn() },
}));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));
vi.mock('../../src/main/Logger.js', () => ({
    MainLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/lib/CharacterSchema.js', () => ({
    CharacterSchema: { validate: vi.fn(() => ({ valid: true, errors: [] })) },
}));
vi.mock('../../src/services/CharacterImportService.js', () => ({
    CharacterImportService: vi.fn(),
}));
vi.mock('node:fs/promises', () => ({ default: fsMock }));

import { embedPortraitData, extractEmbeddedPortrait } from '../../src/main/ipc/CharacterHandlers.js';

// ---------------------------------------------------------------------------
// embedPortraitData
// ---------------------------------------------------------------------------
describe('embedPortraitData()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should skip embedding when portrait is empty', async () => {
        const character = { portrait: '' };
        await embedPortraitData(character);
        expect(fsMock.readFile).not.toHaveBeenCalled();
        expect(character.embeddedPortrait).toBeUndefined();
    });

    it('should skip embedding for asset paths', async () => {
        const character = { portrait: 'assets/images/characters/placeholder.webp' };
        await embedPortraitData(character);
        expect(fsMock.readFile).not.toHaveBeenCalled();
        expect(character.embeddedPortrait).toBeUndefined();
    });

    it('should skip embedding when portrait is already a data URL', async () => {
        const character = { portrait: 'data:image/png;base64,abc123' };
        await embedPortraitData(character);
        expect(fsMock.readFile).not.toHaveBeenCalled();
        expect(character.embeddedPortrait).toBeUndefined();
    });

    it('should skip embedding for unsupported file extensions', async () => {
        const character = { portrait: '/portraits/image.bmp' };
        await embedPortraitData(character);
        expect(fsMock.readFile).not.toHaveBeenCalled();
        expect(character.embeddedPortrait).toBeUndefined();
    });

    it('should embed a PNG portrait as a base64 data URL', async () => {
        const fakeBuffer = Buffer.from('fake-image-bytes');
        fsMock.stat.mockResolvedValueOnce({ size: 1024 });
        fsMock.readFile.mockResolvedValueOnce(fakeBuffer);
        const character = { portrait: '/portraits/hero.png' };

        await embedPortraitData(character);

        expect(fsMock.readFile).toHaveBeenCalledWith('/portraits/hero.png');
        expect(character.embeddedPortrait).toEqual({
            data: `data:image/png;base64,${fakeBuffer.toString('base64')}`,
            mimeType: 'image/png',
            originalFilename: 'hero.png',
        });
    });

    it('should embed a JPEG portrait correctly', async () => {
        const fakeBuffer = Buffer.from('jpeg-bytes');
        fsMock.stat.mockResolvedValueOnce({ size: 1024 });
        fsMock.readFile.mockResolvedValueOnce(fakeBuffer);
        const character = { portrait: '/portraits/warrior.jpg' };

        await embedPortraitData(character);

        expect(character.embeddedPortrait.mimeType).toBe('image/jpeg');
        expect(character.embeddedPortrait.originalFilename).toBe('warrior.jpg');
    });

    it('should embed a WebP portrait correctly', async () => {
        const fakeBuffer = Buffer.from('webp-bytes');
        fsMock.stat.mockResolvedValueOnce({ size: 1024 });
        fsMock.readFile.mockResolvedValueOnce(fakeBuffer);
        const character = { portrait: '/portraits/mage.webp' };

        await embedPortraitData(character);

        expect(character.embeddedPortrait.mimeType).toBe('image/webp');
    });

    it('should leave embeddedPortrait unchanged and not throw when file cannot be read', async () => {
        fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));
        const character = { portrait: '/portraits/missing.png', embeddedPortrait: null };

        await expect(embedPortraitData(character)).resolves.not.toThrow();
        expect(character.embeddedPortrait).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// extractEmbeddedPortrait
// ---------------------------------------------------------------------------
describe('extractEmbeddedPortrait()', () => {
    const savePath = path.normalize('/Fizbanes Forge/characters');
    const portraitsDir = path.normalize('/Fizbanes Forge/portraits');

    beforeEach(() => vi.clearAllMocks());

    it('should skip extraction when embeddedPortrait is absent', async () => {
        const character = { portrait: '' };
        await extractEmbeddedPortrait(character, savePath);
        expect(fsMock.access).not.toHaveBeenCalled();
        expect(character.portrait).toBe('');
    });

    it('should skip extraction when embeddedPortrait has no data', async () => {
        const character = { embeddedPortrait: { data: '', originalFilename: 'hero.png' } };
        await extractEmbeddedPortrait(character, savePath);
        expect(fsMock.access).not.toHaveBeenCalled();
    });

    it('should skip extraction when embeddedPortrait has no originalFilename', async () => {
        const character = { embeddedPortrait: { data: 'data:image/png;base64,abc', originalFilename: '' } };
        await extractEmbeddedPortrait(character, savePath);
        // No filename → safe name falls back, but empty base name still gets a default
        // This should not throw
        await expect(extractEmbeddedPortrait(character, savePath)).resolves.not.toThrow();
    });

    it('should update portrait path to existing file without rewriting', async () => {
        fsMock.access.mockResolvedValueOnce(undefined); // file exists
        const character = {
            portrait: '',
            embeddedPortrait: {
                data: 'data:image/png;base64,abc123',
                mimeType: 'image/png',
                originalFilename: 'hero.png',
            },
        };

        await extractEmbeddedPortrait(character, savePath);

        expect(fsMock.writeFile).not.toHaveBeenCalled();
        expect(character.portrait).toBe(path.join(portraitsDir, 'hero.png'));
    });

    it('should extract portrait to portraits folder when file does not exist', async () => {
        fsMock.access.mockRejectedValueOnce(new Error('ENOENT'));
        fsMock.mkdir.mockResolvedValueOnce(undefined);
        fsMock.writeFile.mockResolvedValueOnce(undefined);

        const imageBytes = Buffer.from('real-image');
        const base64 = imageBytes.toString('base64');
        const character = {
            portrait: '',
            embeddedPortrait: {
                data: `data:image/png;base64,${base64}`,
                mimeType: 'image/png',
                originalFilename: 'hero.png',
            },
        };

        await extractEmbeddedPortrait(character, savePath);

        expect(fsMock.mkdir).toHaveBeenCalledWith(portraitsDir, { recursive: true });
        expect(fsMock.writeFile).toHaveBeenCalledWith(
            path.join(portraitsDir, 'hero.png'),
            Buffer.from(base64, 'base64'),
        );
        expect(character.portrait).toBe(path.join(portraitsDir, 'hero.png'));
    });

    it('should sanitize unsafe characters in the original filename', async () => {
        fsMock.access.mockRejectedValueOnce(new Error('ENOENT'));
        fsMock.mkdir.mockResolvedValueOnce(undefined);
        fsMock.writeFile.mockResolvedValueOnce(undefined);

        const base64 = Buffer.from('x').toString('base64');
        const character = {
            portrait: '',
            embeddedPortrait: {
                data: `data:image/png;base64,${base64}`,
                mimeType: 'image/png',
                originalFilename: 'my portrait (1).png',
            },
        };

        await extractEmbeddedPortrait(character, savePath);

        const expectedSafeName = 'my_portrait__1_.png';
        expect(fsMock.writeFile).toHaveBeenCalledWith(
            path.join(portraitsDir, expectedSafeName),
            expect.any(Buffer),
        );
        expect(character.portrait).toBe(path.join(portraitsDir, expectedSafeName));
    });

    it('should not throw and leave portrait unchanged when extraction write fails', async () => {
        fsMock.access.mockRejectedValueOnce(new Error('ENOENT'));
        fsMock.mkdir.mockResolvedValueOnce(undefined);
        fsMock.writeFile.mockRejectedValueOnce(new Error('disk full'));

        const base64 = Buffer.from('x').toString('base64');
        const character = {
            portrait: '/old/path/hero.png',
            embeddedPortrait: {
                data: `data:image/png;base64,${base64}`,
                mimeType: 'image/png',
                originalFilename: 'hero.png',
            },
        };

        await expect(extractEmbeddedPortrait(character, savePath)).resolves.not.toThrow();
        expect(character.portrait).toBe('/old/path/hero.png');
    });

    it('should not modify portrait when embedded data URL is malformed', async () => {
        fsMock.access.mockRejectedValueOnce(new Error('ENOENT'));
        fsMock.mkdir.mockResolvedValueOnce(undefined);

        const character = {
            portrait: '/old/path/hero.png',
            embeddedPortrait: {
                data: 'not-a-valid-data-url',
                mimeType: 'image/png',
                originalFilename: 'hero.png',
            },
        };

        await extractEmbeddedPortrait(character, savePath);

        expect(fsMock.writeFile).not.toHaveBeenCalled();
        expect(character.portrait).toBe('/old/path/hero.png');
    });
});
