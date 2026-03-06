import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMCleanup } from '../../src/lib/DOMCleanup.js';
import { PortraitSelector } from '../../src/ui/components/shared/PortraitSelector.js';

describe('PortraitSelector', () => {
    let grid;
    let preview;
    let uploadInput;
    let cleanup;
    let onSelect;
    let selector;

    beforeEach(() => {
        grid = document.createElement('div');
        preview = document.createElement('img');
        uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        cleanup = DOMCleanup.create();
        onSelect = vi.fn();
        selector = new PortraitSelector({ grid, preview, uploadInput, cleanup, onSelect });

        window.characterStorage = {
            getDefaultSavePath: vi.fn().mockResolvedValue('/mock/saves/characters/save.json'),
            listPortraits: vi.fn().mockResolvedValue({ success: true, files: [] }),
            savePortrait: vi.fn(),
        };
    });

    afterEach(() => {
        cleanup.cleanup();
        delete window.characterStorage;
    });

    describe('DEFAULTS', () => {
        it('should define 11 default portrait paths', () => {
            expect(PortraitSelector.DEFAULTS).toHaveLength(11);
        });

        it('should start with placeholder_char_card.jpg as first default', () => {
            expect(PortraitSelector.DEFAULTS[0]).toBe(
                'assets/images/characters/placeholder_char_card.jpg',
            );
        });
    });

    describe('initialize()', () => {
        it('should populate grid with upload button and default portrait buttons', async () => {
            await selector.initialize(null);
            const buttons = grid.querySelectorAll('button');
            // 1 upload + 11 defaults
            expect(buttons).toHaveLength(12);
        });

        it('should place upload button first in the grid', async () => {
            await selector.initialize(null);
            const firstBtn = grid.querySelector('button');
            expect(firstBtn.classList.contains('upload')).toBe(true);
        });

        it('should assign data-src attributes to portrait buttons', async () => {
            await selector.initialize(null);
            const portraitBtns = grid.querySelectorAll('.portrait-icon-btn:not(.upload)');
            portraitBtns.forEach((btn, i) => {
                expect(btn.getAttribute('data-src')).toBe(PortraitSelector.DEFAULTS[i]);
            });
        });

        it('should auto-click first portrait button when currentPortrait is null', async () => {
            await selector.initialize(null);
            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(onSelect).toHaveBeenCalledWith(PortraitSelector.DEFAULTS[0]);
        });

        it('should set preview src when currentPortrait is provided', async () => {
            const target = PortraitSelector.DEFAULTS[2];
            await selector.initialize(target);
            expect(preview.src).toContain('placeholder_char_card3.jpg');
        });

        it('should mark matching button as selected when currentPortrait is provided', async () => {
            const target = PortraitSelector.DEFAULTS[2];
            await selector.initialize(target);
            const matchingBtn = grid.querySelector(`[data-src="${target}"]`);
            expect(matchingBtn.classList.contains('selected')).toBe(true);
        });

        it('should not call onSelect when currentPortrait matches a default', async () => {
            await selector.initialize(PortraitSelector.DEFAULTS[3]);
            expect(onSelect).not.toHaveBeenCalled();
        });

        it('should call listPortraits during initialization', async () => {
            await selector.initialize(null);
            expect(window.characterStorage.listPortraits).toHaveBeenCalled();
        });

        it('should append buttons for user portraits returned by listPortraits', async () => {
            window.characterStorage.listPortraits.mockResolvedValue({
                success: true,
                files: ['/mock/portraits/custom1.jpg', '/mock/portraits/custom2.jpg'],
            });
            await selector.initialize(null);
            const allPortraitBtns = grid.querySelectorAll('.portrait-icon-btn:not(.upload)');
            // 11 defaults + 2 user
            expect(allPortraitBtns).toHaveLength(13);
        });

        it('should prefix user portrait paths with file:// protocol', async () => {
            window.characterStorage.listPortraits.mockResolvedValue({
                success: true,
                files: ['/mock/portraits/custom.jpg'],
            });
            await selector.initialize(null);
            const userBtn = grid.querySelectorAll('.portrait-icon-btn:not(.upload)')[11];
            expect(userBtn.getAttribute('data-src')).toBe('file:///mock/portraits/custom.jpg');
        });

        it('should not duplicate file:// prefix for already-prefixed paths', async () => {
            window.characterStorage.listPortraits.mockResolvedValue({
                success: true,
                files: ['file:///mock/portraits/custom.jpg'],
            });
            await selector.initialize(null);
            const userBtn = grid.querySelectorAll('.portrait-icon-btn:not(.upload)')[11];
            expect(userBtn.getAttribute('data-src')).toBe('file:///mock/portraits/custom.jpg');
        });

        it('should handle listPortraits failure gracefully', async () => {
            window.characterStorage.listPortraits.mockRejectedValue(new Error('IPC error'));
            await expect(selector.initialize(null)).resolves.not.toThrow();
        });

        it('should clear grid before populating', async () => {
            grid.innerHTML = '<div class="stale">old</div>';
            await selector.initialize(null);
            expect(grid.querySelector('.stale')).toBeNull();
        });
    });

    describe('portrait button click', () => {
        it('should update preview src when a portrait button is clicked', async () => {
            await selector.initialize(null);
            onSelect.mockClear();
            const secondBtn = grid.querySelectorAll('.portrait-icon-btn:not(.upload)')[1];
            secondBtn.click();
            expect(preview.src).toContain(PortraitSelector.DEFAULTS[1]);
        });

        it('should call onSelect with the clicked portrait src', async () => {
            await selector.initialize(null);
            onSelect.mockClear();
            const thirdBtn = grid.querySelectorAll('.portrait-icon-btn:not(.upload)')[2];
            thirdBtn.click();
            expect(onSelect).toHaveBeenCalledWith(PortraitSelector.DEFAULTS[2]);
        });

        it('should mark only the clicked button as selected', async () => {
            await selector.initialize(null);
            const btns = grid.querySelectorAll('.portrait-icon-btn:not(.upload)');
            btns[0].click();
            btns[1].click();
            const selected = grid.querySelectorAll('.portrait-icon-btn.selected');
            expect(selected).toHaveLength(1);
            expect(selected[0]).toBe(btns[1]);
        });

        it('should remove selected class from all other buttons on click', async () => {
            await selector.initialize(null);
            const btns = grid.querySelectorAll('.portrait-icon-btn:not(.upload)');
            btns[0].click();
            expect(btns[0].classList.contains('selected')).toBe(true);
            btns[4].click();
            expect(btns[0].classList.contains('selected')).toBe(false);
            expect(btns[4].classList.contains('selected')).toBe(true);
        });
    });

    describe('upload button', () => {
        it('should trigger file input click when upload button is clicked', async () => {
            const clickSpy = vi.spyOn(uploadInput, 'click');
            await selector.initialize(null);
            const uploadBtn = grid.querySelector('.portrait-icon-btn.upload');
            uploadBtn.click();
            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should remove portrait button click listeners after cleanup', async () => {
            await selector.initialize(null);
            onSelect.mockClear();
            cleanup.cleanup();
            const firstPortraitBtn = grid.querySelector('.portrait-icon-btn:not(.upload)');
            firstPortraitBtn.click();
            expect(onSelect).not.toHaveBeenCalled();
        });

        it('should remove upload button listener after cleanup', async () => {
            const clickSpy = vi.spyOn(uploadInput, 'click');
            await selector.initialize(null);
            cleanup.cleanup();
            const uploadBtn = grid.querySelector('.portrait-icon-btn.upload');
            uploadBtn.click();
            expect(clickSpy).not.toHaveBeenCalled();
        });
    });
});
