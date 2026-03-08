import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome, navigateToPage } from './helpers.js';

/**
 * 7. Feats Page
 * Verifies the feats page renders, the feat selector opens,
 * and feats can be added/removed.
 */

test.describe('Feats Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Feats Hero');
        await navigateToPage(page, 'feats');
    });

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.afterAll(async ({ }, testInfo) => {
        testInfo.setTimeout(30_000);
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'Feats Hero');
            } finally {
                await electronApp.close();
            }
        }
    });

    test('7.1 — Feats page renders with feat list and controls', async () => {
        // Feat list container and add button should be visible
        await expect(page.locator('#featList')).toBeAttached({ timeout: 5_000 });
        const addFeatBtn = page.locator('#addFeatBtn');
        await expect(addFeatBtn).toBeVisible({ timeout: 5_000 });

        // Feat count / max counter should be present
        await expect(page.locator('#featCount')).toBeAttached();
        await expect(page.locator('#maxFeats')).toBeAttached();
    });

    test('7.2 — Add feat opens modal with 0 selection limit when no feat slots available', async () => {
        test.setTimeout(60_000);
        // A level 1 character has 0 feat slots (needs level 4 or Variant Human)
        const maxFeats = page.locator('#maxFeats');
        const maxText = await maxFeats.textContent();

        if (maxText === '0') {
            // Clicking Add Feat opens the modal even with 0 slots
            await page.locator('#addFeatBtn').click();

            const modal = page.locator('[id^="featSelectionModal_"].show');
            await expect(modal).toBeVisible({ timeout: 10_000 });

            // Wait for feat cards to render
            await page.waitForFunction(
                () => {
                    const m = document.querySelector('[id^="featSelectionModal_"].show');
                    if (!m) return false;
                    return m.querySelectorAll('.selector-card').length > 0;
                },
                { timeout: 15_000 },
            );

            // All cards should be disabled (pointer-events: none prevents clicking)
            const firstCard = modal.locator('.selector-card').first();
            await expect(firstCard).toHaveClass(/disabled/, { timeout: 5_000 });
            await expect(firstCard).toHaveAttribute('aria-disabled', 'true');

            // Close the modal
            await modal.locator('.btn-cancel').click();
            await expect(modal).not.toBeVisible({ timeout: 5_000 });
        }
    });

    test('7.3 — Feat selector modal opens when feat slots available', async () => {
        test.setTimeout(90_000);
        // Level up the character to 4 to gain ASI/feat slot
        await page.locator('button[data-page="build"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'build',
            { timeout: 10_000 },
        );

        // Add 3 levels (go from 1 → 4) via the level-up modal
        for (let i = 0; i < 3; i++) {
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            await expect(levelUpBtn).toBeVisible({ timeout: 5_000 });
            await levelUpBtn.click();

            const levelModal = page.locator('#levelUpModal');
            await expect(levelModal).toBeVisible({ timeout: 10_000 });

            // Click the Add Level button for the first class
            const addLevelBtn = levelModal.locator('[data-add-level]').first();
            await expect(addLevelBtn).toBeVisible({ timeout: 5_000 });
            await addLevelBtn.click();

            // Wait for the level card to reflect the new level
            const expectedLevel = i + 2;
            await page.waitForFunction(
                (lvl) => {
                    const cards = document.querySelectorAll('.class-level-card');
                    for (const card of cards) {
                        if (card.textContent.includes(String(lvl))) return true;
                    }
                    return false;
                },
                expectedLevel,
                { timeout: 10_000 },
            );

            // Close the modal
            await page.locator('#levelUpModal .btn-close').click();
            await expect(levelModal).not.toBeVisible({ timeout: 5_000 });
        }

        // Navigate to feats page
        await page.locator('button[data-page="feats"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'feats',
            { timeout: 10_000 },
        );

        // Now max feats should be > 0
        const maxFeats = page.locator('#maxFeats');
        await expect(maxFeats).not.toHaveText('0', { timeout: 5_000 });

        // Click Add Feat — modal should open
        await page.locator('#addFeatBtn').click();
        const modal = page.locator('[id^="featSelectionModal_"].show');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Modal should have feat cards
        await page.waitForFunction(
            () => {
                const m = document.querySelector('[id^="featSelectionModal_"].show');
                if (!m) return false;
                return m.querySelectorAll('.selector-card').length > 0;
            },
            { timeout: 15_000 },
        );

        const cards = modal.locator('.selector-card');
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);

        // Close the modal
        await modal.locator('.btn-cancel').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    test('7.4 — Selecting a feat adds it to the list', async () => {
        test.setTimeout(60_000);
        // Open the feat selector (character should be level 4 from previous test)
        await page.locator('#addFeatBtn').click();

        // Use .last() because previous modal element may still be in DOM
        const modal = page.locator('[id^="featSelectionModal_"].show');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Wait for feat cards in the active modal
        await page.waitForFunction(
            () => {
                const m = document.querySelector('[id^="featSelectionModal_"].show');
                if (!m) return false;
                return m.querySelectorAll('.selector-card').length > 0;
            },
            { timeout: 15_000 },
        );

        // Click the first feat card to select it
        const firstCard = modal.locator('.selector-card').first();
        await firstCard.click();

        // Confirm the selection
        const confirmBtn = modal.locator('.btn-confirm');
        await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
        await confirmBtn.click();

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 10_000 });

        // A feat should now appear in the feat list
        const featListItems = page.locator('#featList .feat-list-item');
        await expect(featListItems.first()).toBeVisible({ timeout: 5_000 });
    });
});
