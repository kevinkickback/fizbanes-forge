/**
 * Test suite for Level Up modal reopen functionality
 * 
 * This test verifies that the Level Up modal can be opened, closed, and reopened
 * multiple times without errors.
 */

import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Level Up Modal Reopen', () => {
    test('should allow reopening Level Up modal multiple times', async () => {
        test.setTimeout(120000);

        const testCharacterName = `LevelUpReopenTest-${Date.now()}`;
        console.log(
            `\n=== Testing Level Up Modal Reopen: "${testCharacterName}" ===\n`,
        );

        // Launch app
        console.log('1. Launching app...');
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
            let page = electronApp
                .windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent(
                    'window',
                    (win) => !win.url().startsWith('devtools://'),
                );
            }

            // Capture console messages including errors
            const consoleMessages = [];
            const errors = [];
            page.on('console', (msg) => {
                const text = msg.text();
                consoleMessages.push({ type: msg.type(), text });
                if (msg.type() === 'error') {
                    errors.push(text);
                }
                console.log(`[${msg.type()}] ${text}`);
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForSelector('[data-current-page="home"]', {
                timeout: 30000,
            });
            await page.waitForTimeout(2000);

            // Click first available character card
            console.log('3. Loading existing character...');
            const firstCard = page.locator('.character-card').first();
            await firstCard.click();
            await page.waitForTimeout(2000);

            // Navigate to Build page
            console.log('4. Navigating to Build page...');
            await page.locator('button.nav-link[data-page="build"]').click();
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 15000,
            });
            await page.waitForTimeout(1000);

            // Now test opening and closing the Level Up modal multiple times
            console.log('5. Testing Level Up modal open/close cycles...');
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            const levelUpModal = page.locator('#levelUpModal');

            for (let cycle = 1; cycle <= 3; cycle++) {
                console.log(`   Cycle ${cycle}: Opening modal...`);
                await levelUpBtn.click();

                // Wait for modal to be visible
                await page
                    .locator('#levelUpModal.show')
                    .waitFor({ state: 'visible', timeout: 15000 });
                console.log(`   Cycle ${cycle}: Modal opened successfully`);

                // Wait a moment to ensure modal is fully rendered
                await page.waitForTimeout(1000);

                // Verify modal content is rendered (simplified picker, not wizard)
                const classLevelCards = await page.locator('.class-level-card').count();
                console.log(`   Cycle ${cycle}: Found ${classLevelCards} class level card(s)`);
                expect(classLevelCards).toBeGreaterThan(0);

                // Close modal by clicking the close button or backdrop
                console.log(`   Cycle ${cycle}: Closing modal...`);
                const closeBtn = levelUpModal.locator(
                    'button.btn-close, [data-bs-dismiss="modal"]',
                ).first();
                if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await closeBtn.click();
                } else {
                    // Press escape key
                    await page.keyboard.press('Escape');
                }

                // Wait for modal to be hidden
                await page
                    .locator('#levelUpModal.show')
                    .waitFor({ state: 'hidden', timeout: 15000 });
                console.log(`   Cycle ${cycle}: Modal closed successfully`);

                // Wait a moment before next cycle
                await page.waitForTimeout(500);
            }

            // Check for "Failed to prepare Level Up modal" errors specifically
            const failedModalErrors = consoleMessages.filter(
                (msg) =>
                    msg.type === 'error' &&
                    msg.text.includes('Failed to prepare Level Up modal'),
            );

            console.log('\n✓ Test completed successfully!\n');

            // The main test is that we didn't get "Failed to prepare Level Up modal" errors
            expect(failedModalErrors).toEqual([]);
        } finally {
            // Close app
            await electronApp.close();
        }
    });
});
