import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Test: Wizard spell selection respects level-specific spell availability
 * 
 * When leveling Wizard 1→5 in a single session, selecting spells for level 1
 * should only show cantrips and 1st-level spells, not spells available at the
 * final level (3rd-level).
 * 
 * Also verifies that cantrips are tracked separately from leveled spells with
 * proper counts in the modal title.
 */
test('wizard spell selection for level 1 should only show 1st-level spells, not 3rd-level', async () => {
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

        // Step 5: Open level-up modal multiple times to reach level 5
        console.log('Leveling character from 1 to 5...');

        for (let targetLevel = 2; targetLevel <= 5; targetLevel++) {
            console.log(`Leveling to ${targetLevel}...`);

            // Click level-up button in titlebar
            const levelUpBtn = page.locator('[data-level-up-btn]');
            await levelUpBtn.click();
            await page.waitForTimeout(500);

            // Wait for level-up modal
            await page.waitForSelector('#levelUpModal.show', { timeout: 5000 });

            // Select same class (Wizard)
            await page.waitForSelector('[data-class-option="Wizard"]', { timeout: 5000 });
            await page.locator('[data-class-option="Wizard"]').click();
            await page.waitForTimeout(500);

            // Navigate through steps without making selections
            // (we'll test spell selection separately)
            const nextBtn = page.locator('#levelUpModal button:has-text("Next")');

            // Navigate to spells step (Step 3)
            // Step 0: Overview → Next
            await nextBtn.click();
            await page.waitForTimeout(300);

            // Step 1: Class Features (may or may not have features) → Next
            await nextBtn.click();
            await page.waitForTimeout(300);

            // Step 2: Ability Score / Feat (skip if not at ASI level)
            const step2Title = await page.locator('#levelUpModal .level-up-step.active h5').textContent();
            if (step2Title?.includes('Ability Score') || step2Title?.includes('Feat')) {
                await nextBtn.click();
                await page.waitForTimeout(300);
            }

            // Now we should be at Step 3: Spells
            await page.waitForSelector('.step-3-spell-selection', { timeout: 5000 });

            // Find the spell selection button for level 1 (first button)
            const spellButtons = page.locator('[data-open-spell-selector]');
            const firstButton = spellButtons.first();

            // Get the data attributes to verify it's for level 1
            const levelAttr = await firstButton.getAttribute('data-level');
            console.log(`Opening spell selector for level ${levelAttr}...`);

            if (levelAttr === '1') {
                // Click to open spell selector
                await firstButton.click();
                await page.waitForTimeout(1000);

                // Wait for LevelUpSelector modal
                await page.waitForSelector('#levelUpSelectorModal.show', { timeout: 5000 });

                // Check modal title - should show cantrips and 1st-level spells
                const modalTitle = await page.locator('#levelUpSelectorModal .modal-title').textContent();
                console.log(`Modal title: ${modalTitle}`);

                // Title should mention cantrips and 1st-level spells
                expect(modalTitle).toContain('cantrip');
                expect(modalTitle).toContain('1st-level');

                // Switch to 2nd level tab and verify no spells are shown
                const secondLevelTab = page.locator('#levelUpSelectorModal [data-selector-tab][data-tab-value="2"]');
                if (await secondLevelTab.isVisible()) {
                    await secondLevelTab.click();
                    await page.waitForTimeout(500);

                    // Check if any spell cards are visible
                    const spellCards = page.locator('#levelUpSelectorModal [data-selector-item-card]');
                    const cardCount = await spellCards.count();
                    console.log(`Number of 2nd-level spells shown: ${cardCount}`);
                    expect(cardCount).toBe(0); // Should be 0 since wizard at level 1 can't access 2nd-level spells
                }

                // Switch to 3rd level tab and verify no spells are shown
                const thirdLevelTab = page.locator('#levelUpSelectorModal [data-selector-tab][data-tab-value="3"]');
                if (await thirdLevelTab.isVisible()) {
                    await thirdLevelTab.click();
                    await page.waitForTimeout(500);

                    const spellCards = page.locator('#levelUpSelectorModal [data-selector-item-card]');
                    const cardCount = await spellCards.count();
                    console.log(`Number of 3rd-level spells shown: ${cardCount}`);
                    expect(cardCount).toBe(0); // Should be 0 since wizard at level 1 can't access 3rd-level spells
                }

                // Switch back to cantrips tab and verify spells are shown
                const cantripsTab = page.locator('#levelUpSelectorModal [data-selector-tab][data-tab-value="0"]');
                await cantripsTab.click();
                await page.waitForTimeout(500);

                const cantripCards = page.locator('#levelUpSelectorModal [data-selector-item-card]');
                const cantripCount = await cantripCards.count();
                console.log(`Number of cantrips shown: ${cantripCount}`);
                expect(cantripCount).toBeGreaterThan(0); // Should have cantrips available

                // Cancel the spell selector
                const cancelBtn = page.locator('#levelUpSelectorModal button:has-text("Cancel")');
                await cancelBtn.click();
                await page.waitForTimeout(500);
            }

            // Cancel the level-up modal
            const modalCancelBtn = page.locator('#levelUpModal button:has-text("Cancel")');
            await modalCancelBtn.click();
            await page.waitForTimeout(500);

            // Only test level 1 spell selection once
            if (levelAttr === '1') {
                console.log('Test complete - level 1 spell filtering verified!');
                break;
            }
        }

    } finally {
        await electronApp.close();
    }
});
