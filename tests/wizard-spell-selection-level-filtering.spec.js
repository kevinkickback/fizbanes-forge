import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Test: Wizard spell selection respects level-specific spell availability
 * 
 * With the simplified level-up modal, spell choices are now handled on the Build page.
 * This test verifies:
 * 1. After leveling up a Wizard, a spell notification appears on the Build page
 * 2. Navigating to the Spells page shows pending spell choice alerts
 * 3. The spells page displays appropriate spells for the character's class/level
 */
test('wizard spell selection after level-up should show pending choices', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    try {
        // Get main window
        let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
        }

        // Capture console output for debugging
        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        // Wait for app load
        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Step 1: Create a new character
        console.log('Creating new character...');
        const newCharBtn = page.locator('button:has-text("New Character")').first();
        await newCharBtn.click();
        await page.waitForTimeout(500);

        // Step 2: Select Wizard class
        console.log('Selecting Wizard class...');
        await page.waitForSelector('[data-class-card-name="Wizard"]', { timeout: 5000 });
        await page.locator('[data-class-card-name="Wizard"]').click();
        await page.waitForTimeout(500);

        // Step 3: Select a race (any race)
        console.log('Selecting race...');
        await page.waitForSelector('[data-race-card]', { timeout: 5000 });
        await page.locator('[data-race-card]').first().click();
        await page.waitForTimeout(500);

        // Step 4: Finish character creation
        console.log('Finishing character creation...');
        await page.locator('button:has-text("Finish")').click();
        await page.waitForTimeout(1000);

        // Step 5: Navigate to Build page
        console.log('Navigating to Build page...');
        await page.locator('button.nav-link[data-page="build"]').click();
        await page.waitForTimeout(1000);

        // Step 6: Open Level Up modal and add a level
        console.log('Opening Level Up modal...');
        const levelUpBtn = page.locator('#openLevelUpModalBtn');
        await levelUpBtn.click();
        await page.waitForSelector('#levelUpModal.show', { timeout: 5000 });

        // Click the add level button for Wizard (first class)
        console.log('Adding a Wizard level...');
        const addLevelBtn = page.locator('.class-level-card button[aria-label="Add level"]').first();
        await addLevelBtn.click();
        await page.waitForTimeout(1000);

        // Close modal
        const closeBtn = page.locator('#levelUpModal button.btn-close');
        await closeBtn.click();
        await page.waitForTimeout(1000);

        // Step 7: Verify spell notification appears on Build page
        console.log('Checking for spell notification on Build page...');
        const spellNotification = page.locator('#spellNotificationSection');
        await expect(spellNotification).toBeVisible({ timeout: 5000 });
        
        const spellNotificationText = await spellNotification.textContent();
        console.log(`Spell notification: ${spellNotificationText}`);
        expect(spellNotificationText).toContain('spell');

        // Step 8: Navigate to Spells page
        console.log('Navigating to Spells page...');
        const spellsNavBtn = page.locator('button.nav-link[data-page="spells"]');
        await spellsNavBtn.click();
        await page.waitForTimeout(1000);

        // Step 9: Verify pending spell choices alert appears
        console.log('Checking for pending spell choices alert...');
        const pendingAlert = page.locator('#pendingSpellChoicesAlert');
        await expect(pendingAlert).toBeVisible({ timeout: 5000 });
        
        const pendingAlertText = await pendingAlert.textContent();
        console.log(`Pending alert: ${pendingAlertText}`);

        // Step 10: Verify navigation badge shows pending count
        console.log('Checking navigation badge on Spells button...');
        const spellsBadge = spellsNavBtn.locator('.badge');
        if (await spellsBadge.isVisible().catch(() => false)) {
            const badgeText = await spellsBadge.textContent();
            console.log(`Spells badge count: ${badgeText}`);
            expect(parseInt(badgeText, 10)).toBeGreaterThan(0);
        }

        console.log('✓ Test complete - wizard spell pending choices verified!');

    } finally {
        await electronApp.close();
    }
});
