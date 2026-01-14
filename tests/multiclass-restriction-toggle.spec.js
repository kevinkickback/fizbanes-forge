/**
 * Test: Multiclass Restriction Toggle
 * 
 * Verifies that:
 * 1. Restriction toggle appears in Step 0
 * 2. Classes with unmet requirements are disabled by default
 * 3. Toggle allows bypassing ability score requirements
 * 4. Requirement text is shown for restricted classes
 */

import { _electron as electron, expect, test } from '@playwright/test';

test('multiclass restriction toggle enforces ability requirements', async () => {
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
        let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
        }

        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Create a character with low abilities (won't meet requirements for most classes)
        await page.locator('text=Create New Character').click();
        await page.fill('input[name="name"]', 'Low Ability Character');
        await page.locator('button:has-text("Create Character")').click();
        await page.waitForSelector('text=Race', { timeout: 10000 });

        // Select race
        await page.selectOption('select#raceSelect', 'Human');
        await page.waitForTimeout(500);

        // Assign very low ability scores to test restriction
        const abilityInputs = await page.locator('input[type="number"]').all();
        for (let i = 0; i < Math.min(6, abilityInputs.length); i++) {
            await abilityInputs[i].fill('8');
        }

        // Save abilities
        const saveAbilitiesBtn = await page.locator('button:has-text("Save Abilities")').first();
        if (await saveAbilitiesBtn.isVisible()) {
            await saveAbilitiesBtn.click();
            await page.waitForTimeout(500);
        }

        // Select a class (this should work even with low abilities for first class)
        await page.selectOption('select', { label: /Fighter/ });
        await page.waitForTimeout(1000);

        // Open level-up modal
        const levelUpBtn = page.locator('button#levelUpBtn');
        await expect(levelUpBtn).toBeVisible({ timeout: 10000 });
        await levelUpBtn.click();

        // Wait for modal
        await page.waitForSelector('#levelUpModal.show', { timeout: 10000 });

        // Verify restriction toggle exists
        const toggle = page.locator('#ignoreMulticlassReqs');
        await expect(toggle).toBeVisible();

        // Verify toggle is unchecked by default (requirements enforced)
        await expect(toggle).not.toBeChecked();

        // Get multiclass dropdown
        const multiclassSelect = page.locator('#multiclassSelect');
        await expect(multiclassSelect).toBeVisible();

        // Check that some classes are disabled (due to requirements)
        const disabledOptions = await multiclassSelect.locator('option[disabled]').count();
        console.log(`Found ${disabledOptions} disabled classes`);
        expect(disabledOptions).toBeGreaterThan(0); // At least some classes should be restricted

        // Check that requirement text is shown
        const optionsWithReqs = await page.$$eval('#multiclassSelect option:not([value=""])', options => {
            return options.filter(opt => opt.textContent.includes('requires')).length;
        });
        console.log(`Found ${optionsWithReqs} options with requirement text`);
        expect(optionsWithReqs).toBeGreaterThan(0);

        // Enable toggle to ignore requirements
        await toggle.check();
        await page.waitForTimeout(500); // Wait for re-render

        // Verify toggle is now checked
        await expect(toggle).toBeChecked();

        // Now all classes should be enabled
        const disabledAfterToggle = await multiclassSelect.locator('option[disabled]').count();
        console.log(`After toggle: ${disabledAfterToggle} disabled classes`);
        expect(disabledAfterToggle).toBe(0); // All classes should be available

        // Requirement text should be gone
        const optionsWithReqsAfter = await page.$$eval('#multiclassSelect option:not([value=""])', options => {
            return options.filter(opt => opt.textContent.includes('requires')).length;
        });
        console.log(`After toggle: ${optionsWithReqsAfter} options with requirement text`);
        expect(optionsWithReqsAfter).toBe(0);

        // Try to add a multiclass that was previously restricted
        const barbarian = await multiclassSelect.locator('option:has-text("Barbarian")').first();
        const barbarianValue = await barbarian.getAttribute('value');

        if (barbarianValue) {
            await multiclassSelect.selectOption(barbarianValue);
            await page.locator('#addMulticlassBtn').click();
            await page.waitForTimeout(500);

            // Should successfully add the class
            const barbarianCard = page.locator('.class-card:has-text("Barbarian")');
            await expect(barbarianCard).toBeVisible();
            console.log('Successfully added Barbarian with toggle enabled');
        }

        // Now try disabling toggle again
        await toggle.uncheck();
        await page.waitForTimeout(500);

        // Restrictions should be enforced again
        const disabledFinal = await multiclassSelect.locator('option[disabled]').count();
        console.log(`After re-enabling restrictions: ${disabledFinal} disabled classes`);
        expect(disabledFinal).toBeGreaterThan(0);

        console.log('✅ Multiclass restriction toggle test passed');

    } finally {
        await electronApp.close();
    }
});

test('multiclass restriction shows correct requirement text', async () => {
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
        let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
        }

        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Create character
        await page.locator('text=Create New Character').click();
        await page.fill('input[name="name"]', 'Requirement Test');
        await page.locator('button:has-text("Create Character")').click();
        await page.waitForSelector('text=Race', { timeout: 10000 });

        // Quick setup
        await page.selectOption('select#raceSelect', 'Human');
        await page.waitForTimeout(500);

        // Set abilities that don't meet Wizard requirements (Int 13)
        const abilityInputs = await page.locator('input[type="number"]').all();
        for (let i = 0; i < Math.min(6, abilityInputs.length); i++) {
            await abilityInputs[i].fill(i === 3 ? '10' : '12'); // Set Intelligence (4th ability) to 10
        }

        const saveAbilitiesBtn = await page.locator('button:has-text("Save Abilities")').first();
        if (await saveAbilitiesBtn.isVisible()) {
            await saveAbilitiesBtn.click();
            await page.waitForTimeout(500);
        }

        await page.selectOption('select', { label: /Fighter/ });
        await page.waitForTimeout(1000);

        // Open level-up
        await page.locator('button#levelUpBtn').click();
        await page.waitForSelector('#levelUpModal.show', { timeout: 10000 });

        // Check Wizard option has requirement text
        const wizardOption = await page.locator('#multiclassSelect option:has-text("Wizard")').first();
        const wizardText = await wizardOption.textContent();
        console.log(`Wizard option text: "${wizardText}"`);

        expect(wizardText).toContain('requires'); // Should show "requires Intelligence 13" or similar

        // Verify helper text appears
        const helperText = page.locator('text=Some classes require minimum ability scores');
        await expect(helperText).toBeVisible();

        console.log('✅ Requirement text test passed');

    } finally {
        await electronApp.close();
    }
});
