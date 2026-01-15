import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Test: Spell selection should update display after confirmation
 * 
 * Verifies that when spells are selected and confirmed in the level-up modal,
 * the display updates to show the selected spells instead of "No spells selected yet"
 */
test('spell selection should update display after confirmation', async () => {
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
        page.on('console', (msg) => {
            const text = msg.text();
            console.log(`[${msg.type()}] ${text}`);
        });

        // Wait for app load
        console.log('Waiting for app to load...');
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // Click on character info to select a character
        console.log('Selecting character...');
        await page.locator('.character-info').click();
        await page.waitForTimeout(1000);

        // Click Level Up button
        console.log('Opening level-up modal...');
        await page.getByRole('button', { name: ' Level Up' }).click();
        await page.waitForTimeout(1000);

        // Click + button twice to set levels
        console.log('Setting level increases...');
        await page.getByRole('button', { name: '+', exact: true }).click();
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: '+', exact: true }).click();
        await page.waitForTimeout(300);

        // Navigate through steps
        console.log('Navigating through steps...');
        await page.getByRole('button', { name: 'Next ' }).click();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: 'Next ' }).click();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: 'Next ' }).click();
        await page.waitForTimeout(500);

        // Now on spell selection step
        console.log('On spell selection step...');

        // Capture the current display state before opening spell selector
        const beforeText = await page.locator('.step-3-spell-selection').textContent();
        console.log('Display before spell selection:', beforeText);
        expect(beforeText).toContain('No spells selected yet');

        // Click Learn Spells button
        console.log('Opening spell selector...');
        await page.getByRole('button', { name: ' Learn Spells' }).first().click();
        await page.waitForTimeout(1000);

        // Wait for spell selector modal to be visible
        await page.waitForSelector('#levelUpSelectorModal.show', { timeout: 5000 });
        console.log('Spell selector modal opened');

        // Select 2 cantrips
        console.log('Selecting cantrips...');
        await page.getByText('Blade Ward CantripA').click();
        await page.waitForTimeout(300);
        await page.getByText('Chill Touch CantripN').click();
        await page.waitForTimeout(300);

        // Switch to 1st level spells tab
        console.log('Switching to 1st level spells...');
        await page.getByRole('checkbox', { name: '1st Level' }).check();
        await page.waitForTimeout(500);

        // Select 2 spells
        console.log('Selecting 1st level spells...');
        await page.getByText('Armor of Agathys Level 1A').click();
        await page.waitForTimeout(300);
        await page.getByText('Arms of Hadar Level 1C').click();
        await page.waitForTimeout(300);

        // Check the count badges
        const countBadges = await page.locator('[data-selector-custom-count]').textContent();
        console.log('Count badges:', countBadges);

        // Confirm selection
        console.log('Confirming selection...');
        await page.getByRole('button', { name: 'Confirm Selection' }).click();

        // Wait for modal to close and step to re-render
        await page.waitForTimeout(2000);

        // Check if modal is closed
        const modalVisible = await page.locator('#levelUpSelectorModal.show').isVisible().catch(() => false);
        console.log('Modal still visible:', modalVisible);
        expect(modalVisible).toBe(false);

        // Capture the display state after spell selection
        const afterText = await page.locator('.step-3-spell-selection').textContent();
        console.log('Display after spell selection:', afterText);

        // Check for selected spells in the display
        const hasSelectedSpells = afterText.includes('Blade Ward') ||
            afterText.includes('Chill Touch') ||
            afterText.includes('Armor of Agathys') ||
            afterText.includes('Arms of Hadar');

        console.log('Has selected spells in display:', hasSelectedSpells);

        // The display should show selected spells, not "No spells selected yet"
        expect(afterText).not.toContain('No spells selected yet');
        expect(hasSelectedSpells).toBe(true);

        // Check specifically for spell badges
        const spellBadges = await page.locator('.step-3-spell-selection .badge.bg-primary').count();
        console.log('Number of spell badges found:', spellBadges);
        expect(spellBadges).toBeGreaterThan(0);

    } finally {
        await electronApp.close();
    }
});
