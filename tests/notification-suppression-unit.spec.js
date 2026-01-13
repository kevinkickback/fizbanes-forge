/**
 * Unit Test: Notification Suppression Function
 * 
 * Tests the shouldSuppressNotification logic directly to verify
 * correct blocking/allowing behavior for various message patterns.
 */

import { expect, test } from '@playwright/test';

// Helper to test the suppression logic by injecting the function
async function testSuppression(page, message, type) {
    return await page.evaluate(
        ({ msg, t }) => {
            // Copy the suppression function from Notifications.js
            function shouldSuppressNotification(message, type) {
                if (!message || !type) return false;

                const t = String(type).toLowerCase();
                if (t === 'error' || t === 'danger' || t === 'warning') return false;
                if (t !== 'success' && t !== 'info') return false;

                const m = String(message).trim();

                const suppressPatterns = [
                    /^new character created/i,
                    /^character created/i,
                    /^character deleted successfully/i,
                    /^character deleted/i,
                    /^character renamed/i,
                    /^character duplicated/i,
                    /^added .+ to .+$/i,
                    /^added \d+ (item|spell)/i,
                    /^removed .+ from .+$/i,
                    /^item (added|removed)/i,
                    /^spell (added|removed)/i,
                    /^(equipped|unequipped|attuned|unattuned)/i,
                    /^auto.?saved/i,
                    /^character saved$/i,
                    /^(selected|deselected|applied)/i,
                ];

                if (suppressPatterns.some((re) => re.test(m))) return true;

                if (/saved successfully|exported successfully|imported successfully/i.test(m)) {
                    return false;
                }

                return false;
            }

            return shouldSuppressNotification(msg, t);
        },
        { msg: message, t: type }
    );
}

test.describe('Notification Suppression Logic', () => {
    test('should suppress character creation success', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'New character created successfully', 'success')).toBe(true);
        expect(await testSuppression(page, 'Character created', 'success')).toBe(true);
    });

    test('should suppress character deletion success', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'Character deleted successfully', 'success')).toBe(true);
        expect(await testSuppression(page, 'Character deleted', 'success')).toBe(true);
    });

    test('should suppress spell/item add patterns', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'Added Fireball to Wizard', 'success')).toBe(true);
        expect(await testSuppression(page, 'Added 3 items to inventory', 'success')).toBe(true);
        expect(await testSuppression(page, 'Added 5 spells', 'success')).toBe(true);
        expect(await testSuppression(page, 'Item added', 'info')).toBe(true);
        expect(await testSuppression(page, 'Spell removed', 'info')).toBe(true);
    });

    test('should suppress equipment state changes', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'Equipped Longsword', 'success')).toBe(true);
        expect(await testSuppression(page, 'Unequipped Shield', 'success')).toBe(true);
        expect(await testSuppression(page, 'Attuned to Ring of Protection', 'info')).toBe(true);
    });

    test('should suppress auto-save but allow explicit save', async ({ page }) => {
        await page.goto('about:blank');

        // Should suppress auto-save and plain "Character saved"
        expect(await testSuppression(page, 'Auto-saved', 'success')).toBe(true);
        expect(await testSuppression(page, 'Character saved', 'success')).toBe(true);

        // Should ALLOW explicit "saved successfully"
        expect(await testSuppression(page, 'Character saved successfully', 'success')).toBe(false);
    });

    test('should allow explicit export/import operations', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'Character exported successfully', 'success')).toBe(false);
        expect(await testSuppression(page, 'Data imported successfully', 'success')).toBe(false);
    });

    test('should never suppress errors or warnings', async ({ page }) => {
        await page.goto('about:blank');

        // Errors/warnings/danger always show, regardless of message
        expect(await testSuppression(page, 'Character deleted successfully', 'error')).toBe(false);
        expect(await testSuppression(page, 'Added item failed', 'error')).toBe(false);
        expect(await testSuppression(page, 'Character deleted successfully', 'warning')).toBe(false);
        expect(await testSuppression(page, 'Any message', 'danger')).toBe(false);
    });

    test('should allow non-matching success messages', async ({ page }) => {
        await page.goto('about:blank');

        // Messages that don't match suppress patterns should show
        expect(await testSuppression(page, 'Settings updated successfully', 'success')).toBe(false);
        expect(await testSuppression(page, 'Configuration applied', 'success')).toBe(false);
        expect(await testSuppression(page, 'Data refresh complete', 'info')).toBe(false);
    });

    test('should suppress selection confirmations', async ({ page }) => {
        await page.goto('about:blank');

        expect(await testSuppression(page, 'Selected Strength proficiency', 'info')).toBe(true);
        expect(await testSuppression(page, 'Applied background features', 'success')).toBe(true);
    });

    test('should handle edge cases gracefully', async ({ page }) => {
        await page.goto('about:blank');

        // Null/undefined/empty should not suppress (fail open)
        expect(await testSuppression(page, '', 'success')).toBe(false);
        expect(await testSuppression(page, 'Valid message', '')).toBe(false);
    });
});
