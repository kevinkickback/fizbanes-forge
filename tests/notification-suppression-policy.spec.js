/**
 * Test: Notification Suppression Policy
 * 
 * Verifies that routine CRUD notifications are suppressed when UI already
 * provides visual feedback, while errors, warnings, and explicit save/export
 * notifications are still shown.
 */

import { expect, test } from '@playwright/test';

test.describe('Notification Suppression Policy', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
    });

    test('should suppress "New character created successfully" notification', async ({ page }) => {
        // Create a new character via wizard
        await page.click('#newCharacterBtn');
        await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });
        await page.fill('#newCharacterName', 'Test Hero');
        const nextBtn = page.locator('#wizardNextBtn');
        await nextBtn.click();
        await nextBtn.click();
        await nextBtn.click();
        await nextBtn.click();

        // Wait for character card to appear (visual feedback)
        await page.waitForSelector('.character-card', { timeout: 5000 });

        // Verify no success toast appears
        const toast = page.locator('.notification.success:has-text("created")');
        await expect(toast).toHaveCount(0, { timeout: 2000 });
    });

    test('should suppress "Character deleted successfully" notification', async ({ page }) => {
        // Navigate to home page
        await page.click('a[href="#home"]');
        await page.waitForLoadState('networkidle');

        // Find first character card and delete it
        const deleteBtn = page.locator('.character-card .btn-danger').first();
        if (await deleteBtn.count() > 0) {
            await deleteBtn.click();

            // Confirm deletion in modal
            await page.click('.modal.show .btn-danger');

            // Wait for card to disappear (visual feedback)
            await page.waitForTimeout(500);

            // Verify no success toast appears
            const toast = page.locator('.notification.success:has-text("deleted")');
            await expect(toast).toHaveCount(0, { timeout: 2000 });
        }
    });

    test('should suppress single spell add notifications', async ({ page }) => {
        // Assumes a character is loaded with a spellcasting class
        // Open spell selection modal
        await page.click('#addSpellBtn');
        await page.waitForSelector('.modal.show', { timeout: 3000 });

        // Select one spell
        const spellRow = page.locator('.spell-list-row').first();
        if (await spellRow.count() > 0) {
            await spellRow.click();
            await page.click('.modal.show .btn-primary:has-text("Add")');

            // Wait for spell to appear in list (visual feedback)
            await page.waitForTimeout(500);

            // Verify no success toast for single spell add
            const toast = page.locator('.notification.success:has-text("Added")');
            await expect(toast).toHaveCount(0, { timeout: 2000 });
        }
    });

    test('should suppress single item add notifications', async ({ page }) => {
        // Open item selection modal
        await page.click('#addItemBtn');
        await page.waitForSelector('.modal.show', { timeout: 3000 });

        // Select one item
        const itemRow = page.locator('.item-list-row').first();
        if (await itemRow.count() > 0) {
            await itemRow.click();
            await page.click('.modal.show .btn-primary:has-text("Add")');

            // Wait for item to appear in inventory (visual feedback)
            await page.waitForTimeout(500);

            // Verify no success toast
            const toast = page.locator('.notification.success:has-text("Added")');
            await expect(toast).toHaveCount(0, { timeout: 2000 });
        }
    });

    test('should allow "Character saved successfully" notification (explicit user action)', async ({ page }) => {
        // Click the Save button (explicit user command)
        await page.click('#saveCharacterBtn');

        // This one SHOULD show because it's an explicit save
        const toast = page.locator('.notification.success:has-text("Character saved successfully")');
        await expect(toast).toBeVisible({ timeout: 3000 });
    });

    test('should always show error notifications', async ({ page }) => {
        // Trigger an error condition (e.g., try to add spell without character)
        // This depends on app state, but errors should never be suppressed

        // Example: Inject a showNotification call via console
        await page.evaluate(() => {
            if (window.showNotification) {
                window.showNotification('Test error message', 'error');
            }
        });

        const errorToast = page.locator('.notification.error:has-text("Test error")');
        await expect(errorToast).toBeVisible({ timeout: 3000 });
    });

    test('should always show warning notifications', async ({ page }) => {
        // Warnings should never be suppressed
        await page.evaluate(() => {
            if (window.showNotification) {
                window.showNotification('Test warning message', 'warning');
            }
        });

        const warningToast = page.locator('.notification.warning:has-text("Test warning")');
        await expect(warningToast).toBeVisible({ timeout: 3000 });
    });

    test('should suppress bulk item add with count', async ({ page }) => {
        // If bulk add shows "Added 5 items", it should be suppressed
        // because the inventory list update is self-evident
        await page.evaluate(() => {
            if (window.showNotification) {
                window.showNotification('Added 5 items to inventory', 'success');
            }
        });

        const toast = page.locator('.notification.success:has-text("Added 5 items")');
        await expect(toast).toHaveCount(0, { timeout: 2000 });
    });

    test('should suppress "Added <spell> to <class>" pattern', async ({ page }) => {
        // Pattern: "Added Fireball to Wizard"
        await page.evaluate(() => {
            if (window.showNotification) {
                window.showNotification('Added Fireball to Wizard', 'success');
            }
        });

        const toast = page.locator('.notification.success:has-text("Added Fireball")');
        await expect(toast).toHaveCount(0, { timeout: 2000 });
    });
});
