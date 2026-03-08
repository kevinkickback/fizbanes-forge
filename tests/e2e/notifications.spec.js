import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome } from './helpers.js';

/**
 * 13. Notifications
 * Verifies toast notifications appear and the notification center
 * modal can be opened, lists entries, and cleared.
 */

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
