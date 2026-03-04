import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * Regression test: Modal backdrop block after confirm/cancel close.
 *
 * Reproduces the bug where closing a BaseSelectorModal via Confirm/Cancel
 * (not the X button) leaves `u-hidden` on the DOM element, causing a
 * subsequent open to show only the dark backdrop with no modal content.
 *
 * Steps mirror the manual reproduction report:
 *   1. Create a character (enables gated pages)
 *   2. Navigate to Spells → open Add Spell modal
 *   3. Close via Cancel button (not X)
 *   4. Open Level Up modal → close via footer button
 *   5. Re-open Add Spell modal → must be fully visible (regression check)
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

async function navigateToSpells(page) {
    const spellsBtn = page.locator('button[data-page="spells"]');
    await expect(spellsBtn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await spellsBtn.click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'spells',
        { timeout: 10_000 },
    );
}

test.describe('Modal Backdrop Block Regression', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Modal Regression Hero');
        await navigateToSpells(page);
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'Modal Regression Hero');
            } finally {
                await electronApp.close();
            }
        }
    });

    test('spell modal reopens correctly after cancel-button close + level-up close', async () => {
        const addSpellBtn = page.locator('#addSpellBtn');
        await expect(addSpellBtn).toBeVisible({ timeout: 10_000 });

        // Step 1: Open Add Spell modal
        await addSpellBtn.click();
        const spellModal = page.locator('#universalSpellSelectionModal');
        await expect(spellModal).toBeVisible({ timeout: 10_000 });

        // Verify u-hidden is absent on first open
        expect(
            await spellModal.evaluate((el) => el.classList.contains('u-hidden')),
        ).toBe(false);

        // Step 2: Close via Cancel button (NOT the X — this is the regression trigger)
        await spellModal.locator('.btn-cancel').click();
        await expect(spellModal).not.toBeVisible({ timeout: 10_000 });

        // Step 3: Open Level Up modal and close via footer button
        const levelUpBtn = page.locator('#levelUpBtn');
        const levelUpAvailable = await levelUpBtn
            .isVisible({ timeout: 3_000 })
            .catch(() => false);

        if (levelUpAvailable) {
            await levelUpBtn.click();
            const levelUpModal = page.locator('#levelUpModal');
            await expect(levelUpModal).toBeVisible({ timeout: 10_000 });

            const footerBtn = levelUpModal.locator('.modal-footer .btn').first();
            await footerBtn.click();
            await expect(levelUpModal).not.toBeVisible({ timeout: 10_000 });
        }

        // Step 4 (regression check): Re-open Add Spell modal
        await addSpellBtn.click();

        // Full modal must be visible — not just backdrop
        await expect(spellModal).toBeVisible({ timeout: 10_000 });

        // Modal content must be rendered and visible
        await expect(spellModal.locator('.modal-content')).toBeVisible({
            timeout: 5_000,
        });

        // u-hidden must NOT be on the element
        expect(
            await spellModal.evaluate((el) => el.classList.contains('u-hidden')),
        ).toBe(false);

        // Clean up
        await spellModal.locator('.btn-cancel').click();
        await expect(spellModal).not.toBeVisible({ timeout: 5_000 });
    });

    test('spell modal reopens correctly after confirm-button close', async () => {
        const addSpellBtn = page.locator('#addSpellBtn');
        await expect(addSpellBtn).toBeVisible({ timeout: 10_000 });

        // First open
        await addSpellBtn.click();
        const spellModal = page.locator('#universalSpellSelectionModal');
        await expect(spellModal).toBeVisible({ timeout: 10_000 });

        // Wait for spell cards to load
        await page.waitForFunction(
            () => {
                const m = document.getElementById('universalSpellSelectionModal');
                return m && m.querySelectorAll('.spell-card').length > 0;
            },
            { timeout: 15_000 },
        );

        // Select first card to enable Confirm
        const firstCard = spellModal.locator('.spell-card').first();
        if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await firstCard.click();
        }

        const confirmBtn = spellModal.locator('.btn-confirm');
        const isConfirmEnabled = await confirmBtn
            .isEnabled({ timeout: 2_000 })
            .catch(() => false);
        if (isConfirmEnabled) {
            await confirmBtn.click();
        } else {
            await spellModal.locator('.btn-cancel').click();
        }
        await expect(spellModal).not.toBeVisible({ timeout: 10_000 });

        // Second open (regression check)
        await addSpellBtn.click();
        await expect(spellModal).toBeVisible({ timeout: 10_000 });
        await expect(spellModal.locator('.modal-content')).toBeVisible({
            timeout: 5_000,
        });
        expect(
            await spellModal.evaluate((el) => el.classList.contains('u-hidden')),
        ).toBe(false);

        // Clean up
        await spellModal.locator('.btn-cancel').click();
        await expect(spellModal).not.toBeVisible({ timeout: 5_000 });
    });
});
