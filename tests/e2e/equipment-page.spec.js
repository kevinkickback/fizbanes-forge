import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 9. Equipment Page
 * Verifies the equipment page renders, the item selector opens,
 * and items can be added/removed.
 */

async function launchAndWaitForHome() {
    const electronApp = await electron.launch({ args: ['.'] });

    let page = electronApp
        .windows()
        .find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await electronApp.waitForEvent(
            'window',
            (win) => !win.url().startsWith('devtools://'),
        );
    }

    await page.waitForSelector('#pageContent', { timeout: 60_000 });
    return { electronApp, page };
}

/** Click whichever "create character" button is visible (empty-state vs normal). */
async function clickCreateCharacterBtn(page) {
    const emptyStateBtn = page.locator('#welcomeCreateCharacterBtn');
    if (await emptyStateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await emptyStateBtn.click();
    } else {
        await page.locator('#newCharacterBtn').click();
    }
}

async function createCharacter(page, name) {
    await clickCreateCharacterBtn(page);
    await page.waitForSelector('#newCharacterModal.show', { timeout: 10_000 });

    await page.locator('#characterName').fill(name);
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const pointBuyRadio = page.locator('#pointBuy');
    if (!(await pointBuyRadio.isChecked())) {
        await pointBuyRadio.click();
    }
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="2"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const raceSelect = page.locator('#modalRaceSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalRaceSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await raceSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="3"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const classSelect = page.locator('#modalClassSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalClassSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await classSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="4"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const bgSelect = page.locator('#modalBackgroundSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalBackgroundSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await bgSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="5"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(page.locator('#newCharacterModal')).not.toBeVisible({
        timeout: 10_000,
    });
    await expect(page.locator('#titlebarCharacterName')).toHaveText(name, {
        timeout: 10_000,
    });
}

/** Delete a specific test character by name via the Home page. */
async function deleteCharacterByName(page, characterName) {
    await page.locator('button[data-page="home"]').click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'home',
        { timeout: 10_000 },
    );
    const card = page.locator('.character-card', {
        has: page.locator('.card-header h5', { hasText: characterName }),
    });
    const deleteBtn = card.locator('.delete-character');
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });
    }
}

async function navigateToEquipment(page) {
    const equipBtn = page.locator('button[data-page="equipment"]');
    await expect(equipBtn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await equipBtn.click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'equipment',
        { timeout: 10_000 },
    );
}

test.describe('Equipment Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Equipment Hero');
        await navigateToEquipment(page);
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'Equipment Hero');
            } finally {
                await electronApp.close();
            }
        }
    });

    test('9.1 — Equipment page renders for a character', async () => {
        // The inventory list container should exist
        const inventoryList = page.locator('#inventoryList');
        await expect(inventoryList).toBeAttached({ timeout: 10_000 });

        // The Add Item button should be visible
        const addItemBtn = page.locator('#addItemBtn');
        await expect(addItemBtn).toBeVisible({ timeout: 5_000 });

        // Weight display elements should be present
        const inventoryWeight = page.locator('#inventoryWeight');
        await expect(inventoryWeight).toBeAttached({ timeout: 5_000 });

        const weightCapacity = page.locator('#weightCapacity');
        await expect(weightCapacity).toBeAttached({ timeout: 5_000 });
    });

    test('9.2 — Item selector modal opens and lists items', async () => {
        const addItemBtn = page.locator('#addItemBtn');
        await addItemBtn.click();

        // The equipment selector modal uses a fixed ID
        const modal = page.locator('#universalEquipmentSelectionModal');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Modal should have a search input
        const searchInput = modal.locator('.spell-search-input');
        await expect(searchInput).toBeVisible({ timeout: 5_000 });

        // Should list item cards
        await page.waitForFunction(
            () => {
                const m = document.getElementById('universalEquipmentSelectionModal');
                if (!m) return false;
                return m.querySelectorAll('.item-card').length > 0;
            },
            { timeout: 15_000 },
        );

        const itemCards = modal.locator('.item-card');
        const count = await itemCards.count();
        expect(count).toBeGreaterThan(0);

        // Close the modal
        await modal.locator('.btn-cancel').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    test('9.3 — Adding an item updates inventory display', async () => {
        const addItemBtn = page.locator('#addItemBtn');
        await addItemBtn.click();

        const modal = page.locator('#universalEquipmentSelectionModal');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Wait for items to load
        await page.waitForFunction(
            () => {
                const m = document.getElementById('universalEquipmentSelectionModal');
                if (!m) return false;
                return m.querySelectorAll('.item-card').length > 0;
            },
            { timeout: 15_000 },
        );

        // Select the first item
        const firstItem = modal.locator('.item-card').first();
        await firstItem.click();

        // Confirm selection
        const confirmBtn = modal.locator('.btn-confirm');
        await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
        await confirmBtn.click();

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 10_000 });

        // Inventory should now have at least one item row
        const inventoryList = page.locator('#inventoryList');
        const itemRows = inventoryList.locator('.item-row');
        const rowCount = await itemRows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test('9.4 — Removing an item updates inventory display', async () => {
        const inventoryList = page.locator('#inventoryList');
        const rowsBefore = await inventoryList.locator('.item-row').count();
        expect(rowsBefore).toBeGreaterThan(0);

        // Click the remove button on the first item
        const removeBtn = inventoryList.locator('[data-remove-item]').first();
        await removeBtn.click();

        // Row count should decrease
        const rowsAfter = await inventoryList.locator('.item-row').count();
        expect(rowsAfter).toBe(rowsBefore - 1);
    });
});
