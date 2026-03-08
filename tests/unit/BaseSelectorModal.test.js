import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BaseSelectorModal,
    formatCategoryCounters,
    formatCounter,
} from '../../src/ui/components/selection/BaseSelectorModal.js';

// Mock DOMCleanup
vi.mock('../../src/lib/DOMCleanup.js', () => ({
    DOMCleanup: {
        create: () => ({
            on: vi.fn((el, event, handler) => {
                el.addEventListener(event, handler);
            }),
            once: vi.fn(),
            cleanup: vi.fn(),
            registerBootstrapModal: vi.fn(),
        }),
    },
}));

// Mock ModalCleanupUtility
vi.mock('../../src/lib/ModalCleanupUtility.js', () => ({
    disposeBootstrapModal: vi.fn(),
    hideBootstrapModal: vi.fn().mockResolvedValue(undefined),
    initializeBootstrapModal: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
    })),
}));

// Mock Notifications
vi.mock('../../src/lib/Notifications.js', () => ({
    showNotification: vi.fn(),
}));

const { showNotification } = await import('../../src/lib/Notifications.js');

function makeItems(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
    }));
}

function defaultRenderItem(item) {
    return `<div data-item-id="${item.id}">${item.name}</div>`;
}

describe('BaseSelectorModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('constructor', () => {
        it('should create with default config', () => {
            const modal = new BaseSelectorModal();
            expect(modal.config.modalTitle).toBe('Select Items');
            expect(modal.config.selectionMode).toBe('multiple');
            expect(modal.config.pageSize).toBe(50);
            expect(modal.config.allowClose).toBe(true);
            expect(modal.config.selectionLimit).toBeNull();
        });

        it('should merge custom config', () => {
            const modal = new BaseSelectorModal({
                modalTitle: 'Pick Spells',
                selectionMode: 'single',
                pageSize: 10,
            });
            expect(modal.config.modalTitle).toBe('Pick Spells');
            expect(modal.config.selectionMode).toBe('single');
            expect(modal.config.pageSize).toBe(10);
        });

        it('should initialize empty state', () => {
            const modal = new BaseSelectorModal();
            expect(modal.state.items).toEqual([]);
            expect(modal.state.filtered).toEqual([]);
            expect(modal.state.selectedIds.size).toBe(0);
            expect(modal.state.selectedItems).toEqual([]);
            expect(modal.state.searchTerm).toBe('');
            expect(modal.state.page).toBe(0);
        });
    });

    describe('_getModalHTML', () => {
        it('should include modal title', () => {
            const modal = new BaseSelectorModal({ modalTitle: 'Test Title' });
            const html = modal._getModalHTML();
            expect(html).toContain('Test Title');
        });

        it('should include prerequisite note when configured', () => {
            const modal = new BaseSelectorModal({
                prerequisiteNote: 'Must be level 3',
            });
            const html = modal._getModalHTML();
            expect(html).toContain('Must be level 3');
        });

        it('should not include filter toggle without buildFilters', () => {
            const modal = new BaseSelectorModal();
            const html = modal._getModalHTML();
            expect(html).not.toContain('spell-filter-toggle-btn');
        });

        it('should include filter toggle with buildFilters', () => {
            const modal = new BaseSelectorModal({
                buildFilters: vi.fn(),
            });
            const html = modal._getModalHTML();
            expect(html).toContain('spell-filter-toggle-btn');
        });
    });

    describe('_matches', () => {
        it('should match all items when no search term', () => {
            const modal = new BaseSelectorModal();
            modal.state.searchTerm = '';
            expect(modal._matches({ name: 'Fireball' })).toBe(true);
        });

        it('should filter by default name matching', () => {
            const modal = new BaseSelectorModal();
            modal.state.searchTerm = 'fire';
            expect(modal._matches({ name: 'Fireball' })).toBe(true);
            expect(modal._matches({ name: 'Ice Storm' })).toBe(false);
        });

        it('should use custom searchMatcher when provided', () => {
            const modal = new BaseSelectorModal({
                searchMatcher: (item, term) => item.school === term,
            });
            modal.state.searchTerm = 'evocation';
            expect(
                modal._matches({ name: 'Fireball', school: 'evocation' }),
            ).toBe(true);
            expect(
                modal._matches({ name: 'Shield', school: 'abjuration' }),
            ).toBe(false);
        });

        it('should apply matchItem filter in addition to search', () => {
            const modal = new BaseSelectorModal({
                matchItem: (item) => item.level <= 3,
            });
            modal.state.searchTerm = '';
            expect(modal._matches({ name: 'Fireball', level: 3 })).toBe(true);
            expect(modal._matches({ name: 'Wish', level: 9 })).toBe(false);
        });
    });

    describe('_toggleSelection — single mode', () => {
        it('should select one item in single mode', () => {
            const modal = new BaseSelectorModal({ selectionMode: 'single' });
            modal.state.items = makeItems(3);
            // Create a modal element so _toggleSelection can querySelector
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            expect(modal.state.selectedIds.has('item-0')).toBe(true);
            expect(modal.state.selectedItems).toHaveLength(1);
        });

        it('should replace previous selection in single mode', () => {
            const modal = new BaseSelectorModal({ selectionMode: 'single' });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            modal._toggleSelection('item-1');

            expect(modal.state.selectedIds.has('item-0')).toBe(false);
            expect(modal.state.selectedIds.has('item-1')).toBe(true);
            expect(modal.state.selectedItems).toHaveLength(1);
            expect(modal.state.selectedItems[0].id).toBe('item-1');
        });

        it('should deselect when toggling same item in single mode', () => {
            const modal = new BaseSelectorModal({ selectionMode: 'single' });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            modal._toggleSelection('item-0');

            expect(modal.state.selectedIds.size).toBe(0);
            expect(modal.state.selectedItems).toHaveLength(0);
        });
    });

    describe('_toggleSelection — multiple mode', () => {
        it('should add multiple items in multiple mode', () => {
            const modal = new BaseSelectorModal({ selectionMode: 'multiple' });
            modal.state.items = makeItems(5);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            modal._toggleSelection('item-2');

            expect(modal.state.selectedIds.size).toBe(2);
            expect(modal.state.selectedItems).toHaveLength(2);
        });

        it('should deselect on second toggle in multiple mode', () => {
            const modal = new BaseSelectorModal({ selectionMode: 'multiple' });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            modal._toggleSelection('item-0');

            expect(modal.state.selectedIds.size).toBe(0);
            expect(modal.state.selectedItems).toHaveLength(0);
        });

        it('should enforce selectionLimit', () => {
            const modal = new BaseSelectorModal({
                selectionMode: 'multiple',
                selectionLimit: 2,
            });
            modal.state.items = makeItems(5);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            modal._toggleSelection('item-1');
            modal._toggleSelection('item-2'); // Should be blocked

            expect(modal.state.selectedIds.size).toBe(2);
            expect(showNotification).toHaveBeenCalledWith(
                'You can only select 2 item(s).',
                'warning',
            );
        });

        it('should fire onSelectionChange callback', () => {
            const onChange = vi.fn();
            const modal = new BaseSelectorModal({
                selectionMode: 'multiple',
                onSelectionChange: onChange,
            });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].selectedIds).toBeInstanceOf(Set);
        });
    });

    describe('_primeSelection', () => {
        it('should set initial selected items from objects', () => {
            const modal = new BaseSelectorModal();
            modal.state.items = makeItems(5);

            modal._primeSelection([{ id: 'item-1' }, { id: 'item-3' }]);

            expect(modal.state.selectedIds.size).toBe(2);
            expect(modal.state.selectedIds.has('item-1')).toBe(true);
            expect(modal.state.selectedIds.has('item-3')).toBe(true);
        });

        it('should set initial selected items from string IDs', () => {
            const modal = new BaseSelectorModal();
            modal.state.items = makeItems(5);

            modal._primeSelection(['item-0', 'item-4']);

            expect(modal.state.selectedIds.size).toBe(2);
            expect(modal.state.selectedIds.has('item-0')).toBe(true);
            expect(modal.state.selectedIds.has('item-4')).toBe(true);
        });

        it('should handle empty initial selection', () => {
            const modal = new BaseSelectorModal();
            modal.state.items = makeItems(3);

            modal._primeSelection([]);
            expect(modal.state.selectedIds.size).toBe(0);
        });
    });

    describe('_renderList — pagination', () => {
        it('should render only pageSize items per page', () => {
            const modal = new BaseSelectorModal({
                pageSize: 3,
                renderItem: defaultRenderItem,
            });
            modal.state.items = makeItems(10);
            modal.state.page = 0;

            // Create modal DOM
            const div = document.createElement('div');
            div.innerHTML = '<div class="spell-list-container"></div>';
            modal.modal = div;

            modal._renderList();

            const container = div.querySelector('.spell-list-container');
            const items = container.querySelectorAll('[data-item-id]');
            expect(items.length).toBe(3);
        });

        it('should show Load More button when more items exist', () => {
            const modal = new BaseSelectorModal({
                pageSize: 3,
                renderItem: defaultRenderItem,
            });
            modal.state.items = makeItems(10);
            modal.state.page = 0;

            const div = document.createElement('div');
            div.innerHTML = '<div class="spell-list-container"></div>';
            modal.modal = div;

            modal._renderList();

            const loadMore = div.querySelector('[data-load-more]');
            expect(loadMore).not.toBeNull();
            expect(loadMore.textContent).toContain('7 remaining');
        });

        it('should not show Load More when all items fit on page', () => {
            const modal = new BaseSelectorModal({
                pageSize: 50,
                renderItem: defaultRenderItem,
            });
            modal.state.items = makeItems(5);
            modal.state.page = 0;

            const div = document.createElement('div');
            div.innerHTML = '<div class="spell-list-container"></div>';
            modal.modal = div;

            modal._renderList();

            const loadMore = div.querySelector('[data-load-more]');
            expect(loadMore).toBeNull();
        });
    });

    describe('_renderList — search filtering', () => {
        it('should filter items by search term and show no results message', () => {
            const modal = new BaseSelectorModal({
                pageSize: 50,
                renderItem: defaultRenderItem,
            });
            modal.state.items = [
                { id: '1', name: 'Fireball' },
                { id: '2', name: 'Ice Storm' },
                { id: '3', name: 'Fire Shield' },
            ];
            modal.state.searchTerm = 'xyz';

            const div = document.createElement('div');
            div.innerHTML = '<div class="spell-list-container"></div>';
            modal.modal = div;

            modal._renderList();

            const container = div.querySelector('.spell-list-container');
            expect(container.textContent).toContain('No results match your filters');
        });

        it('should filter items and render matching ones', () => {
            const modal = new BaseSelectorModal({
                pageSize: 50,
                renderItem: defaultRenderItem,
            });
            modal.state.items = [
                { id: '1', name: 'Fireball' },
                { id: '2', name: 'Ice Storm' },
                { id: '3', name: 'Fire Shield' },
            ];
            modal.state.searchTerm = 'fire';

            const div = document.createElement('div');
            div.innerHTML = '<div class="spell-list-container"></div>';
            modal.modal = div;

            modal._renderList();

            const items = div.querySelectorAll('[data-item-id]');
            expect(items.length).toBe(2);
        });
    });

    describe('_renderSelected', () => {
        it('should show no selections message when empty', () => {
            const modal = new BaseSelectorModal();
            modal.state.selectedItems = [];

            const div = document.createElement('div');
            div.innerHTML =
                '<div class="selected-spells-container"></div>';
            modal.modal = div;

            modal._renderSelected();

            const container = div.querySelector('.selected-spells-container');
            expect(container.textContent).toContain('No selections');
        });

        it('should render selected items as badges', () => {
            const modal = new BaseSelectorModal();
            modal.state.selectedItems = [
                { id: 'sp1', name: 'Fireball' },
                { id: 'sp2', name: 'Shield' },
            ];
            modal.state.selectedIds = new Set(['sp1', 'sp2']);

            const div = document.createElement('div');
            div.innerHTML =
                '<div class="selected-spells-container"></div>';
            modal.modal = div;

            modal._renderSelected();

            const badges = div.querySelectorAll('.badge');
            expect(badges.length).toBe(2);
            expect(badges[0].textContent).toContain('Fireball');
            expect(badges[1].textContent).toContain('Shield');
        });
    });

    describe('_getItemId', () => {
        it('should use item.id by default', () => {
            const modal = new BaseSelectorModal();
            expect(modal._getItemId({ id: 'abc' })).toBe('abc');
        });

        it('should use custom getItemId when configured', () => {
            const modal = new BaseSelectorModal({
                getItemId: (item) => item.uid,
            });
            expect(modal._getItemId({ uid: 'custom-123' })).toBe('custom-123');
        });
    });

    describe('_onHidden', () => {
        it('should reset state and cleanup', () => {
            const modal = new BaseSelectorModal();
            modal.state.items = makeItems(5);
            modal.state.selectedIds = new Set(['item-0']);
            modal.state.selectedItems = [{ id: 'item-0', name: 'Item 0' }];
            modal.state.searchTerm = 'test';

            modal._onHidden();

            expect(modal.state.items).toEqual([]);
            expect(modal.state.selectedIds.size).toBe(0);
            expect(modal.state.selectedItems).toEqual([]);
            expect(modal.state.searchTerm).toBe('');
            expect(modal.state.page).toBe(0);
            expect(modal._cleanup.cleanup).toHaveBeenCalled();
        });

        it('should resolve pending promise with null', () => {
            const modal = new BaseSelectorModal();
            const resolve = vi.fn();
            modal._resolvePromise = resolve;

            modal._onHidden();

            expect(resolve).toHaveBeenCalledWith(null);
            expect(modal._resolvePromise).toBeNull();
        });
    });

    describe('canSelectItem', () => {
        it('should block selection when canSelectItem returns false', () => {
            const modal = new BaseSelectorModal({
                selectionMode: 'multiple',
                canSelectItem: (item) => item.id !== 'item-1',
            });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-1');
            expect(modal.state.selectedIds.size).toBe(0);
            expect(showNotification).toHaveBeenCalledWith(
                'Selection limit reached for this category.',
                'warning',
            );
        });

        it('should call onSelectBlocked instead of default notification', () => {
            const onBlocked = vi.fn();
            const modal = new BaseSelectorModal({
                selectionMode: 'multiple',
                canSelectItem: () => false,
                onSelectBlocked: onBlocked,
            });
            modal.state.items = makeItems(3);
            modal.modal = document.createElement('div');

            modal._toggleSelection('item-0');
            expect(onBlocked).toHaveBeenCalled();
            expect(showNotification).not.toHaveBeenCalled();
        });
    });

    describe('formatCategoryCounters', () => {
        it('should render fallback for empty categories', () => {
            expect(formatCategoryCounters([])).toContain('0 / ∞');
        });

        it('should render badges for categories', () => {
            const html = formatCategoryCounters([
                { selected: 3, max: 5, label: 'Spells', color: 'bg-primary' },
                { selected: 1, max: 2, label: 'Cantrips', color: 'bg-info' },
            ]);
            expect(html).toContain('3/5 Spells');
            expect(html).toContain('1/2 Cantrips');
            expect(html).toContain('bg-primary');
        });

        it('should display infinity symbol for unlimited max', () => {
            const html = formatCategoryCounters([
                { selected: 2, max: Infinity, label: 'Items' },
            ]);
            expect(html).toContain('2/∞ Items');
        });
    });

    describe('formatCounter', () => {
        it('should render a single badge', () => {
            const html = formatCounter({
                selected: 4,
                max: 10,
                label: 'Skills',
                color: 'bg-success',
            });
            expect(html).toContain('4/10 Skills');
            expect(html).toContain('bg-success');
        });
    });
});
