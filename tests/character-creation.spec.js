import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Simple Character Creation Test
 * Tests basic character creation flow
 */

test.describe('Character Creation', () => {
    test('should create a new character', async () => {
        test.setTimeout(120000);

        const testCharacterName = `TestChar-${Date.now()}`;
        console.log(`\n=== Testing Character Creation: "${testCharacterName}" ===\n`);

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

            // Capture console errors
            const errors = [];
            page.on('console', (msg) => {
                const text = msg.text();
                console.log(`[${msg.type()}] ${text}`);
                if (msg.type() === 'error') {
                    errors.push(text);
                }
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForSelector('[data-current-page="home"]', { timeout: 30000 });
            await page.waitForTimeout(3000);

            // Click create character button (either welcome or new button)
            console.log('3. Looking for Create Character button...');

            // Try welcome button first (shown when no characters)
            const welcomeBtn = await page.locator('#welcomeCreateCharacterBtn').isVisible()
                .catch(() => false);

            if (welcomeBtn) {
                console.log('   Found welcome create button, clicking...');
                await page.locator('#welcomeCreateCharacterBtn').click();
            } else {
                // Try regular new character button
                console.log('   Found new character button, clicking...');
                await page.locator('#newCharacterBtn').click();
            }

            // Wait for modal
            console.log('4. Waiting for modal to open...');
            await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

            // Fill in name
            console.log('5. Filling in character name...');
            await page.locator('#newCharacterName').fill(testCharacterName);

            // Click create button
            console.log('6. Clicking Create button...');
            await page.locator('#createCharacterBtn').click();

            // Wait for modal to close
            console.log('7. Waiting for modal to close...');
            await page.waitForSelector('#newCharacterModal.show', {
                state: 'hidden',
                timeout: 15000,
            });

            // Verify character was created
            console.log('8. Verifying character was created...');
            await page.waitForTimeout(2000);
            const characterCard = page.locator('.character-card', {
                hasText: testCharacterName
            }).first();
            await expect(characterCard).toBeVisible({ timeout: 15000 });

            console.log(`\n✓ Character "${testCharacterName}" created successfully!\n`);

            // Check for errors
            const criticalErrors = errors.filter(
                (error) =>
                    !error.includes('DevTools') &&
                    !error.includes('warning') &&
                    !error.includes('deprecated')
            );

            if (criticalErrors.length > 0) {
                console.error('\n=== ERRORS DETECTED ===');
                for (const error of criticalErrors) {
                    console.error(error);
                }
                console.error('=======================\n');
            }

            expect(criticalErrors).toHaveLength(0);

        } finally {
            // Close app
            console.log('9. Closing app...');
            await electronApp.close();
        }
    });
});
