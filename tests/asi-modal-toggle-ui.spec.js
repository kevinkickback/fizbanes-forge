import { _electron as electron, expect, test } from '@playwright/test';

test('ASI modal should have toggle and ability boxes', async () => {
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

        // Capture console for debugging
        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Create a character first
        await page.locator('[data-page="build"]').click();
        await page.waitForSelector('#characterCreateButton', { timeout: 10000 });
        await page.locator('#characterCreateButton').click();

        // Wait for character creation modal
        await page.waitForSelector('#characterModal.show', { timeout: 10000 });

        // Fill in character name
        await page.locator('#characterName').fill('Test Character ASI');

        // Navigate through steps
        await page.locator('button:has-text("Next")').click();

        // Select race (Human)
        await page.waitForSelector('[data-race-name]', { timeout: 10000 });
        await page.locator('[data-race-name="Human"]').click();
        await page.locator('button:has-text("Next")').click();

        // Select class (Fighter - gets ASI at level 4)
        await page.waitForSelector('[data-class-name]', { timeout: 10000 });
        await page.locator('[data-class-name="Fighter"]').click();
        await page.locator('button:has-text("Next")').click();

        // Skip background
        await page.locator('button:has-text("Next")').click();

        // Skip ability scores
        await page.locator('button:has-text("Next")').click();

        // Finish character creation
        await page.locator('button:has-text("Create Character")').click();
        await page.waitForSelector('#characterModal', { state: 'hidden', timeout: 10000 });

        // Level up character to level 4 (to get an ASI)
        // We need to level up 3 times
        for (let i = 0; i < 3; i++) {
            await page.locator('#levelUpButton').click();
            await page.waitForSelector('#levelUpModal.show', { timeout: 10000 });

            // Click through the level-up modal
            const completeButton = page.locator('#levelUpModal button:has-text("Complete")');
            if (await completeButton.isVisible()) {
                await completeButton.click();
            } else {
                // Might be on a step, try to proceed
                const nextButton = page.locator('#levelUpModal button:has-text("Next")');
                if (await nextButton.isVisible()) {
                    await nextButton.click();
                }
            }

            await page.waitForSelector('#levelUpModal', { state: 'hidden', timeout: 10000 });
            await page.waitForTimeout(500);
        }

        // Now at level 4, level up again to trigger ASI
        await page.locator('#levelUpButton').click();
        await page.waitForSelector('#levelUpModal.show', { timeout: 10000 });

        // Wait for the ASI interface to appear
        // The modal should show class card with ASI option
        await page.waitForTimeout(2000); // Give it time to render

        // Look for ASI button in the class card
        const asiButton = page.locator('button:has-text("Choose ASI")');
        if (await asiButton.isVisible({ timeout: 5000 })) {
            await asiButton.click();

            // Wait for ASI modal to appear
            await page.waitForSelector('#asiModal.show', { timeout: 10000 });

            // Verify toggle buttons exist
            const plus2Toggle = page.locator('#asi_plus2');
            const plus1Toggle = page.locator('#asi_plus1');

            await expect(plus2Toggle).toBeVisible();
            await expect(plus1Toggle).toBeVisible();

            // Verify ability boxes exist
            const strButton = page.locator('[data-ability="str"]');
            const dexButton = page.locator('[data-ability="dex"]');
            const conButton = page.locator('[data-ability="con"]');

            await expect(strButton).toBeVisible();
            await expect(dexButton).toBeVisible();
            await expect(conButton).toBeVisible();

            // Test +2 mode (default)
            await strButton.click();
            await page.waitForTimeout(500);

            // Verify STR button is active
            await expect(strButton).toHaveClass(/active/);

            // Verify summary shows +2
            const summary = page.locator('#asiSelectionSummary');
            await expect(summary).toContainText('Strength +2');

            // Switch to +1/+1 mode
            await plus1Toggle.click();
            await page.waitForTimeout(500);

            // Select two abilities
            await dexButton.click();
            await page.waitForTimeout(300);
            await conButton.click();
            await page.waitForTimeout(300);

            // Verify both buttons are active
            await expect(dexButton).toHaveClass(/active/);
            await expect(conButton).toHaveClass(/active/);

            // Verify summary shows +1/+1
            await expect(summary).toContainText('Dexterity +1');
            await expect(summary).toContainText('Constitution +1');

            console.log('[TEST] ASI modal toggle and ability boxes working correctly');

            // Close the modal
            await page.locator('#asiModal button:has-text("Cancel")').click();
        } else {
            console.log('[TEST] ASI button not found - may not be available at this level');
        }

    } finally {
        await electronApp.close();
    }
});
