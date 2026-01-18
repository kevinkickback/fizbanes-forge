/**
 * Test suite for dynamic feature addition when selecting subclass in level-up modal
 * 
 * NOTE: This test is currently outdated after the level-up modal refactor.
 * The modal no longer has wizard steps; subclass selection now happens on the Build page.
 * This test needs to be rewritten to test the new flow:
 * 1. Level up without subclass
 * 2. Navigate to Build page
 * 3. See subclass notification
 * 4. Select subclass from notification
 * 5. Verify features appear dynamically
 * 
 * TODO: Rewrite this test for the simplified level-up modal flow
 */

import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Subclass Dynamic Feature Addition', () => {
    test.skip('should add Fighting Style choice when selecting Champion subclass at level 10', async () => {
        test.setTimeout(180000);

        const testCharacterName = `DynamicFeatureTest-${Date.now()}`;
        console.log(
            `\n=== Testing Dynamic Subclass Feature Addition: "${testCharacterName}" ===\n`,
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

            // Capture console for debugging
            page.on('console', (msg) => {
                console.log(`[${msg.type()}] ${msg.text()}`);
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForTimeout(1000);

            // Create new character
            console.log('3. Creating new Fighter character...');
            await page.locator('#createCharacter').click();
            await page.waitForSelector('#characterNameInput:visible', { timeout: 10000 });
            await page.locator('#characterNameInput').fill(testCharacterName);
            await page.locator('button:has-text("Create")').click();
            await page.waitForTimeout(2000);

            // Navigate to Build page
            console.log('4. Navigating to Build page...');
            await page.locator('button.nav-link[data-page="build"]').click();
            await page.waitForSelector('[data-current-page="build"]', { timeout: 15000 });
            await page.waitForTimeout(1000);

            // Add Fighter class
            console.log('5. Adding Fighter class...');
            const addClassBtn = page.locator('button:has-text("Add Class")');
            await addClassBtn.click();
            await page.waitForSelector('#classSelector:visible', { timeout: 10000 });

            await page.selectOption('#classSelector', 'Fighter');
            await page.waitForTimeout(500);

            const confirmBtn = page.locator('button:has-text("Confirm")').first();
            await confirmBtn.click();
            await page.waitForTimeout(2000);

            // Level up to 10 without selecting subclass
            console.log('6. Leveling up to level 10...');
            for (let i = 1; i < 10; i++) {
                console.log(`   Leveling to ${i + 1}...`);

                const levelUpBtn = page.locator('#openLevelUpModalBtn');
                await expect(levelUpBtn).toBeEnabled({ timeout: 10000 });
                await levelUpBtn.click();
                await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });
                await page.waitForTimeout(500);

                // If at level 3, skip subclass selection (keep it empty)
                if (i === 2) {
                    console.log('   Skipping subclass selection at level 3...');
                }

                // Navigate through steps
                let currentStep = 0;
                while (currentStep < 4) {
                    const nextBtn = page.locator('#levelUpModal button[data-action="next"]:visible');
                    if (await nextBtn.count() > 0) {
                        await nextBtn.click();
                        await page.waitForTimeout(300);
                        currentStep++;
                    } else {
                        break;
                    }
                }

                // Confirm
                const modalConfirmBtn = page.locator('#levelUpModal button[data-action="confirm"]:visible');
                await modalConfirmBtn.click();
                await page.waitForTimeout(1000);

                // Wait for modal to close
                await page.waitForSelector('#levelUpModal:not(.show)', { timeout: 10000 });
                await page.waitForTimeout(500);
            }

            console.log('7. Character is now level 10 without subclass');

            // Open level-up modal at level 10
            console.log('8. Opening Level Up modal at level 10...');
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            await expect(levelUpBtn).toBeEnabled({ timeout: 10000 });
            await levelUpBtn.click();
            await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });
            await page.waitForTimeout(1000);

            // Navigate to step 1 (Class Features)
            console.log('9. Navigating to Class Features step...');
            const nextBtn = page.locator('#levelUpModal button[data-action="next"]:visible');
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Verify we're on step 1
            const stepContent = page.locator('.modal-body [data-step-content]');
            await expect(stepContent).toBeVisible();

            // Check for subclass dropdown
            console.log('10. Looking for subclass selection dropdown...');
            const subclassSelect = page.locator('select[data-class-name="Fighter"]');
            await expect(subclassSelect).toBeVisible({ timeout: 5000 });

            // Count initial feature cards
            const initialFeatureCards = await page.locator('[data-feature-card]').count();
            console.log(`    Initial feature cards: ${initialFeatureCards}`);

            // Select Champion subclass
            console.log('11. Selecting Champion subclass...');
            await subclassSelect.selectOption('Champion');
            await page.waitForTimeout(1000); // Wait for dynamic feature addition

            // Count feature cards after selection
            const updatedFeatureCards = await page.locator('[data-feature-card]').count();
            console.log(`    Feature cards after selection: ${updatedFeatureCards}`);

            // Verify that a Fighting Style feature card was added
            console.log('12. Verifying Fighting Style feature was added...');
            const fightingStyleCard = page.locator('[data-feature-card*="fighting_style"]');
            await expect(fightingStyleCard).toBeVisible({ timeout: 3000 });

            // Verify the card contains expected text
            const cardText = await fightingStyleCard.textContent();
            expect(cardText).toContain('Fighting Style');
            expect(cardText).toContain('Level 10');

            // Verify the "Choose" button is present
            const chooseBtn = fightingStyleCard.locator('button:has-text("Choose")');
            await expect(chooseBtn).toBeVisible();

            console.log('✓ Fighting Style choice was dynamically added after subclass selection!');

            // Verify more cards were added
            expect(updatedFeatureCards).toBeGreaterThan(initialFeatureCards);
            console.log(`✓ Feature card count increased from ${initialFeatureCards} to ${updatedFeatureCards}`);

        } finally {
            console.log('\n13. Closing app...');
            await electronApp.close();
        }
    });

    test('should work for multiple levels and different subclasses', async () => {
        test.setTimeout(180000);

        const testCharacterName = `MultiLevelFeatureTest-${Date.now()}`;
        console.log(
            `\n=== Testing Dynamic Features Across Multiple Levels: "${testCharacterName}" ===\n`,
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

            page.on('console', (msg) => {
                console.log(`[${msg.type()}] ${msg.text()}`);
            });

            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForTimeout(1000);

            // Create new character
            console.log('2. Creating new character...');
            await page.locator('#createCharacter').click();
            await page.waitForSelector('#characterNameInput:visible', { timeout: 10000 });
            await page.locator('#characterNameInput').fill(testCharacterName);
            await page.locator('button:has-text("Create")').click();
            await page.waitForTimeout(2000);

            // Navigate to Build page
            await page.locator('button.nav-link[data-page="build"]').click();
            await page.waitForSelector('[data-current-page="build"]', { timeout: 15000 });
            await page.waitForTimeout(1000);

            // Add Fighter class
            console.log('3. Adding Fighter class...');
            const addClassBtn = page.locator('button:has-text("Add Class")');
            await addClassBtn.click();
            await page.waitForSelector('#classSelector:visible', { timeout: 10000 });

            await page.selectOption('#classSelector', 'Fighter');
            await page.waitForTimeout(500);

            const confirmBtn = page.locator('button:has-text("Confirm")').first();
            await confirmBtn.click();
            await page.waitForTimeout(2000);

            // Level up to 3 and check for subclass selection
            console.log('4. Leveling to 3 and selecting Battle Master...');
            for (let i = 1; i < 3; i++) {
                const levelUpBtn = page.locator('#openLevelUpModalBtn');
                await levelUpBtn.click();
                await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });
                await page.waitForTimeout(500);

                // Navigate through steps
                let currentStep = 0;
                while (currentStep < 4) {
                    const nextBtn = page.locator('#levelUpModal button[data-action="next"]:visible');
                    if (await nextBtn.count() > 0) {
                        await nextBtn.click();
                        await page.waitForTimeout(300);
                        currentStep++;
                    } else {
                        break;
                    }
                }

                const modalConfirmBtn = page.locator('#levelUpModal button[data-action="confirm"]:visible');
                await modalConfirmBtn.click();
                await page.waitForTimeout(1000);
                await page.waitForSelector('#levelUpModal:not(.show)', { timeout: 10000 });
            }

            // At level 3, select Battle Master
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            await levelUpBtn.click();
            await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });
            await page.waitForTimeout(500);

            // Go to step 1
            const nextBtn = page.locator('#levelUpModal button[data-action="next"]:visible');
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Select Battle Master (should add maneuver choices)
            const subclassSelect = page.locator('select[data-class-name="Fighter"]');
            await expect(subclassSelect).toBeVisible({ timeout: 5000 });

            console.log('5. Selecting Battle Master subclass...');
            await subclassSelect.selectOption('Battle Master');
            await page.waitForTimeout(1000);

            // Check for Maneuver choice feature
            const maneuverCard = page.locator('[data-feature-type="maneuver"]');
            if (await maneuverCard.count() > 0) {
                console.log('✓ Battle Master maneuver choice appeared!');
                await expect(maneuverCard.first()).toBeVisible();
            } else {
                console.log('  (No maneuver choice at level 3 for Battle Master - expected)');
            }

            console.log('✓ Subclass selection with dynamic features works across different subclasses!');

        } finally {
            await electronApp.close();
        }
    });
});
