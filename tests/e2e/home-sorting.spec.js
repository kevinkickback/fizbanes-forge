import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 15. Home Page — Sorting
 * Verifies the sort-select control on the home page.
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

test.describe('Home Page Sorting', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('15.1 — Sort select is visible with all expected options', async () => {
        const sortSelect = page.locator('#sortSelect');
        await expect(sortSelect).toBeVisible({ timeout: 5_000 });

        // Verify all six sort options exist
        const expectedValues = [
            'name',
            'name-desc',
            'level',
            'level-desc',
            'modified',
            'modified-asc',
        ];

        for (const value of expectedValues) {
            const option = sortSelect.locator(`option[value="${value}"]`);
            await expect(option).toBeAttached();
        }
    });

    test('15.2 — Changing sort option updates the select value', async () => {
        const sortSelect = page.locator('#sortSelect');

        // Change to each sort option and verify it sticks
        await sortSelect.selectOption('name-desc');
        await expect(sortSelect).toHaveValue('name-desc');

        await sortSelect.selectOption('level');
        await expect(sortSelect).toHaveValue('level');

        await sortSelect.selectOption('modified');
        await expect(sortSelect).toHaveValue('modified');

        // Reset back to default
        await sortSelect.selectOption('name');
        await expect(sortSelect).toHaveValue('name');
    });
});
