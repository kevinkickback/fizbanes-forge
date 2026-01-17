import { _electron as electron, expect, test } from '@playwright/test';

test('character creation saves race and class selections', async () => {
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
        const logs = [];
        page.on('console', (msg) => {
            logs.push(msg.text());
        });

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        console.log('✓ App loaded');

        // Click "New Character" button
        await page.locator('button:has-text("New Character")').click();
        console.log('✓ Clicked New Character');

        // Wait for modal to appear
        await page.waitForSelector('#newCharacterModal.show', { timeout: 10000 });
        await page.waitForSelector('[data-step-content]', { timeout: 5000 });
        console.log('✓ Modal opened');

        // Step 0 - Basics: Fill in name
        await page.waitForSelector('#characterName', { timeout: 10000 });
        await page.locator('#characterName').fill('Test Character');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 0 completed');

        // Step 1 - Rules: Just click Next
        await page.waitForSelector('#pointBuy', { timeout: 5000 });
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 1 completed');

        // Step 2 - Race: Select Human (PHB)
        await page.waitForSelector('#modalRaceSelect', { timeout: 5000 });
        await page.locator('#modalRaceSelect').selectOption('Human_PHB');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 2 completed - Race: Human (PHB)');

        // Step 3 - Class: Select Cleric (PHB) and Life Domain
        await page.waitForSelector('#modalClassSelect', { timeout: 5000 });
        await page.locator('#modalClassSelect').selectOption('Cleric_PHB');

        // Wait for subclass dropdown to populate
        await page.waitForTimeout(500);

        // Check if subclass dropdown is enabled
        const subclassSelect = page.locator('#modalSubclassSelect');
        const isEnabled = await subclassSelect.isEnabled();
        console.log('Subclass dropdown enabled:', isEnabled);

        if (isEnabled) {
            // Select Life Domain
            const subclassOptions = await subclassSelect.locator('option').allTextContents();
            console.log('Available subclasses:', subclassOptions.length - 1); // -1 for placeholder

            // Find and select Life Domain or Life
            const lifeOption = subclassOptions.find(opt => opt.includes('Life'));
            if (lifeOption) {
                await subclassSelect.selectOption(lifeOption);
                console.log('✓ Selected subclass:', lifeOption);
            }
        }

        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 3 completed - Class: Cleric (PHB)');

        // Step 4 - Review: Create character
        await page.waitForTimeout(1000);

        // Force click the button using JavaScript since Playwright might not see it as visible
        await page.evaluate(() => {
            const btn = document.getElementById('wizardNextBtn');
            if (btn) {
                btn.click();
            }
        });
        console.log('✓ Clicked Create Character');

        // Wait for modal to close
        await page.waitForSelector('#newCharacterModal.show', { state: 'hidden', timeout: 10000 });
        console.log('✓ Modal closed');

        // Wait for character to be saved and page to update
        await page.waitForTimeout(2000);

        // Verify character was created - check the character list on the home page
        const characterCards = await page.locator('.character-card').count();
        console.log('Character cards on page:', characterCards);
        expect(characterCards).toBeGreaterThan(0);

        // Get the character name from the LAST card (newest)
        const lastCard = page.locator('.character-card').last();
        const characterName = await lastCard.locator('h5').textContent();
        console.log('Created character name:', characterName);
        expect(characterName.trim()).toBe('Test Character');

        // Check character card text content for race and class
        const cardText = await lastCard.textContent();
        console.log('=== Character Card Full Text ===');
        console.log(cardText);
        console.log('================================');
        console.log('Contains "Human":', cardText.includes('Human'));
        console.log('Contains "Cleric":', cardText.includes('Cleric'));
        console.log('Contains "No Race":', cardText.includes('No Race'));
        console.log('Contains "No Class":', cardText.includes('No Class'));

        // Verify race and class appear on the card (should NOT be "No Race" or "No Class")
        expect(cardText).toContain('Human');
        expect(cardText).toContain('Cleric');
        expect(cardText).not.toContain('No Race');
        expect(cardText).not.toContain('No Class');

        console.log('✓ All assertions passed!');

    } finally {
        await electronApp.close();
    }
});
