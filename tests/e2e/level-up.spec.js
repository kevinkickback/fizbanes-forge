import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome } from './helpers.js';

/**
 * 11. Level Up
 * Verifies the level-up modal, class level increment, and
 * multiclass option.
 */

test.describe('Level Up', () => {
    let electronApp;
    let page;
    let testCharacterName;

    test.beforeEach(async () => {
        test.setTimeout(120_000);
        testCharacterName = null;
        ({ electronApp, page } = await launchAndWaitForHome());
    });

    test.afterEach(async () => {
        if (electronApp) {
            try {
                if (testCharacterName) {
                    await deleteCharacterByName(page, testCharacterName);
                }
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
        testCharacterName = 'LevelUp Button Hero';

        // Level Up button should now be enabled
        await expect(levelUpBtn).not.toHaveAttribute('disabled', '', {
            timeout: 5_000,
        });
    });

    test('11.2 — Clicking Level Up opens the level-up modal', async () => {
        await createCharacter(page, 'LevelUp Modal Hero');
        testCharacterName = 'LevelUp Modal Hero';

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
        testCharacterName = 'Multiclass Hero';

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
        testCharacterName = 'Growing Hero';

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
