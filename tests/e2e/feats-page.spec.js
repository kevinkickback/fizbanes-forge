import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 7. Feats Page
 * Verifies the feats page renders, the feat selector opens,
 * and feats can be added/removed.
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

async function deleteCurrentCharacter(page) {
    await page.locator('button[data-page="home"]').click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'home',
        { timeout: 10_000 },
    );
    const deleteBtn = page.locator('.delete-character').first();
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });
    }
}

async function navigateToFeats(page) {
    const featsBtn = page.locator('button[data-page="feats"]');
    await expect(featsBtn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await featsBtn.click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'feats',
        { timeout: 10_000 },
    );
}

test.describe('Feats Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Feats Hero');
        await navigateToFeats(page);
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCurrentCharacter(page);
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
        // A level 1 character has 0 feat slots (needs level 4 or Variant Human)
        const maxFeats = page.locator('#maxFeats');
        const maxText = await maxFeats.textContent();

        if (maxText === '0') {
            // Clicking Add Feat opens the modal even with 0 slots
            await page.locator('#addFeatBtn').click();

            const modal = page.locator('[id^="featSelectionModal_"]');
            await expect(modal).toBeVisible({ timeout: 10_000 });

            // Attempting to select a feat should show a limit warning
            await page.waitForFunction(
                () => {
                    const m = document.querySelector('[id^="featSelectionModal_"]');
                    if (!m) return false;
                    return m.querySelectorAll('.selector-card').length > 0;
                },
                { timeout: 15_000 },
            );

            const firstCard = modal.locator('.selector-card').first();
            await firstCard.click();

            // Should show a "can only select 0" warning notification
            const toast = page.locator('.notification.warning');
            await expect(toast).toBeVisible({ timeout: 10_000 });

            // Close the modal
            await modal.locator('.btn-cancel').click();
            await expect(modal).not.toBeVisible({ timeout: 5_000 });
        }
    });

    test('7.3 — Feat selector modal opens when feat slots available', async () => {
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
        const modal = page.locator('[id^="featSelectionModal_"]');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Modal should have feat cards
        await page.waitForFunction(
            () => {
                const m = document.querySelector('[id^="featSelectionModal_"]');
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
