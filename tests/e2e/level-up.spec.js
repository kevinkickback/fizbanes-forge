import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 11. Level Up
 * Verifies the level-up modal, class level increment, and
 * multiclass option.
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

/** Create a level-1 character via the wizard. */
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

/** Delete the currently loaded character via the Home page. */
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

test.describe('Level Up', () => {
    let electronApp;
    let page;

    test.beforeEach(async () => {
        test.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
    });

    test.afterEach(async () => {
        if (electronApp) {
            try {
                await deleteCurrentCharacter(page);
            } catch {
                // Character may not exist or page may be in an unexpected state
            } finally {
                await electronApp.close();
            }
        }
    });

    test('11.1 — Level Up button visible in titlebar when character loaded', async () => {
        // Before character creation, Level Up button should be disabled
        const levelUpBtn = page.locator('#openLevelUpModalBtn');
        await expect(levelUpBtn).toBeVisible();
        const isDisabledBefore = await levelUpBtn.getAttribute('disabled');
        expect(isDisabledBefore).not.toBeNull();

        // Create a character
        await createCharacter(page, 'LevelUp Button Hero');

        // Level Up button should now be enabled
        await expect(levelUpBtn).not.toHaveAttribute('disabled', '', {
            timeout: 5_000,
        });
    });

    test('11.2 — Clicking Level Up opens the level-up modal', async () => {
        await createCharacter(page, 'LevelUp Modal Hero');

        const levelUpBtn = page.locator('#openLevelUpModalBtn');
        await expect(levelUpBtn).not.toHaveAttribute('disabled', '', {
            timeout: 5_000,
        });

        await levelUpBtn.click();

        // Modal should appear
        const modal = page.locator('#levelUpModal');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Should show the modal title
        const title = await page.locator('#levelUpModalLabel').textContent();
        expect(title).toContain('Level Up');

        // Close the modal
        await page.locator('#levelUpModal .btn-close').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    test('11.3 — Level-up modal shows class selection for multiclass option', async () => {
        await createCharacter(page, 'Multiclass Hero');

        await page.locator('#openLevelUpModalBtn').click();
        const modal = page.locator('#levelUpModal');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Should show the current class with an "Add Level" button
        const classCard = modal.locator('.class-level-card').first();
        await expect(classCard).toBeVisible({ timeout: 5_000 });

        // Should have a multiclass select for adding a new class
        const multiclassSelect = modal.locator('#multiclassSelect');
        await expect(multiclassSelect).toBeAttached({ timeout: 5_000 });

        // Close modal
        await page.locator('#levelUpModal .btn-close').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    test('11.4 — Completing level-up increments character level', async () => {
        await createCharacter(page, 'Growing Hero');

        // Open level-up modal
        await page.locator('#openLevelUpModalBtn').click();
        const modal = page.locator('#levelUpModal');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Find and click the "Add Level" button for the current class
        const addLevelBtn = modal.locator('[data-add-level]').first();
        await expect(addLevelBtn).toBeVisible({ timeout: 5_000 });
        await addLevelBtn.click();

        // The level badge should update — look for level 2 indication
        // The class level card text should now say something like "Class Level 2"
        await page.waitForFunction(
            () => {
                const cards = document.querySelectorAll('.class-level-card');
                for (const card of cards) {
                    if (card.textContent.includes('2')) return true;
                }
                return false;
            },
            { timeout: 10_000 },
        );

        // Close modal
        await page.locator('#levelUpModal .btn-close').click();
        await expect(modal).not.toBeVisible({ timeout: 5_000 });

        // Save the character to persist the level-up
        const saveBtn = page.locator('#saveCharacter');
        if (await saveBtn.evaluate((el) => el.classList.contains('unsaved'))) {
            await saveBtn.click();
        }
    });
});
