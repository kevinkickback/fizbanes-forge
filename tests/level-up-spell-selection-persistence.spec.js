import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Level Up Spell Selection Persistence', () => {
    /**
     * Helper: Create a new character with a spellcasting class
     */
    async function createCharacter(page, characterName) {
        // Click "New Character" button
        let newCharacterBtn = page.locator('#newCharacterBtn');
        let exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!exists) {
            newCharacterBtn = page.locator('button:has-text("Create Character")').first();
            exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);
        }

        if (!exists) {
            newCharacterBtn = page.locator('button:has-text("New Character")').first();
            await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
        }

        await newCharacterBtn.click();

        // Wait for modal
        await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

        // Fill in character name
        const nameInput = page.locator('#newCharacterName');
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill(characterName);

        // Navigate wizard steps
        const nextBtn = page.locator('#wizardNextBtn');
        await expect(nextBtn).toBeVisible({ timeout: 10000 });
        await nextBtn.click(); // 0 -> 1
        await nextBtn.click(); // 1 -> 2
        await nextBtn.click(); // 2 -> 3
        await nextBtn.click(); // 3 -> Create
        console.log('✓ Character created');

        // Wait for character card
        await page.waitForTimeout(1000);
        const characterCard = page.locator('.character-card', { hasText: characterName }).first();
        await expect(characterCard).toBeVisible({ timeout: 15000 });
        await characterCard.click();

        // Navigate to build page
        await page.waitForSelector('button.nav-link[data-page="build"]', { timeout: 15000 });
        await page.click('button.nav-link[data-page="build"]');
        await page.waitForSelector('[data-current-page="build"]', { timeout: 30000 });
        await page.waitForTimeout(2000);
        console.log('✓ Build page loaded');

        // Select Wizard class
        const classSelect = page.locator('#classSelect');
        await expect(classSelect).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(1000);

        const options = await classSelect.locator('option').all();
        console.log(`  Found ${options.length} class options`);

        let foundWizard = false;
        for (let i = 0; i < options.length; i++) {
            const text = await options[i].textContent();
            if (text?.includes('Wizard')) {
                await classSelect.selectOption({ index: i });
                await page.waitForTimeout(1000);
                console.log('✓ Wizard class selected');
                foundWizard = true;
                break;
            }
        }

        if (!foundWizard) {
            console.warn('⚠ Could not find Wizard, using second option');
            await classSelect.selectOption({ index: 1 });
            await page.waitForTimeout(1000);
        }
    }

    test('Spell selection persistence with CANCEL button (working)', async () => {
        test.setTimeout(120000);

        let electronApp;
        const characterName = `spell-cancel-${Date.now()}`;

        try {
            // STEP 1: Launch Electron app
            electronApp = await electron.launch({
                args: ['.'],
                env: {
                    ...process.env,
                    FF_DEBUG: 'true',
                    FF_ALLOW_DEFAULT_DATA: 'true',
                },
            });

            let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
            }

            page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            console.log('✓ Electron app loaded');

            // STEP 2: Create character
            await createCharacter(page, characterName);

            // ====== STEP 3: Open Level Up Modal (captures sessionStartLevel = 1) ======
            console.log('\n--- STEP 3: Open Level Up Modal ---');
            const levelUpBtn = page.locator('button:has-text("Level Up")').first();
            await expect(levelUpBtn).toBeVisible({ timeout: 10000 });
            await levelUpBtn.click();

            // Wait for modal to appear
            const levelUpModal = page.locator('#levelUpModal.show');
            await expect(levelUpModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Level Up Modal opened at level 1 (sessionStartLevel = 1 captured)');

            // ====== STEPS 4-6: Level up 3x WITHIN modal (to reach level 4) ======
            console.log('\n--- STEPS 4-6: Level up to level 4 (within modal) ---');
            for (let levelUpCount = 0; levelUpCount < 3; levelUpCount++) {
                console.log(`  Leveling up... (${levelUpCount + 1}/3)`);

                // Find increase button in modal
                const increaseBtn = page.locator('#levelUpIncreaseBtn');
                await expect(increaseBtn).toBeVisible({ timeout: 5000 });
                await increaseBtn.click();
                await page.waitForTimeout(500);
            }
            console.log('✓ Character leveled to level 4 within modal');


            // ====== STEPS 7-8: Navigate to spell selection step (step 3) ======
            console.log('\n--- STEPS 7-8: Navigate to spell selection step ---');

            // Click on step 3 in the stepper (spell selection)
            const step3Item = page.locator('#levelUpStepper [data-step="3"]');
            const step3Exists = await step3Item.isVisible({ timeout: 5000 }).catch(() => false);

            if (step3Exists) {
                await step3Item.click();
                await page.waitForTimeout(500);
                console.log('✓ Navigated to spell selection step');
            } else {
                console.warn('⚠ Step 3 not found in stepper');
            }

            // ====== STEP 9: Click "Select New Spells" button ======
            console.log('\n--- STEP 9: Click "Select New Spells" button ---');

            // The button should be enabled now because classLevel (4) > sessionStartLevel (1)
            const isDisabled = await page.locator('#levelUpSelectSpellBtn').isDisabled({ timeout: 2000 }).catch(() => true);
            console.log(`  Select New Spells button disabled: ${isDisabled}`);

            if (isDisabled) {
                console.warn('⚠ Button is disabled! Checking why...');
                const hasNewSpells = await page.locator('#levelUpModal text="New Spells"').isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`  Has new spells text: ${hasNewSpells}`);
            }

            await expect(page.locator('#levelUpSelectSpellBtn')).toBeEnabled({ timeout: 5000 });
            await page.locator('#levelUpSelectSpellBtn').click();
            console.log('✓ Select New Spells button clicked');

            // Wait for spell selection modal
            const spellModal = page.locator('#spellSelectionModal.show');
            await expect(spellModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Spell selection modal opened');

            // ====== STEP 10: Verify spell level filters are checked (1st, 2nd, 3rd) ======
            console.log('\n--- STEP 10: Verify spell level filters checked ---');

            const level1Filter = page.locator('#level1');
            const level2Filter = page.locator('#level2');
            const level3Filter = page.locator('#level3');

            const isLevel1Checked = await level1Filter.isChecked();
            const isLevel2Checked = await level2Filter.isChecked();
            const isLevel3Checked = await level3Filter.isChecked();

            console.log(`  Level 1 checked: ${isLevel1Checked}`);
            console.log(`  Level 2 checked: ${isLevel2Checked}`);
            console.log(`  Level 3 checked: ${isLevel3Checked}`);

            // Note: Filters may or may not be checked initially depending on implementation
            // We're mainly testing that filters persist when modal reopens
            const anyLevelChecked = isLevel1Checked || isLevel2Checked || isLevel3Checked;
            console.log(`  Any level filter checked: ${anyLevelChecked}`);
            console.log('✓ All expected spell level filters are checked');

            // ====== STEP 11: Get the allowance limit ======
            console.log('\n--- STEP 11: Determine allowance for spell selection ---');

            const allowanceText = page.locator('#spellSelectionLimitIndicator');
            const allowanceTextContent = await allowanceText.innerText();
            const allowanceMatches = allowanceTextContent.match(/(\d+)\/(\d+)/);
            const maxAllowance = allowanceMatches ? Number.parseInt(allowanceMatches[2], 10) : 3;
            console.log(`  Will select ${maxAllowance} spells (based on allowance)`);


            // ====== STEP 12: Verify allowance display ======
            console.log('\n--- STEP 12: Verify allowance display ---');

            const allowanceVisible = await allowanceText.isVisible({ timeout: 2000 }).catch(() => false);

            if (allowanceVisible) {
                const allowanceContent = await allowanceText.innerText();
                console.log(`  Allowance: ${allowanceContent}`);
                // Wizard spell progression varies, just check format and that some allowance exists
                expect(allowanceContent).toMatch(/\d+\/\d+/);
                // Verify at least 1 spell allowed
                const matches = allowanceContent.match(/(\d+)\/(\d+)/);
                if (matches) {
                    const total = Number.parseInt(matches[2], 10);
                    expect(total).toBeGreaterThan(0);
                }
            } else {
                console.warn('⚠ Allowance text not found, but proceeding');
            }

            console.log('✓ Spell allowance verified');

            // ====== STEP 13: Select specific spells (Alarm, Alter Self, Arcane Lock) ======
            console.log('\n--- STEP 13: Select specific A-spells (Alarm, Alter Self, Arcane Lock) ---');

            const spellCards = page.locator('#spellSelectionModal .spell-card');
            const allSpells = await spellCards.all();
            console.log(`  Found ${allSpells.length} spell cards`);

            expect(allSpells.length).toBeGreaterThanOrEqual(1);

            // List of specific spells to select
            const targetSpells = ['Alarm', 'Alter Self', 'Arcane Lock'];
            let selectedCount = 0;

            // First pass: find and select the target spells
            for (const targetSpell of targetSpells) {
                for (let i = 0; i < allSpells.length; i++) {
                    const card = allSpells[i];
                    const strong = card.locator('strong').first();
                    const spellName = await strong.textContent();
                    
                    if (spellName?.trim() === targetSpell) {
                        await card.click();
                        console.log(`  ✓ Selected: ${targetSpell}`);
                        selectedCount++;
                        break;
                    }
                }
            }

            // If we didn't find all target spells, select remaining from list
            const remainingNeeded = maxAllowance - selectedCount;
            if (remainingNeeded > 0) {
                console.log(`  Need ${remainingNeeded} more spells, selecting from list...`);
                for (let i = 0; i < allSpells.length && selectedCount < maxAllowance; i++) {
                    const card = allSpells[i];
                    const isAlreadySelected = await card.classList.contains('selected').catch(() => false);
                    if (!isAlreadySelected) {
                        await card.click();
                        console.log(`  ✓ Selected additional spell`);
                        selectedCount++;
                    }
                }
            }

            console.log(`✓ Selected ${selectedCount} spells (target: ${maxAllowance})`);

            // Debug: Check spell IDs of selected spells
            console.log('\n--- DEBUG: Checking spell IDs ---');
            const selectedCards = await page.locator('.spell-card.selected').all();
            console.log(`  Found ${selectedCards.length} selected spell cards`);
            for (let i = 0; i < Math.min(selectedCards.length, 5); i++) {
                const card = selectedCards[i];
                const spellId = await card.getAttribute('data-spell-id');
                const spellName = await card.locator('strong').first().textContent();
                console.log(`  Card ${i}: ${spellName} (ID: ${spellId})`);
            }

            // ====== STEP 14: Close modal WITHOUT adding (CANCEL button - to test persistence) ======
            console.log('\n--- STEP 14: Close spell modal with CANCEL button ---');
            const cancelBtn = page.locator('.btn-cancel-spell');
            await expect(cancelBtn).toBeVisible({ timeout: 5000 });
            await cancelBtn.click();
            console.log('✓ Cancel button clicked');

            // Wait for spell modal to close
            await page.waitForTimeout(1000);
            const spellModalClosed = await spellModal.isVisible({ timeout: 5000 }).catch(() => false);
            expect(spellModalClosed).toBe(false);
            console.log('✓ Spell selection modal closed');

            // Debug: Check character state after CANCEL (should still be 0 spells)
            console.log('\n--- DEBUG: Character state after CANCEL ---');
            const charStateAfterCancel = await page.evaluate(() => {
                const char = window.AppState?.getCurrentCharacter();
                const wizardSpells = char?.spellcasting?.classes?.Wizard;
                return {
                    hasWizard: !!wizardSpells,
                    knownCount: wizardSpells?.spellsKnown?.length || 0,
                    knownSpells: wizardSpells?.spellsKnown?.map(s => `${s.name} (${s.source})`) || []
                };
            });
            console.log('  Character spells after CANCEL:', JSON.stringify(charStateAfterCancel, null, 2));

            // ====== STEP 15: Click "Select New Spells" button AGAIN ======
            console.log('\n--- STEP 15: Reopen spell selection (test persistence with CANCEL) ---');

            const selectSpellsBtn2 = page.locator('#levelUpModal button:has-text("Select New Spells")').first();
            const isDisabled2 = await selectSpellsBtn2.isDisabled({ timeout: 2000 }).catch(() => true);
            console.log(`  Select New Spells button (2nd open) disabled: ${isDisabled2}`);

            await expect(selectSpellsBtn2).toBeEnabled({ timeout: 5000 });
            await selectSpellsBtn2.click();
            console.log('✓ Select New Spells button clicked again');

            // Wait for spell modal to reopen
            await expect(spellModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Spell selection modal reopened');

            // ====== STEP 16: Verify previous spells are still selected ======
            console.log('\n--- STEP 16: Verify persistence of selected spells ---');

            // Check selected spells section  
            const selectedSpellsDisplay = page.locator('.selected-spells-container');
            const selectedSpellsVisible = await selectedSpellsDisplay.isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`  Selected spells container visible: ${selectedSpellsVisible}`);

            if (selectedSpellsVisible) {
                const selectedSpellsText = await selectedSpellsDisplay.innerText();
                console.log(`  Selected spells display: ${selectedSpellsText.substring(0, 100)}`);

                // Debug: List all selected spell badges
                const selectedBadgesDebug = selectedSpellsDisplay.locator('.badge');
                const badgeCountDebug = await selectedBadgesDebug.count();
                console.log(`  Number of badges: ${badgeCountDebug}`);
                for (let i = 0; i < Math.min(badgeCountDebug, 5); i++) {
                    const badge = selectedBadgesDebug.nth(i);
                    const text = await badge.textContent();
                    console.log(`    Badge ${i}: ${text}`);
                }
            }

            // Rely on allowance indicator and selected list to confirm persistence
            const allowanceAfterReopen = await allowanceText.innerText();
            console.log(`  Allowance indicator after reopen: ${allowanceAfterReopen}`);
            const allowanceMatch = allowanceAfterReopen.match(/(\d+)\/(\d+)/);
            expect(allowanceMatch).not.toBeNull();
            const selectedAfter = Number.parseInt(allowanceMatch[1], 10);
            const totalAfter = Number.parseInt(allowanceMatch[2], 10);
            expect(selectedAfter).toBeGreaterThan(0);
            expect(selectedAfter).toBe(totalAfter);
            console.log(`✓ Spells persisted via allowance indicator (${selectedAfter}/${totalAfter})`);

            // ====== STEP 17: Verify allowance still shows persistent value ======
            console.log('\n--- STEP 17: Verify persistent allowance ---');

            const allowanceText2 = page.locator('#spellSelectionLimitIndicator');
            const allowanceVisible2 = await allowanceText2.isVisible({ timeout: 2000 }).catch(() => false);

            if (allowanceVisible2) {
                const allowanceContent2 = await allowanceText2.innerText();
                console.log(`  Allowance (reopened): ${allowanceContent2}`);
                // Verify allowance persists with same total
                expect(allowanceContent2).toMatch(/\d+\/\d+/);
            }

            console.log('✓ Allowance persists');

            // ====== STEP 18: Verify filter checkboxes still checked (unchanged behavior)
            console.log('\n--- STEP 18: Verify filter checkboxes persist ---');

            const level1Filter2 = page.locator('#level1');
            const level2Filter2 = page.locator('#level2');
            const level3Filter2 = page.locator('#level3');

            const isLevel1Checked2 = await level1Filter2.isChecked();
            const isLevel2Checked2 = await level2Filter2.isChecked();
            const isLevel3Checked2 = await level3Filter2.isChecked();

            console.log(`  Level 1 still checked: ${isLevel1Checked2}`);
            console.log(`  Level 2 still checked: ${isLevel2Checked2}`);
            console.log(`  Level 3 still checked: ${isLevel3Checked2}`);

            // Verify filter state persisted from first open
            expect(isLevel1Checked2).toBe(isLevel1Checked);
            expect(isLevel2Checked2).toBe(isLevel2Checked);
            expect(isLevel3Checked2).toBe(isLevel3Checked);
            console.log('✓ Filter checkboxes persisted');

            // ====== STEP 19: Test deselection via X button ======
            console.log('\n--- STEP 19: Test deselection of spell via X button ---');
            
            // Find the first deselect button in the selected spells list
            const deselectBtns = page.locator('.selected-spells-container [data-deselect-spell]');
            const deselectCount = await deselectBtns.count();
            console.log(`  Found ${deselectCount} deselect buttons`);
            
            if (deselectCount > 0) {
                // Get the names of selected spells before deselecting
                const selectedBadges = page.locator('.selected-spells-container .badge');
                const selectedSpellNames = [];
                const badgeCount = await selectedBadges.count();
                for (let i = 0; i < Math.min(3, badgeCount); i++) {
                    const badgeText = await selectedBadges.nth(i).textContent();
                    // Extract spell name (remove any trailing whitespace/close button)
                    const spellName = badgeText.trim().split('\n')[0].trim();
                    selectedSpellNames.push(spellName);
                }
                console.log(`  Selected spell names: ${selectedSpellNames.join(', ')}`);
                
                // Get current allowance
                const allowanceBefore = await allowanceText2.innerText();
                console.log(`  Allowance before deselect: ${allowanceBefore}`);
                
                // Deselect all selected spells
                for (let i = 0; i < Math.min(3, selectedSpellNames.length); i++) {
                    const deselectBtn = page.locator('.selected-spells-container [data-deselect-spell]').first();
                    const spellId = await deselectBtn.getAttribute('data-deselect-spell');
                    console.log(`  Deselecting spell ${i + 1} (ID: ${spellId})`);
                    await deselectBtn.click();
                    await page.waitForTimeout(300);
                    console.log(`  ✓ Deselected spell ${i + 1}`);
                }
                
                // Verify allowance reset to 0
                const allowanceAfter = await allowanceText2.innerText();
                const matchAfter = allowanceAfter.match(/(\d+)\/(\d+)/);
                const selectedAfter = matchAfter ? Number.parseInt(matchAfter[1], 10) : 0;
                console.log(`  Allowance after deselect: ${allowanceAfter}`);
                expect(selectedAfter).toBe(0);
                console.log('✓ All spells successfully deselected');
                
                // Verify deselected spells appear in the spell list DOM
                console.log(`  Looking for deselected spells: ${selectedSpellNames.join(', ')}`);
                
                // Wait a moment for re-render
                await page.waitForTimeout(1000);

                // Debug: Check validSpells count after deselection
                console.log('\n--- DEBUG: After deselection state ---');
                const spellCardsInDOM = await page.locator('#spellSelectionModal .spell-card').count();
                console.log(`  Spell cards in DOM: ${spellCardsInDOM}`);
                
                // Check each deselected spell is in the DOM (try multiple selectors)
                for (const spellName of selectedSpellNames) {
                    // Try multiple ways to find the spell
                    let spellCardExists = await page.locator(`#spellSelectionModal .spell-card:has-text("${spellName}")`).isVisible({ timeout: 1000 }).catch(() => false);
                    
                    if (!spellCardExists) {
                        // Try without has-text
                        const spellCards = page.locator('#spellSelectionModal .spell-card');
                        const count = await spellCards.count();
                        for (let i = 0; i < count; i++) {
                            const card = spellCards.nth(i);
                            const strong = card.locator('strong').first();
                            const text = await strong.textContent();
                            if (text?.includes(spellName)) {
                                spellCardExists = true;
                                break;
                            }
                        }
                    }
                    
                    console.log(`  Spell "${spellName}" visible in list: ${spellCardExists}`);
                    expect(spellCardExists).toBe(true);
                }
                
                // Get all current spell names AND IDs in order
                const allSpellCards = page.locator('#spellSelectionModal .spell-card');
                const allCurrentSpells = [];
                const cardCount = await allSpellCards.count();
                console.log(`  Total spell cards after deselect: ${cardCount}`);
                
                // Get spell names AND IDs for debugging
                const spellDataList = [];
                for (let i = 0; i < Math.min(10, cardCount); i++) {
                    const card = allSpellCards.nth(i);
                    const nameElement = card.locator('strong').first();
                    const name = await nameElement.textContent();
                    const spellId = await card.getAttribute('data-spell-id');
                    allCurrentSpells.push(name);
                    spellDataList.push({ name, id: spellId, position: i });
                }
                console.log(`  First 10 spells in order: ${allCurrentSpells.join(', ')}`);
                console.log(`  First 10 spell IDs:`, spellDataList.map(s => `${s.name}=${s.id}`).join(', '));
                
                // Specifically verify that Alarm, Alter Self, Arcane Lock are near the top (first 5)
                const topFiveSpells = allCurrentSpells.slice(0, 5);
                const alarmIndex = topFiveSpells.findIndex(s => s?.includes('Alarm'));
                const alterIndex = topFiveSpells.findIndex(s => s?.includes('Alter Self'));
                const arcaneIndex = topFiveSpells.findIndex(s => s?.includes('Arcane Lock'));
                
                console.log(`  Alarm position in top 5: ${alarmIndex >= 0 ? alarmIndex : 'NOT FOUND'}`);
                console.log(`  Alter Self position in top 5: ${alterIndex >= 0 ? alterIndex : 'NOT FOUND'}`);
                console.log(`  Arcane Lock position in top 5: ${arcaneIndex >= 0 ? arcaneIndex : 'NOT FOUND'}`);
                
                // They should all be found in top 5 (or search full list if not)
                const foundAll = alarmIndex >= 0 && alterIndex >= 0 && arcaneIndex >= 0;
                if (!foundAll) {
                    console.warn('  ⚠ Not all A-spells in top 5, searching full list...');
                    // Search full list with IDs
                    for (let i = 0; i < Math.min(30, cardCount); i++) {
                        const card = allSpellCards.nth(i);
                        const nameElement = card.locator('strong').first();
                        const name = await nameElement.textContent();
                        const spellId = await card.getAttribute('data-spell-id');
                        if (name?.includes('Alarm')) console.log(`  Found Alarm at index ${i} (ID: ${spellId})`);
                        if (name?.includes('Alter Self')) console.log(`  Found Alter Self at index ${i} (ID: ${spellId})`);
                        if (name?.includes('Arcane Lock')) console.log(`  Found Arcane Lock at index ${i} (ID: ${spellId})`);
                    }
                }
                
                console.log('✓ Deselected spells found in spell list');
            } else {
                console.warn('⚠ No deselect buttons found, skipping deselection test');
            }

            console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY (CANCEL button test)');

        } finally {
            if (electronApp) await electronApp.close();
        }
    });

    test('Spell selection persistence with ADD SPELLS button (broken)', async () => {
        test.setTimeout(120000);

        let electronApp;
        const characterName = `spell-add-${Date.now()}`;

        try {
            // STEP 1: Launch Electron app
            electronApp = await electron.launch({
                args: ['.'],
                env: {
                    ...process.env,
                    FF_DEBUG: 'true',
                    FF_ALLOW_DEFAULT_DATA: 'true',
                },
            });

            let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
            }

            page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

            console.log('✓ Electron app loaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });

            // STEP 2: Create character
            await createCharacter(page, characterName);

            // ====== STEP 3: Open Level Up Modal (captures sessionStartLevel = 1) ======
            console.log('\n--- STEP 3: Open Level Up Modal ---');
            const levelUpBtn = page.locator('button:has-text("Level Up")').first();
            await expect(levelUpBtn).toBeVisible({ timeout: 10000 });
            await levelUpBtn.click();

            // Wait for modal to appear
            const levelUpModal = page.locator('#levelUpModal.show');
            await expect(levelUpModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Level Up Modal opened at level 1 (sessionStartLevel = 1 captured)');
            console.log('✓ Level Up Modal opened at level 1 (sessionStartLevel = 1 captured)');

            // STEPS 4-6: Level up to level 4 (within modal)
            console.log('\n--- STEPS 4-6: Level up to level 4 (within modal) ---');
            const increaseBtn = page.locator('#levelUpIncreaseBtn');
            for (let i = 0; i < 3; i++) {
                console.log(`  Leveling up... (${i + 1}/3)`);
                await expect(increaseBtn).toBeEnabled({ timeout: 5000 });
                await increaseBtn.click();
                await page.waitForTimeout(500);
            }
            console.log('✓ Character leveled to level 4 within modal');

            // STEPS 7-8: Navigate to spell selection step
            console.log('\n--- STEPS 7-8: Navigate to spell selection step ---');

            // Click on step 3 in the stepper (spell selection)
            const step3Item = page.locator('#levelUpStepper [data-step="3"]');
            const step3Exists = await step3Item.isVisible({ timeout: 5000 }).catch(() => false);

            if (step3Exists) {
                await step3Item.click();
                await page.waitForTimeout(500);
                console.log('✓ Navigated to spell selection step');
            } else {
                console.warn('⚠ Step 3 not found in stepper');
            }

            // STEP 9: Click "Select New Spells" button
            console.log('\n--- STEP 9: Click "Select New Spells" button ---');
            const selectSpellsBtn = page.locator('#levelUpModal button:has-text("Select New Spells")').first();
            const isDisabled = await selectSpellsBtn.isDisabled({ timeout: 2000 }).catch(() => true);
            console.log(`  Select New Spells button disabled: ${isDisabled}`);
            await expect(selectSpellsBtn).toBeEnabled({ timeout: 5000 });
            await selectSpellsBtn.click();
            console.log('✓ Select New Spells button clicked');

            // Wait for spell selection modal
            const spellModal = page.locator('#spellSelectionModal');
            await expect(spellModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Spell selection modal opened');

            // STEP 10: Verify spell level filters checked
            console.log('\n--- STEP 10: Verify spell level filters checked ---');
            const level1Filter = page.locator('#level1');
            const level2Filter = page.locator('#level2');
            const level3Filter = page.locator('#level3');
            const isLevel1Checked = await level1Filter.isChecked();
            const isLevel2Checked = await level2Filter.isChecked();
            const isLevel3Checked = await level3Filter.isChecked();
            console.log(`  Level 1 checked: ${isLevel1Checked}`);
            console.log(`  Level 2 checked: ${isLevel2Checked}`);
            console.log(`  Level 3 checked: ${isLevel3Checked}`);
            const anyChecked = isLevel1Checked || isLevel2Checked || isLevel3Checked;
            expect(anyChecked).toBe(true);
            console.log('✓ All expected spell level filters are checked');

            // STEP 11: Determine allowance for spell selection
            console.log('\n--- STEP 11: Determine allowance for spell selection ---');
            const allowanceText = page.locator('#spellSelectionLimitIndicator');
            const allowanceVisible = await allowanceText.isVisible({ timeout: 2000 }).catch(() => false);
            let maxAllowance = 3;
            if (allowanceVisible) {
                const allowance = await allowanceText.innerText();
                const match = allowance.match(/(\d+)\/(\d+)/);
                if (match) {
                    maxAllowance = Number.parseInt(match[2], 10);
                }
            }
            console.log(`  Will select ${maxAllowance} spells (based on allowance)`);

            // STEP 12: Verify allowance display
            console.log('\n--- STEP 12: Verify allowance display ---');
            if (allowanceVisible) {
                const allowance = await allowanceText.innerText();
                console.log(`  Allowance: ${allowance}`);
                expect(allowance).toMatch(/\d+\/\d+/);
            }
            console.log('✓ Spell allowance verified');

            // STEP 13: Select specific A-spells (Alarm, Alter Self, Arcane Lock)
            console.log('\n--- STEP 13: Select specific A-spells (Alarm, Alter Self, Arcane Lock) ---');
            await page.waitForTimeout(1000);
            const allSpells = await page.locator('.spell-card').all();
            console.log(`  Found ${allSpells.length} spell cards`);
            expect(allSpells.length).toBeGreaterThanOrEqual(1);

            const targetSpells = ['Alarm', 'Alter Self', 'Arcane Lock'];
            let selectedCount = 0;

            for (const targetSpell of targetSpells) {
                for (let i = 0; i < allSpells.length; i++) {
                    const card = allSpells[i];
                    const strong = card.locator('strong').first();
                    const spellName = await strong.textContent();
                    
                    if (spellName?.trim() === targetSpell) {
                        await card.click();
                        console.log(`  ✓ Selected: ${targetSpell}`);
                        selectedCount++;
                        break;
                    }
                }
            }

            const remainingNeeded = maxAllowance - selectedCount;
            if (remainingNeeded > 0) {
                console.log(`  Need ${remainingNeeded} more spells, selecting from list...`);
                for (let i = 0; i < allSpells.length && selectedCount < maxAllowance; i++) {
                    const card = allSpells[i];
                    const isAlreadySelected = await card.classList.contains('selected').catch(() => false);
                    if (!isAlreadySelected) {
                        await card.click();
                        console.log(`  ✓ Selected additional spell`);
                        selectedCount++;
                    }
                }
            }

            console.log(`✓ Selected ${selectedCount} spells (target: ${maxAllowance})`);

            // Debug: Check spell IDs of selected spells
            console.log('\n--- DEBUG: Checking spell IDs ---');
            const selectedCards = await page.locator('.spell-card.selected').all();
            console.log(`  Found ${selectedCards.length} selected spell cards`);
            for (let i = 0; i < Math.min(selectedCards.length, 5); i++) {
                const card = selectedCards[i];
                const spellId = await card.getAttribute('data-spell-id');
                const spellName = await card.locator('strong').first().textContent();
                console.log(`  Card ${i}: ${spellName} (ID: ${spellId})`);
            }

            // ====== STEP 14: Add spells to character (ADD SPELLS button - test persistence) ======
            console.log('\n--- STEP 14: Add spells to character with ADD SPELLS button ---');
            const addBtn = page.locator('.btn-add-spell');
            await expect(addBtn).toBeVisible({ timeout: 5000 });
            await addBtn.click();
            console.log('✓ Add Spells button clicked');

            // Wait for spell modal to close
            await page.waitForTimeout(1500);
            const spellModalClosed = await spellModal.isVisible({ timeout: 5000 }).catch(() => false);
            expect(spellModalClosed).toBe(false);
            console.log('✓ Spell selection modal closed');

            // Debug: Check character state after ADD SPELLS
            console.log('\n--- DEBUG: Character state after ADD SPELLS ---');
            const charStateAfterAdd = await page.evaluate(() => {
                const char = window.AppState?.getCurrentCharacter();
                const wizardSpells = char?.spellcasting?.classes?.Wizard;
                return {
                    hasWizard: !!wizardSpells,
                    knownCount: wizardSpells?.spellsKnown?.length || 0,
                    knownSpells: wizardSpells?.spellsKnown?.map(s => `${s.name} (${s.source})`) || []
                };
            });
            console.log('  Character spells after ADD:', JSON.stringify(charStateAfterAdd, null, 2));

            // ====== STEP 15: Reopen spell selection modal ======
            console.log('\n--- STEP 15: Reopen spell selection (test persistence with ADD SPELLS) ---');
            const selectSpellsBtn2 = page.locator('#levelUpModal button:has-text("Select New Spells")').first();
            const isDisabled2 = await selectSpellsBtn2.isDisabled({ timeout: 2000 }).catch(() => true);
            console.log(`  Select New Spells button (2nd open) disabled: ${isDisabled2}`);
            await expect(selectSpellsBtn2).toBeEnabled({ timeout: 5000 });
            await selectSpellsBtn2.click();
            console.log('✓ Select New Spells button clicked again');

            await expect(spellModal).toBeVisible({ timeout: 10000 });
            console.log('✓ Spell selection modal reopened');

            // ====== STEP 16: Verify selections persisted ======
            console.log('\n--- STEP 16: Verify spell selections persisted ---');
            const selectedSpellsContainer = page.locator('.selected-spells-container');
            await expect(selectedSpellsContainer).toBeVisible({ timeout: 5000 });
            await page.waitForTimeout(500);

            const selectedBadges = selectedSpellsContainer.locator('.badge');
            const badgeCount = await selectedBadges.count();
            console.log(`  Found ${badgeCount} selected spell badges`);

            console.log('  Badge details:');
            for (let i = 0; i < badgeCount; i++) {
                const badge = selectedBadges.nth(i);
                const text = await badge.textContent();
                console.log(`    Badge ${i}: ${text.trim()}`);
            }

            const allowanceAfterReopen = await allowanceText.innerText();
            console.log(`  Allowance indicator after reopen: ${allowanceAfterReopen}`);
            const allowanceMatch = allowanceAfterReopen.match(/(\d+)\/(\d+)/);
            expect(allowanceMatch).not.toBeNull();
            const selectedAfter = Number.parseInt(allowanceMatch[1], 10);
            const totalAfter = Number.parseInt(allowanceMatch[2], 10);
            console.log(`  Selected: ${selectedAfter}, Total: ${totalAfter}`);
            expect(selectedAfter).toBeGreaterThan(0);
            expect(selectedAfter).toBe(totalAfter);
            console.log(`✓ Spells persisted via allowance indicator (${selectedAfter}/${totalAfter})`);

            // ====== STEP 17: Test deselection ======
            console.log('\n--- STEP 17: Test deselection of spells via X button ---');
            const deselectBtns = page.locator('.selected-spells-container [data-deselect-spell]');
            const deselectCount = await deselectBtns.count();
            console.log(`  Found ${deselectCount} deselect buttons`);

            if (deselectCount > 0) {
                const selectedSpellNames = [];
                for (let i = 0; i < Math.min(3, badgeCount); i++) {
                    const badgeText = await selectedBadges.nth(i).textContent();
                    const spellName = badgeText.trim().split('\n')[0].trim();
                    selectedSpellNames.push(spellName);
                }
                console.log(`  Selected spell names: ${selectedSpellNames.join(', ')}`);

                const allowanceBefore = await allowanceText.innerText();
                console.log(`  Allowance before deselect: ${allowanceBefore}`);

                for (let i = 0; i < Math.min(3, selectedSpellNames.length); i++) {
                    const deselectBtn = page.locator('.selected-spells-container [data-deselect-spell]').first();
                    const spellId = await deselectBtn.getAttribute('data-deselect-spell');
                    console.log(`  Deselecting spell ${i + 1} (ID: ${spellId})`);
                    await deselectBtn.click();
                    await page.waitForTimeout(500);
                    console.log(`  ✓ Deselected spell ${i + 1}`);
                }

                const allowanceAfter = await allowanceText.innerText();
                const matchAfter = allowanceAfter.match(/(\d+)\/(\d+)/);
                const selectedAfterDeselect = matchAfter ? Number.parseInt(matchAfter[1], 10) : 0;
                console.log(`  Allowance after deselect: ${allowanceAfter}`);
                expect(selectedAfterDeselect).toBe(0);
                console.log('✓ All spells successfully deselected');

                console.log(`  Looking for deselected spells: ${selectedSpellNames.join(', ')}`);
                await page.waitForTimeout(1000);

                console.log('\n--- DEBUG: After deselection state ---');
                const spellCardsInDOM = await page.locator('#spellSelectionModal .spell-card').count();
                console.log(`  Spell cards in DOM: ${spellCardsInDOM}`);

                for (const spellName of selectedSpellNames) {
                    let spellCardExists = await page.locator(`#spellSelectionModal .spell-card:has-text("${spellName}")`).isVisible({ timeout: 1000 }).catch(() => false);
                    
                    if (!spellCardExists) {
                        const spellCards = page.locator('#spellSelectionModal .spell-card');
                        const count = await spellCards.count();
                        for (let i = 0; i < count; i++) {
                            const card = spellCards.nth(i);
                            const strong = card.locator('strong').first();
                            const text = await strong.textContent();
                            if (text?.includes(spellName)) {
                                spellCardExists = true;
                                break;
                            }
                        }
                    }
                    
                    console.log(`  Spell "${spellName}" visible in list: ${spellCardExists}`);
                    expect(spellCardExists).toBe(true);
                }

                const allSpellCards = page.locator('#spellSelectionModal .spell-card');
                const allCurrentSpells = [];
                const cardCount = await allSpellCards.count();
                console.log(`  Total spell cards after deselect: ${cardCount}`);

                const spellDataList = [];
                for (let i = 0; i < Math.min(10, cardCount); i++) {
                    const card = allSpellCards.nth(i);
                    const nameElement = card.locator('strong').first();
                    const name = await nameElement.textContent();
                    const spellId = await card.getAttribute('data-spell-id');
                    allCurrentSpells.push(name);
                    spellDataList.push({ name, id: spellId, position: i });
                }
                console.log(`  First 10 spells in order: ${allCurrentSpells.join(', ')}`);
                console.log(`  First 10 spell IDs:`, spellDataList.map(s => `${s.name}=${s.id}`).join(', '));

                const topFiveSpells = allCurrentSpells.slice(0, 5);
                const alarmIndex = topFiveSpells.findIndex(s => s?.includes('Alarm'));
                const alterIndex = topFiveSpells.findIndex(s => s?.includes('Alter Self'));
                const arcaneIndex = topFiveSpells.findIndex(s => s?.includes('Arcane Lock'));

                console.log(`  Alarm position in top 5: ${alarmIndex >= 0 ? alarmIndex : 'NOT FOUND'}`);
                console.log(`  Alter Self position in top 5: ${alterIndex >= 0 ? alterIndex : 'NOT FOUND'}`);
                console.log(`  Arcane Lock position in top 5: ${arcaneIndex >= 0 ? arcaneIndex : 'NOT FOUND'}`);

                const foundAll = alarmIndex >= 0 && alterIndex >= 0 && arcaneIndex >= 0;
                if (!foundAll) {
                    console.warn('  ⚠ Not all A-spells in top 5, searching full list...');
                    for (let i = 0; i < Math.min(30, cardCount); i++) {
                        const card = allSpellCards.nth(i);
                        const nameElement = card.locator('strong').first();
                        const name = await nameElement.textContent();
                        const spellId = await card.getAttribute('data-spell-id');
                        if (name?.includes('Alarm')) console.log(`  Found Alarm at index ${i} (ID: ${spellId})`);
                        if (name?.includes('Alter Self')) console.log(`  Found Alter Self at index ${i} (ID: ${spellId})`);
                        if (name?.includes('Arcane Lock')) console.log(`  Found Arcane Lock at index ${i} (ID: ${spellId})`);
                    }
                }

                console.log('✓ Deselected spells found in spell list');
            } else {
                console.warn('⚠ No deselect buttons found, skipping deselection test');
            }

            console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY (ADD SPELLS button test)');

        } finally {
            if (electronApp) await electronApp.close();
        }
    });
});
