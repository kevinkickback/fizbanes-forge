/**
 * Test suite for Level Up button state management in TitlebarController
 * 
 * This test verifies that the Level Up button:
 * - Is disabled when no character is loaded
 * - Becomes enabled immediately after character creation (character creator forces class selection)
 * - Works from home page without requiring navigation to build page
 * - Updates correctly on CHARACTER_SELECTED events
 */

import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Titlebar Level Up Button', () => {
    test('should enable Level Up button immediately after character creation', async () => {
        test.setTimeout(120000);

        console.log(`\n=== Testing Level Up Button on Character Selection ===\n`);

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

            // Capture console for debugging
            const consoleMessages = [];
            page.on('console', (msg) => {
                const text = msg.text();
                consoleMessages.push({ type: msg.type(), text });
                console.log(`[${msg.type()}] ${text}`);
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForSelector('[data-current-page="home"]', { timeout: 30000 });
            await page.waitForTimeout(2000);

            // Check initial state - Level Up button should be disabled (no character)
            console.log('3. Checking initial Level Up button state...');
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            const initialDisabled = await levelUpBtn.isDisabled();
            const initialTitle = await levelUpBtn.getAttribute('title');
            console.log(`   Disabled: ${initialDisabled}, Title: "${initialTitle}"`);
            expect(initialDisabled).toBe(true);

            // Always create a new character to ensure proper progression format
            console.log('4. Creating a new character with proper progression format...');
            const createBtn = page.locator('#newCharacterBtn, #welcomeCreateCharacterBtn').first();
            await createBtn.click();

            await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });
            await page.locator('#newCharacterName').fill(`TestChar-${Date.now()}`);

            // Navigate through wizard steps
            console.log('   Navigating through character creation wizard...');
            const nextBtn = page.locator('#wizardNextBtn');
            await nextBtn.click(); // Step 0 -> 1 (Basics -> Rules)
            await page.waitForTimeout(500);
            await nextBtn.click(); // Step 1 -> 2 (Rules -> Sources)
            await page.waitForTimeout(500);
            await nextBtn.click(); // Step 2 -> 3 (Sources -> Review)
            await page.waitForTimeout(500);
            await nextBtn.click(); // Create character

            await page.waitForSelector('#newCharacterModal.show', {
                state: 'hidden',
                timeout: 15000,
            });
            await page.waitForTimeout(2000);

            // Since character creator now forces class selection, newly created characters should have a class
            // Check Level Up button after character creation
            console.log('5. Checking Level Up button after character creation...');

            // Wait a bit for CHARACTER_SELECTED event to propagate and update button state
            await page.waitForTimeout(1500);

            const afterCreateDisabled = await levelUpBtn.isDisabled();
            const afterCreateTitle = await levelUpBtn.getAttribute('title');
            console.log(`   Disabled: ${afterCreateDisabled}, Title: "${afterCreateTitle}"`);

            // Check character state to verify it has a class in progression format
            console.log('6. Checking character state...');
            const characterAfter = await page.evaluate(() => {
                const char = window.AppState?.getCurrentCharacter?.();
                return {
                    hasCharacter: !!char,
                    name: char?.name,
                    hasProgression: !!char?.progression,
                    progressionClasses: char?.progression?.classes,
                    classCount: char?.progression?.classes?.length || 0
                };
            });
            console.log('   Character after:', JSON.stringify(characterAfter, null, 2));

            // Filter console messages for TitlebarController updates
            const titlebarLogs = consoleMessages.filter(msg =>
                msg.text.includes('[TitlebarController]')
            );
            console.log('\n=== TitlebarController Logs ===');
            for (const log of titlebarLogs) {
                console.log(log.text);
            }

            // Assertions - verify the button is enabled with the new progression format
            expect(characterAfter.classCount).toBeGreaterThan(0);
            expect(afterCreateDisabled).toBe(false);
            expect(afterCreateTitle).toBe('Level Up');

            console.log('\n✓ Test completed successfully!\n');

        } finally {
            // Close app
            await electronApp.close();
        }
    });
});
