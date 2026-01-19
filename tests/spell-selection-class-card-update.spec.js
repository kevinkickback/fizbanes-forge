import { _electron as electron, expect, test } from '@playwright/test';

test('selecting a spell from class card updates spell display', async () => {
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

        // Navigate to home and create a new character
        await page.locator('a[href="#/home"]').click();
        await page.waitForSelector('#newCharacterBtn', { timeout: 10000 });
        await page.locator('#newCharacterBtn').click();

        // Wait for character creation modal
        await page.waitForSelector('#characterCreationModal.show', { timeout: 10000 });

        // Fill in basic info
        await page.locator('#characterName').fill('Spell Test Wizard');
        await page.locator('#characterCreationModal button:has-text("Next")').click();

        // Select Human race
        await page.waitForSelector('#raceSelect', { timeout: 10000 });
        await page.locator('#raceSelect').selectOption('Human');
        await page.locator('#characterCreationModal button:has-text("Next")').click();

        // Select Wizard class
        await page.waitForSelector('#classSelect', { timeout: 10000 });
        await page.locator('#classSelect').selectOption('Wizard');
        await page.locator('#characterCreationModal button:has-text("Next")').click();

        // Roll for stats
        await page.waitForSelector('button:has-text("Roll 4d6")', { timeout: 10000 });
        await page.locator('button:has-text("Roll 4d6")').click();
        await page.locator('#characterCreationModal button:has-text("Next")').click();

        // Skip background for now
        await page.waitForSelector('#backgroundSelect', { timeout: 10000 });
        await page.locator('#characterCreationModal button:has-text("Next")').click();

        // Finish character creation
        await page.locator('#characterCreationModal button:has-text("Finish")').click();

        // Wait for modal to close
        await page.waitForSelector('#characterCreationModal', { state: 'hidden', timeout: 10000 });

        // Navigate to Build page
        await page.locator('a[href="#/build"]').click();
        await page.waitForSelector('#buildPage', { timeout: 10000 });

        // Wait for spell notification section to appear
        await page.waitForSelector('#spellNotificationSection', { timeout: 10000 });

        // Check that there's a spell selection card for level 1
        const spellCard = page.locator('#spellNotificationSection .card').first();
        await expect(spellCard).toBeVisible();

        // Check the initial state shows "None selected"
        await expect(spellCard.locator(':text("None selected")')).toBeVisible();

        // Click the "Choose" button to open spell selector
        await page.locator('#spellNotificationSection button:has-text("Choose")').first().click();

        // Wait for the spell selector modal to open
        await page.waitForSelector('[data-selector-modal]', { timeout: 10000 });

        // Select a cantrip (Fire Bolt) and a 1st level spell (Magic Missile)
        const fireBolt = page.locator('[data-item-id="fire bolt"]');
        if (await fireBolt.isVisible()) {
            await fireBolt.click();
        }

        // Switch to 1st level spells tab if needed
        const firstLevelTab = page.locator('[data-selector-tab-level="1"]');
        if (await firstLevelTab.isVisible()) {
            await firstLevelTab.click();
            await page.waitForTimeout(500);
        }

        // Select Magic Missile
        const magicMissile = page.locator('[data-item-id="magic missile"]');
        if (await magicMissile.isVisible()) {
            await magicMissile.click();
        }

        // Click Confirm button
        await page.locator('[data-selector-confirm-btn]').click();

        // Wait for modal to close
        await page.waitForSelector('[data-selector-modal]', { state: 'hidden', timeout: 10000 });

        // Wait a moment for the display to update
        await page.waitForTimeout(1000);

        // Check that the spell card now shows the selected spells
        const selectedDisplay = page.locator('#spellNotificationSection .card .text-muted.small');
        const displayText = await selectedDisplay.first().textContent();

        // Should show selected spell names (not "None selected")
        expect(displayText).not.toContain('None selected');

        // Should contain spell names
        expect(displayText.toLowerCase()).toMatch(/fire bolt|magic missile/);

        console.log('[TEST] ✅ Spell selection from class card updates display correctly');

    } finally {
        await electronApp.close();
    }
});
