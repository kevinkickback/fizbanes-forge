import { _electron as electron, expect } from '@playwright/test';
import { test } from './fixtures.js';

test('Eldritch Invocations should not show duplicates across levels', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    // Get main renderer window (exclude DevTools)
    let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
    }

    // Set up console capturing
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`[CONSOLE ${type}] ${msg.text()}`);
    });

    // Wait for app to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });

    try {
        // User already has a level 1 Warlock character, so we just use the existing one
        // Click on character info to select the character
        await page.locator('.character-info').first().click();
        await page.waitForTimeout(1000);

        console.log('[TEST] Character selected');

        // Open level up modal
        await page.getByRole('button', { name: 'Level Up' }).click();
        await page.waitForSelector('#levelUpModal.show', { timeout: 5000 });

        console.log('[TEST] Level Up modal opened');

        // Increase Warlock level from 1 to 5
        // Double click + button (adds 2 levels)
        await page.getByRole('button', { name: '+', exact: true }).dblclick();
        await page.waitForTimeout(500);

        // Click + button 2 more times (adds 2 more levels, total = 5)
        await page.getByRole('button', { name: '+', exact: true }).click();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: '+', exact: true }).click();
        await page.waitForTimeout(500);

        console.log('[TEST] Increased Warlock to level 5');

        // Move to class features step
        await page.getByRole('button', { name: 'Next' }).click();
        await page.waitForTimeout(500);

        console.log('[TEST] On class features step');

        // Click first Choose button (Level 2 invocation)
        await page.getByRole('button', { name: 'Choose' }).first().click();
        await page.waitForSelector('#levelUpSelectorModal.show', { timeout: 5000 });

        console.log('[TEST] Opened level 2 invocation selector');

        // Select "Armor of Shadows"
        await page.getByText('Armor of Shadows').click();
        await page.waitForTimeout(300);

        console.log('[TEST] Selected Armor of Shadows');

        // Confirm selection
        await page.getByRole('button', { name: 'Confirm Selection' }).click();
        await page.waitForTimeout(500);

        console.log('[TEST] Confirmed level 2 invocation selection');

        // Now click the 3rd Choose button (Level 5 invocation - nth(2) is 0-indexed)
        await page.getByRole('button', { name: 'Choose' }).nth(2).click();
        await page.waitForSelector('#levelUpSelectorModal.show', { timeout: 5000 });

        console.log('[TEST] Opened level 5 invocation selector');

        // Wait a bit for the modal content to render
        await page.waitForTimeout(500);

        // Try to find and click "Armor of Shadows" - it should NOT be there
        const armorOfShadowsLocator = page.getByText('Armor of Shadows', { exact: false });
        const count = await armorOfShadowsLocator.count();

        console.log('[TEST] Armor of Shadows count in level 5 list:', count);

        if (count > 0) {
            // Try to click it to prove it's there
            await armorOfShadowsLocator.first().click();
            console.log('[TEST] ✗ FAILED - Armor of Shadows was found and clicked in level 5 list');
            expect(count).toBe(0); // This will fail
        } else {
            console.log('[TEST] ✓ Test passed - Armor of Shadows correctly filtered out');
        }

    } catch (error) {
        console.error('[TEST] Test failed:', error);
        throw error;
    } finally {
        await electronApp.close();
    }
});
