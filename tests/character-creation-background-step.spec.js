import { _electron as electron, expect, test } from '@playwright/test';

test('character creation includes background step', async () => {
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

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        console.log('✓ App loaded');

        // Click "New Character" button
        await page.locator('button:has-text("New Character")').click();
        console.log('✓ Clicked New Character');

        // Wait for modal to appear
        await page.waitForSelector('#newCharacterModal.show', { timeout: 10000 });
        console.log('✓ Modal opened');

        // Verify all stepper items are present
        const stepperItems = await page.locator('#newCharacterStepper .list-group-item').count();
        console.log('Stepper items count:', stepperItems);
        expect(stepperItems).toBe(6); // Should have 6 steps now

        // Verify step labels
        const stepLabels = await page.locator('#newCharacterStepper .list-group-item').allTextContents();
        const normalizedLabels = stepLabels.map(label => label.trim().replace(/\s+/g, ' '));
        const labelsText = normalizedLabels.join(',');
        console.log('Step labels text:', labelsText);
        console.log('Contains Basics:', labelsText.includes('Basics'));
        console.log('Contains Background:', labelsText.includes('Background'));
        expect(labelsText).toContain('Basics');
        expect(labelsText).toContain('Rules');
        expect(labelsText).toContain('Race');
        expect(labelsText).toContain('Class');
        expect(labelsText).toContain('Background');
        expect(labelsText).toContain('Review');

        // Step 0: Basics - Fill in name
        await page.waitForSelector('#characterName', { timeout: 10000 });
        await page.locator('#characterName').fill('Test Background');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 0 completed');

        // Step 1: Rules - Just click Next
        await page.waitForSelector('#pointBuy', { timeout: 5000 });
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 1 completed');

        // Step 2: Race - Select Human (PHB)
        await page.waitForSelector('#modalRaceSelect', { timeout: 5000 });
        await page.locator('#modalRaceSelect').selectOption('Human_PHB');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 2 completed - Race: Human (PHB)');

        // Step 3: Class - Select Fighter (PHB)
        await page.waitForSelector('#modalClassSelect', { timeout: 5000 });
        await page.locator('#modalClassSelect').selectOption('Fighter_PHB');
        await page.waitForTimeout(500);
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 3 completed - Class: Fighter (PHB)');

        // Step 4: Background - Verify background step appears
        await page.waitForSelector('#modalBackgroundSelect', { timeout: 5000 });
        console.log('✓ Background step loaded');

        // Verify background dropdown has options
        const backgroundOptions = await page.locator('#modalBackgroundSelect option').count();
        console.log('Background options count:', backgroundOptions);
        expect(backgroundOptions).toBeGreaterThan(1); // More than just placeholder

        // Select a background (Acolyte)
        const acolyteOption = await page.locator('#modalBackgroundSelect option').filter({ hasText: 'Acolyte' }).first();
        if (await acolyteOption.count() > 0) {
            const value = await acolyteOption.getAttribute('value');
            await page.locator('#modalBackgroundSelect').selectOption(value);
            console.log('✓ Selected background: Acolyte');

            // Wait for details to load
            await page.waitForTimeout(500);

            // Verify details are shown
            const detailsContainer = await page.locator('#modalBackgroundDetails').textContent();
            console.log('Background details visible:', !detailsContainer.includes('Select a background to view details'));
            expect(detailsContainer).not.toContain('Select a background to view details');
        }

        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 4 completed - Background');

        // Step 5: Review - Verify background appears in review
        await page.waitForTimeout(2000); // Give more time for step to load

        // Check if review step loaded within the character creation modal
        const modalContent = await page.locator('#newCharacterModal [data-step-content]').textContent();
        console.log('Review includes "Background":', modalContent.includes('Background:'));
        expect(modalContent).toContain('Background:');

        // Verify Next button says "Create"
        const createBtnText = await page.locator('#wizardNextBtn').textContent();
        console.log('Final button text:', createBtnText);
        expect(createBtnText).toBe('Create');

        console.log('✓ All background step assertions passed!');

    } finally {
        await electronApp.close();
    }
});
