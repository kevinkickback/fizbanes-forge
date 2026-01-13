import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Debug: Level Up Modal Spell Selection', () => {
    /**
     * Helper: Create a new character with a spellcasting class
     */
    async function createCharacter(page, characterName) {
        // Click "New Character" button or fallback to "Create Character"
        let newCharacterBtn = page.locator('#newCharacterBtn');
        let exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!exists) {
            // Try to find "Create Character" button as fallback
            newCharacterBtn = page.locator('button:has-text("Create Character")').first();
            exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);
        }

        if (!exists) {
            // Try to find "New Character" button as text fallback
            newCharacterBtn = page.locator('button:has-text("New Character")').first();
            await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
        }

        await newCharacterBtn.click();

        // Wait for modal to appear
        await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

        // Fill in character name
        const nameInput = page.locator('#newCharacterName');
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill(characterName);

        // Navigate wizard steps
        const nextBtn = page.locator('#wizardNextBtn');
        await expect(nextBtn).toBeVisible({ timeout: 10000 });
        await nextBtn.click(); // Step 0 -> 1
        await nextBtn.click(); // Step 1 -> 2
        await nextBtn.click(); // Step 2 -> 3
        await nextBtn.click(); // Step 3 -> Create character
        console.log('✓ Character created');

        // Wait for character card to appear and open it
        await page.waitForTimeout(1000);
        const characterCard = page
            .locator('.character-card', { hasText: characterName })
            .first();
        await expect(characterCard).toBeVisible({ timeout: 15000 });
        await characterCard.click();

        // Navigate to build page
        await page.waitForSelector('button.nav-link[data-page="build"]', {
            timeout: 15000,
        });
        await page.click('button.nav-link[data-page="build"]');
        await page.waitForSelector('[data-current-page="build"]', {
            timeout: 30000,
        });

        // Wait for build page to fully render
        await page.waitForTimeout(2000);
        console.log('✓ Build page loaded');

        // Select a spellcasting class (Wizard for spell selection testing)
        const classSelect = page.locator('#classSelect');
        await expect(classSelect).toBeVisible({ timeout: 10000 });

        // Wait for options to populate
        await page.waitForTimeout(1000);
        const options = await classSelect.locator('option').all();
        console.log(`  Found ${options.length} class options`);

        // Find and select Wizard
        let foundWizard = false;
        for (let i = 0; i < options.length; i++) {
            const text = await options[i].textContent();
            if (text?.includes('Wizard')) {
                await classSelect.selectOption({ index: i });
                await page.waitForTimeout(1000);
                const selectedClass = await classSelect.inputValue();
                console.log(`✓ Spellcasting class selected: ${selectedClass}`);
                foundWizard = true;
                break;
            }
        }

        if (!foundWizard) {
            console.warn('⚠ Could not find Wizard class, using second option');
            await classSelect.selectOption({ index: 1 });
            await page.waitForTimeout(1000);
        }
    }

    test('Level Up Modal to Spell Selection flow', async () => {
        test.setTimeout(120000);

        let electronApp;
        const characterName = `test-spell-selection-${Date.now()}`;

        try {
            // Launch Electron with debug mode
            electronApp = await electron.launch({
                args: ['.'],
                env: {
                    ...process.env,
                    FF_DEBUG: 'true',
                    FF_ALLOW_DEFAULT_DATA: 'true',
                },
            });

            let page = electronApp
                .windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window',
                    (win) => !win.url().startsWith('devtools://'));
            }

            // Set up console capturing
            page.on('console', msg => {
                const type = msg.type().toUpperCase();
                console.log(`[CONSOLE ${type}] ${msg.text()}`);
            });

            // Wait for app to load
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            console.log('✓ App loaded');

            // Create character
            await createCharacter(page, characterName);

            // Level up the character to see new spell allowances
            console.log('✓ Leveling up character to demonstrate new spell allowances...');
            const levelUpCharBtn = page.locator('button:has-text("Level Up")').first();
            const charLevelUpExists = await levelUpCharBtn.isVisible().catch(() => false);

            if (charLevelUpExists) {
                await levelUpCharBtn.click();
                await page.waitForTimeout(500);

                // Look for a level up confirmation button or similar
                const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Level Up"), button:has-text("Done")').first();
                const confirmExists = await confirmBtn.isVisible().catch(() => false);
                if (confirmExists) {
                    await confirmBtn.click();
                    await page.waitForTimeout(1000);
                    console.log('✓ Character leveled up');
                }
            }

            // Check if level up button exists
            const levelUpBtn = page.locator('button:has-text("Level Up")').first();
            const exists = await levelUpBtn.isVisible().catch(() => false);

            if (!exists) {
                console.warn('⚠ Level up button not visible');
                return;
            }

            console.log('✓ Found Level Up button');

            // Open level up modal
            await levelUpBtn.click();
            await page.waitForTimeout(500);

            // Wait for modal to be visible
            const levelUpModal = page.locator('#levelUpModal');
            await levelUpModal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✓ Level Up Modal opened');

            // Click to increase level for the selected class (Wizard)
            const increaseBtn = page.locator('#levelUpIncreaseBtn');
            const increaseBtnVisible = await increaseBtn.isVisible().catch(() => false);
            if (increaseBtnVisible) {
                await increaseBtn.click();
                await page.waitForTimeout(500);
                console.log('✓ Clicked Increase Level button');
            } else {
                console.warn('⚠ Increase Level button not visible');
            }

            // Navigate to spell selection step (step 3)
            const spellSelectionStep = page.locator('#levelUpStepper [data-step="3"]');
            const spellStepVisible = await spellSelectionStep.isVisible().catch(() => false);
            console.log(`✓ Spell Selection step visible: ${spellStepVisible}`);

            if (spellStepVisible) {
                // Click on spell selection step
                await spellSelectionStep.click();
                await page.waitForTimeout(500);
                console.log('✓ Clicked Spell Selection step');

                // Check if button is visible
                const spellBtn = page.locator('#levelUpSelectSpellBtn');
                const spellBtnVisible = await spellBtn.isVisible().catch(() => false);
                console.log(`✓ Spell Select button visible: ${spellBtnVisible}`);

                if (spellBtnVisible) {
                    // Get button state
                    const isDisabled = await spellBtn.evaluate(el => el.disabled);
                    console.log(`  Button disabled: ${isDisabled}`);

                    if (!isDisabled) {
                        console.log('✓ About to click spell selection button...');

                        // Click spell selection button
                        await spellBtn.click();
                        await page.waitForTimeout(1000);
                        console.log('✓ Clicked spell selection button');

                        // Wait for spell modal to appear
                        const spellModal = page.locator('#spellSelectionModal');
                        const spellModalVisible = await spellModal.isVisible({ timeout: 5000 }).catch(() => false);
                        console.log(`✓ Spell Selection Modal visible: ${spellModalVisible}`);

                        if (spellModalVisible) {
                            console.log('✓ Spell modal is open!');

                            // Find and select the first spell
                            const spellItems = await page.locator('#spellSelectionModal .spell-card').all();
                            console.log(`✓ Found ${spellItems.length} spells in modal`);

                            if (spellItems.length > 0) {
                                const firstSpell = spellItems[0];
                                const spellName = await firstSpell.evaluate(el => {
                                    return el.textContent || el.getAttribute('aria-label') || el.getAttribute('data-spell-name');
                                });
                                console.log(`✓ First spell: ${spellName}`);

                                // Click the first spell to select it
                                await firstSpell.click();
                                await page.waitForTimeout(500);
                                console.log('✓ Clicked first spell');

                                // Now click the "Add Spell(s)" button to confirm selection
                                const addBtn = page.locator('.btn-add-spell').first();
                                const addBtnVisible = await addBtn.isVisible().catch(() => false);
                                console.log(`✓ Add button visible: ${addBtnVisible}`);

                                if (addBtnVisible) {
                                    await addBtn.click();
                                    await page.waitForTimeout(500);
                                    console.log('✓ Clicked Add button to confirm spell selection');

                                    // Modal may auto-close after adding spell, wait for it
                                    const spellModalAfterAdd = await spellModal.isVisible().catch(() => false);
                                    if (!spellModalAfterAdd) {
                                        console.log('✓ Spell modal auto-closed after adding spell');
                                    } else {
                                        // If modal still open, click close button to close it
                                        const closeBtn = page.locator('button[data-bs-dismiss="modal"]').first();
                                        const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
                                        if (closeBtnVisible) {
                                            console.log('✓ Closing spell modal with close button...');
                                            await closeBtn.click();
                                            await page.waitForTimeout(500);
                                        }
                                    }
                                } else {
                                    // If add button not visible, try close button
                                    const closeBtn = page.locator('button[data-bs-dismiss="modal"]').first();
                                    const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
                                    if (closeBtnVisible) {
                                        console.log('✓ Closing spell modal with close button...');
                                        await closeBtn.click();
                                        await page.waitForTimeout(500);
                                    }
                                }
                            }

                            // Wait a bit for level up modal to be shown
                            await page.waitForTimeout(500);

                            // Now check if spell modal is closed
                            const spellModalClosed = !await spellModal.isVisible().catch(() => true);
                            console.log(`✓ Spell modal closed: ${spellModalClosed}`);

                            // Give a bit of time for modal transitions
                            await page.waitForTimeout(500);

                            // Check modal element display and class
                            const levelUpDisplay = await levelUpModal.evaluate(el => window.getComputedStyle(el).display);
                            const levelUpClasses = await levelUpModal.evaluate(el => el.className);
                            console.log(`  Level Up Modal display: ${levelUpDisplay}`);
                            console.log(`  Level Up Modal classes: ${levelUpClasses}`);

                            // Check if level up modal is visible
                            const levelUpModalVisible = await levelUpModal.isVisible();
                            console.log(`✓ Level Up Modal visible after close: ${levelUpModalVisible}`);

                            if (levelUpModalVisible) {
                                console.log('✓✓✓ SUCCESS: Level Up Modal returned after spell selection!');

                                // Wait a moment for modal content to update
                                await page.waitForTimeout(500);

                                // Show the full spell slots container HTML for debugging
                                const containerHTML = await page.locator('#levelUpSpellSlotsContainer').evaluate(el => el.innerHTML);
                                console.log(`\n✓ Spell Slots Container HTML:\n${containerHTML}\n`);

                                // Check if spell info is displayed in the level up modal spell slots container
                                const spellBadges = await page.locator('#levelUpSpellSlotsContainer .badge.bg-success').all();
                                console.log(`✓ Found ${spellBadges.length} spell badges with bg-success in Level Up Modal`);

                                if (spellBadges.length > 0) {
                                    for (let i = 0; i < spellBadges.length; i++) {
                                        const badgeText = await spellBadges[i].textContent();
                                        console.log(`  ✓ Spell ${i + 1}: ${badgeText}`);
                                    }
                                    console.log('✓✓✓ PERFECT: Spell selections are visible in Level Up Modal!');
                                } else {
                                    // Try to find any badges in the container
                                    const allBadges = await page.locator('#levelUpSpellSlotsContainer .badge').all();
                                    console.log(`  Found ${allBadges.length} total badges`);

                                    for (let i = 0; i < allBadges.length; i++) {
                                        const badgeText = await allBadges[i].textContent();
                                        const badgeClass = await allBadges[i].getAttribute('class');
                                        console.log(`    Badge ${i + 1}: "${badgeText}" (class: ${badgeClass})`);
                                    }
                                }
                            } else {
                                console.error('✗✗✗ FAIL: Level Up Modal did not return!');
                            }
                        } else {
                            console.error('✗ Spell Selection Modal did not appear');
                        }
                    } else {
                        console.warn('⚠ Spell button is disabled (no spells available)');
                    }
                }
            }

        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });

    test('Feat Selection Modal flow', async () => {
        test.setTimeout(120000);

        let electronApp;
        const characterName = `test-feat-selection-${Date.now()}`;

        try {
            // Launch Electron with debug mode
            electronApp = await electron.launch({
                args: ['.'],
                env: {
                    ...process.env,
                    FF_DEBUG: 'true',
                    FF_ALLOW_DEFAULT_DATA: 'true',
                },
            });

            let page = electronApp
                .windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window',
                    (win) => !win.url().startsWith('devtools://'));
            }

            // Set up console capturing
            page.on('console', msg => {
                const type = msg.type().toUpperCase();
                console.log(`[CONSOLE ${type}] ${msg.text()}`);
            });

            // Wait for app to load
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            console.log('✓ App loaded');

            // Create character
            await createCharacter(page, characterName);

            // Open level up modal
            const levelUpBtn = page.locator('button:has-text("Level Up")').first();
            const exists = await levelUpBtn.isVisible().catch(() => false);

            if (!exists) {
                console.warn('⚠ Level up button not visible');
                return;
            }

            await levelUpBtn.click();
            await page.waitForTimeout(500);

            const levelUpModal = page.locator('#levelUpModal');
            await levelUpModal.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✓ Level Up Modal opened');

            // Navigate to feat selection step (step 2)
            const featStep = page.locator('#levelUpStepper [data-step="2"]');
            const featStepVisible = await featStep.isVisible().catch(() => false);
            console.log(`✓ Feat Selection step visible: ${featStepVisible}`);

            if (featStepVisible) {
                await featStep.click();
                await page.waitForTimeout(500);
                console.log('✓ Clicked Feat Selection step');

                // Check feat button
                const featBtn = page.locator('#levelUpSelectFeatBtn');
                const featBtnVisible = await featBtn.isVisible().catch(() => false);
                console.log(`✓ Feat Select button visible: ${featBtnVisible}`);

                if (featBtnVisible) {
                    const isDisabled = await featBtn.evaluate(el => el.disabled);
                    console.log(`  Button disabled: ${isDisabled}`);

                    if (!isDisabled) {
                        console.log('✓ About to click feat selection button...');
                        await featBtn.click();
                        await page.waitForTimeout(1000);
                        console.log('✓ Clicked feat selection button');

                        // Wait for feat modal
                        const featModal = page.locator('#featSelectionModal');
                        const featModalVisible = await featModal.isVisible({ timeout: 5000 }).catch(() => false);
                        console.log(`✓ Feat Selection Modal visible: ${featModalVisible}`);

                        if (featModalVisible) {
                            console.log('✓ Feat modal is open!');

                            // Close feat modal
                            const closeFeatBtn = page.locator('#featSelectionModal .btn-close');
                            if (await closeFeatBtn.isVisible()) {
                                console.log('✓ Closing feat modal...');
                                await closeFeatBtn.click();
                                await page.waitForTimeout(1000);
                                console.log('✓ Clicked close button');

                                // Check if level up modal is back
                                const levelUpModalVisible = await levelUpModal.isVisible();
                                console.log(`✓ Level Up Modal visible after feat modal close: ${levelUpModalVisible}`);

                                if (levelUpModalVisible) {
                                    console.log('✓✓✓ SUCCESS: Level Up Modal returned after feat selection!');
                                } else {
                                    console.error('✗✗✗ FAIL: Level Up Modal did not return!');
                                }
                            }
                        } else {
                            console.error('✗ Feat Selection Modal did not appear');
                        }
                    } else {
                        console.warn('⚠ Feat button is disabled');
                    }
                }
            }

        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });
});
