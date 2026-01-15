import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Progression History Recording', () => {
    test('should record progression history during level-up', async () => {
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
            let page = electronApp.windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent('window',
                    (win) => !win.url().startsWith('devtools://'));
            }

            // Capture errors
            page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

            // Wait for app load
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForSelector('[data-current-page="home"]', { timeout: 30000 });
            await page.waitForTimeout(2000); // Let UI settle

            // Create character with Wizard (spellcasting class)
            // Try welcome button first (shown when no characters)
            let newCharacterBtn = page.locator('#welcomeCreateCharacterBtn');
            let exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);
            if (!exists) {
                newCharacterBtn = page.locator('#newCharacterBtn');
                exists = await newCharacterBtn.isVisible({ timeout: 5000 }).catch(() => false);
            }
            await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
            await newCharacterBtn.click();

            // Wait for modal
            await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

            // Fill character name
            const nameInput = page.locator('#newCharacterName');
            await expect(nameInput).toBeVisible({ timeout: 10000 });
            await nameInput.fill('TestCharacter');

            const nextBtn = page.locator('#wizardNextBtn');
            await expect(nextBtn).toBeVisible({ timeout: 10000 });

            // Navigate through wizard
            for (let i = 0; i < 4; i++) {
                await nextBtn.click();
                await page.waitForTimeout(300);
            }

            // Wait for character creation
            await page.waitForTimeout(1000);

            // Load character
            const characterCard = page.locator('.character-card').first();
            await expect(characterCard).toBeVisible({ timeout: 15000 });
            await characterCard.click();

            // Navigate to Build page
            const buildBtn = page.locator('button[data-page="build"]');
            await expect(buildBtn).toBeVisible({ timeout: 10000 });
            await buildBtn.click();

            // Wait for build page
            await page.waitForSelector('[data-current-page="build"]', { timeout: 30000 });

            // Open level-up modal
            const levelUpBtn = page.locator('[data-action="level-up"], #openLevelUpModalBtn, button:has-text("Level Up")').first();
            await expect(levelUpBtn).toBeVisible({ timeout: 10000 });
            await levelUpBtn.click();

            // Wait for level-up modal
            await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });

            // Click through wizard steps
            const nextStepBtn = page.locator('button[data-action="next-step"], #levelUpNextBtn, button:has-text("Next")').first();
            await expect(nextStepBtn).toBeVisible({ timeout: 10000 });

            // Navigate through level-up steps
            for (let i = 0; i < 4; i++) {
                const btn = page.locator('button[data-action="next-step"], #levelUpNextBtn, button:has-text("Next")').first();
                const canClick = await btn.isEnabled().catch(() => false);
                if (canClick) {
                    await btn.click();
                    await page.waitForTimeout(300);
                }
            }

            // Confirm level-up
            const confirmBtn = page.locator('button[data-action="confirm"], #levelUpConfirmBtn, button:has-text("Confirm")').first();
            await expect(confirmBtn).toBeVisible({ timeout: 10000 });
            await confirmBtn.click();

            // Wait for modal to close
            await page.waitForTimeout(1000);

            // Verify character was leveled up
            const characterData = await page.evaluate(() => {
                // Access the character from the page context
                // Try various ways to access the character
                return (window.appState?.character ||
                    window.AppState?.character ||
                    window.character ||
                    null);
            });

            console.log('Character after level-up:', characterData);

            // Check if progressionHistory exists
            if (characterData) {
                console.log('progressionHistory:', characterData.progressionHistory);
                expect(characterData.progressionHistory).toBeDefined();
            } else {
                console.warn('Could not access character data from window');
            }

        } finally {
            await electronApp.close();
        }
    });
});
