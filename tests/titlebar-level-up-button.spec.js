/**
 * Test suite for Level Up button state management in TitlebarController
 * 
 * This test verifies that the Level Up button:
 * - Is disabled when no character is loaded
 * - Is disabled when character has no classes
 * - Becomes enabled when character has at least one class
 * - Updates correctly on CHARACTER_UPDATED events
 */

import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Titlebar Level Up Button', () => {
    test('should enable Level Up button when character gets a class', async () => {
        test.setTimeout(120000);

        const testCharacterName = `LevelUpTest-${Date.now()}`;
        console.log(`\n=== Testing Level Up Button: "${testCharacterName}" ===\n`);

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

            // Create a new character
            console.log('4. Creating new character...');
            const welcomeBtn = await page
                .locator('#welcomeCreateCharacterBtn')
                .isVisible()
                .catch(() => false);

            if (welcomeBtn) {
                await page.locator('#welcomeCreateCharacterBtn').click();
            } else {
                await page.locator('#newCharacterBtn').click();
            }

            await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });
            await page.locator('#newCharacterName').fill(testCharacterName);

            // Navigate through wizard steps (4 steps: 0, 1, 2, 3)
            console.log('   Navigating through character creation wizard...');
            const nextBtn = page.locator('#wizardNextBtn');

            // Step 0 -> 1 (Basics -> Rules)
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Step 1 -> 2 (Rules -> Sources)
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Step 2 -> 3 (Sources -> Review)
            await nextBtn.click();
            await page.waitForTimeout(500);

            // On step 3, button changes to "Create", click it
            await nextBtn.click(); // Create character

            await page.waitForSelector('#newCharacterModal.show', {
                state: 'hidden',
                timeout: 15000,
            });
            await page.waitForTimeout(2000);

            // Check Level Up button after creating character (should still be disabled - no class)
            console.log('5. Checking Level Up button after character creation (no class yet)...');
            const afterCreateDisabled = await levelUpBtn.isDisabled();
            const afterCreateTitle = await levelUpBtn.getAttribute('title');
            console.log(`   Disabled: ${afterCreateDisabled}, Title: "${afterCreateTitle}"`);
            expect(afterCreateDisabled).toBe(true);
            expect(afterCreateTitle).toContain('Add a class');

            // Navigate to Build page
            console.log('6. Navigating to Build page...');
            await page.locator('button.nav-link[data-page="build"]').click();
            await page.waitForSelector('[data-current-page="build"]', { timeout: 15000 });
            await page.waitForTimeout(2000); // Wait a bit longer for page to initialize

            // Check character state before adding class
            console.log('7. Checking character state before adding class...');
            const characterDebug = await page.evaluate(() => {
                // Check what's available on window
                const debug = {
                    hasWindow: typeof window !== 'undefined',
                    windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('app') || k.toLowerCase().includes('state')),
                    hasAppState: typeof window.AppState !== 'undefined',
                    AppStateType: typeof window.AppState
                };

                try {
                    const char = window.AppState?.getCurrentCharacter?.();
                    debug.hasCharacter = !!char;
                    debug.characterName = char?.name;
                    debug.hasProgression = !!char?.progression;
                    debug.classCount = char?.progression?.classes?.length || 0;
                } catch (e) {
                    debug.error = e.message;
                }

                return debug;
            });
            console.log('   Debug info:', JSON.stringify(characterDebug, null, 2));

            // Add a class
            console.log('8. Adding a class (Wizard)...');
            const classSelect = page.locator('#classSelect').first();
            await classSelect.waitFor({ state: 'visible', timeout: 15000 });

            // Wait for options to load (class dropdown populated when data loads)
            console.log('   Waiting for class options to load...');
            try {
                await page.waitForFunction(() => {
                    const select = document.querySelector('#classSelect');
                    const count = select?.options?.length || 0;
                    if (count > 1) console.log(`[Test] Class select loaded with ${count} options`);
                    return count > 1; // More than just placeholder
                }, { timeout: 30000 });
                console.log('   Class options loaded successfully');
            } catch (_e) {
                // If timeout, show what we have
                const optionInfo = await page.evaluate(() => {
                    const select = document.querySelector('#classSelect');
                    return {
                        exists: !!select,
                        optionCount: select?.options?.length || 0,
                        firstOptions: Array.from(select?.options || []).slice(0, 5).map(o => o.text)
                    };
                });
                console.error('   Class options load timeout. Info:', JSON.stringify(optionInfo, null, 2));
                throw new Error('Class options did not load in time');
            }

            console.log('   Selecting Wizard...');

            // Debug: check available options
            const availableOptions = await page.evaluate(() => {
                const select = document.querySelector('#classSelect');
                return Array.from(select?.options || []).map(o => ({
                    text: o.text,
                    value: o.value,
                    disabled: o.disabled
                }));
            });
            console.log('   Available options:', JSON.stringify(availableOptions.slice(0, 5), null, 2));

            await classSelect.selectOption({ label: 'Wizard (PHB)' });

            // Wait for class to be added and CHARACTER_UPDATED to fire
            await page.waitForTimeout(2000);

            // Check character state after adding class
            console.log('9. Checking character state after adding class...');
            const characterAfter = await page.evaluate(() => {
                const char = window.AppState?.getCurrentCharacter?.();
                return {
                    hasCharacter: !!char,
                    name: char?.name,
                    progressionClasses: char?.progression?.classes,
                    classCount: char?.progression?.classes?.length || 0
                };
            });
            console.log('   Character after:', JSON.stringify(characterAfter, null, 2));

            // Check Level Up button state after adding class
            console.log('10. Checking Level Up button after adding class...');
            const afterClassDisabled = await levelUpBtn.isDisabled();
            const afterClassTitle = await levelUpBtn.getAttribute('title');
            console.log(`   Disabled: ${afterClassDisabled}, Title: "${afterClassTitle}"`);

            // Filter console messages for TitlebarController updates
            const titlebarLogs = consoleMessages.filter(msg =>
                msg.text.includes('[TitlebarController]')
            );
            console.log('\n=== TitlebarController Logs ===');
            for (const log of titlebarLogs) {
                console.log(log.text);
            }

            // Assertions - verify the button became enabled
            expect(afterClassDisabled).toBe(false);
            expect(afterClassTitle).toBe('Level Up');

            console.log('\n✓ Test completed successfully!\n');

        } finally {
            // Close app
            await electronApp.close();
        }
    });
});
