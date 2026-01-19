import { _electron as electron, expect, test } from '@playwright/test';

test.describe('ASI Feat Selection Fix', () => {
    test('should properly save selected feat from ASI feature', async () => {
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
            const allWindows = electronApp.windows();
            let page = allWindows.find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
            }

            // Capture console logs
            page.on('console', (msg) => {
                const text = msg.text();
                console.log(`[${msg.type()}] ${text}`);
            });

            // Wait for app to load
            await page.waitForSelector('#pageContent', { timeout: 60000 });

            // Navigate to home
            await page.locator('[data-page="home"]').click();
            await page.waitForTimeout(500);

            // Create a Fighter character
            const newCharacterBtn = page.locator('#newCharacterBtn');
            await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
            await newCharacterBtn.click();

            // Wait for modal
            await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

            // Fill in character name
            const nameInput = page.locator('#newCharacterName');
            await expect(nameInput).toBeVisible({ timeout: 10000 });
            await nameInput.fill('ASI Feat Test Fighter');

            // Navigate through wizard steps
            const nextBtn = page.locator('#wizardNextBtn');
            await expect(nextBtn).toBeVisible({ timeout: 10000 });

            // Step 0 -> 1
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Step 1 (Race) - select Human -> 2
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Step 2 (Class) - select Fighter -> 3
            await nextBtn.click();
            await page.waitForTimeout(500);

            // Step 3 -> Create
            await nextBtn.click();

            // Wait for modal to close
            await page.waitForSelector('#newCharacterModal.show', { state: 'hidden', timeout: 15000 });
            await page.waitForTimeout(1000);

            console.log('✓ Character created');

            // Open the character
            const characterCard = page.locator('.character-card:has-text("ASI Feat Test Fighter")').first();
            await expect(characterCard).toBeVisible({ timeout: 15000 });
            await characterCard.click();
            await page.waitForTimeout(1000);

            // Navigate to build page
            await page.locator('[data-page="build"]').click();
            await page.waitForTimeout(1000);

            // Level up to level 4 (ASI level)
            const levelUpBtn = page.locator('#levelUpBtn');
            await expect(levelUpBtn).toBeVisible();

            // Add 3 levels to reach level 4
            for (let i = 0; i < 3; i++) {
                await levelUpBtn.click();
                await page.waitForSelector('#levelUpModal', { state: 'visible', timeout: 5000 });

                // Click "Add Level" for Fighter
                const addLevelBtn = page.locator('[data-add-level="Fighter"]');
                await expect(addLevelBtn).toBeVisible();
                await addLevelBtn.click();
                await page.waitForTimeout(500);

                // Close modal
                const closeBtn = page.locator('#levelUpModal .btn-close');
                if (await closeBtn.isVisible()) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                }
            }

            console.log('✓ Leveled up to level 4');

            // Verify we're at level 4 and ASI section is visible
            await page.waitForTimeout(1000);
            const classCard = page.locator('#classCard').first();
            await expect(classCard).toBeVisible();

            // Look for the ASI choice section in feature choices
            const asiChoice = page.locator('[data-choice-card*="asi"]').first();
            await expect(asiChoice).toBeVisible({ timeout: 10000 });

            console.log('✓ ASI choice section is visible');

            // Select the "Feat" radio button
            const featRadio = page.locator('[data-feat-radio="4"]');
            await expect(featRadio).toBeVisible();
            await featRadio.click();
            await page.waitForTimeout(500);

            console.log('✓ Selected feat radio button');

            // Click the action button to open feat selector
            const actionBtn = page.locator('[data-asi-action-btn="4"]');
            await expect(actionBtn).toBeVisible();
            await actionBtn.click();

            console.log('✓ Clicked feat selection button');

            // Wait for the feat selector modal to open
            await page.waitForSelector('#levelUpSelectorModal', { state: 'visible', timeout: 10000 });

            console.log('✓ Feat selector modal opened');

            // Find and select a feat (e.g., "Alert")
            const searchInput = page.locator('#levelUpSelectorModal input[type="search"]');
            await searchInput.fill('Alert');
            await page.waitForTimeout(500);

            // Click on the Alert feat item
            const alertFeat = page.locator('#levelUpSelectorModal .list-group-item:has-text("Alert")').first();
            await expect(alertFeat).toBeVisible();
            await alertFeat.click();
            await page.waitForTimeout(500);

            console.log('✓ Selected Alert feat');

            // Confirm selection
            const confirmBtn = page.locator('#levelUpSelectorModal button:has-text("Confirm")');
            await expect(confirmBtn).toBeVisible();
            await confirmBtn.click();

            console.log('✓ Confirmed feat selection');

            // Wait for modal to close and UI to update
            await page.waitForSelector('#levelUpSelectorModal', { state: 'hidden', timeout: 10000 });
            await page.waitForTimeout(2000);

            console.log('✓ Modal closed, checking UI updates');

            // Verify the feat was saved
            // 1. Check that the display text shows "Alert" instead of "None selected"
            const asiChoiceAfter = page.locator('[data-choice-card*="asi"]').first();
            const displayText = await asiChoiceAfter.locator('.text-muted.small').first().textContent();
            console.log(`Display text: "${displayText}"`);
            expect(displayText?.trim()).toContain('Alert');

            // 2. Check that radio buttons are disabled
            const featRadioAfter = page.locator('[data-feat-radio="4"]');
            await expect(featRadioAfter).toBeDisabled();

            const asiRadioAfter = page.locator('[data-asi-radio="4"]');
            await expect(asiRadioAfter).toBeDisabled();

            // 3. Check that the success checkmark is visible
            const successIcon = asiChoiceAfter.locator('.fa-check-circle.text-success');
            await expect(successIcon).toBeVisible();

            console.log('✅ All verifications passed! Feat was properly saved and UI updated.');

        } finally {
            await electronApp.close();
        }
    });
});
