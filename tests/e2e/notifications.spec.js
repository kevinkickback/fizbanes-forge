import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 13. Notifications
 * Verifies toast notifications appear and the notification center
 * modal can be opened, lists entries, and cleared.
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

test.describe('Notifications', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Notify Hero');
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'Notify Hero');
            } finally {
                await electronApp.close();
            }
        }
    });

    test('13.1 — Notification center button opens the modal', async () => {
        const centerBtn = page.locator('#notificationCenterBtn');
        await expect(centerBtn).toBeVisible({ timeout: 5_000 });
        await centerBtn.click();

        const modal = page.locator('#notificationCenterModal');
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // The modal should have a notification list container and clear button
        await expect(page.locator('#notificationCenterList')).toBeAttached();
        await expect(page.locator('#clearNotificationsBtn')).toBeAttached();

        // Close the modal
        await page.locator('#notificationCenterModal .btn-close').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    test('13.2 — Toast appears on character save', async () => {
        // Make a change so save button is enabled
        await page.locator('button[data-page="details"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'details',
            { timeout: 10_000 },
        );

        const playerName = page.locator('#playerName');
        await playerName.fill(`Tester_${Date.now()}`);

        // Wait for save button to be clickable
        const saveBtn = page.locator('#saveCharacter');
        await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
        await saveBtn.click();

        // A success toast should appear with "saved successfully"
        const toast = page.locator('.notification.success');
        await expect(toast).toBeVisible({ timeout: 10_000 });
        const message = toast.locator('.notification-message');
        await expect(message).toContainText(/saved/i, { timeout: 5_000 });
    });

    test('13.3 — Clear notifications button empties the list', async () => {
        // Open notification center — it should have at least the save notification
        await page.locator('#notificationCenterBtn').click();
        const modal = page.locator('#notificationCenterModal');
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // There should be at least one notification item
        const items = page.locator('.notification-center-item');
        const countBefore = await items.count();
        expect(countBefore).toBeGreaterThan(0);

        // Click clear all
        await page.locator('#clearNotificationsBtn').click();

        // List should now be empty
        await expect(items).toHaveCount(0, { timeout: 5_000 });

        // Close the modal
        await page.locator('#notificationCenterModal .btn-close').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });
});
