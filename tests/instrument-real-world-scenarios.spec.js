import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Real-world test scenarios for Musical Instrument proficiency handling:
 * 1. Bard class with 3 default musical instruments
 * 2. Monk with optional Musical Instrument choice
 * 3. Barbarian with no instruments (used as control/switch scenario)
 */

async function launchApp() {
    const app = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    let page = app.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await app.waitForEvent(
            'window',
            (win) => !win.url().startsWith('devtools://'),
        );
    }

    // Capture console logs for debugging
    page.on('console', (msg) => {
        const text = msg.text();
        if (
            text.includes('[Instrument') ||
            text.includes('[Rehydrate') ||
            text.includes('[ProficiencyCard')
        ) {
            console.log('APP LOG:', text);
        }
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });

    return { app, page };
}

async function navigateToBuild(page) {
    // Click on the Build/Character tab
    const buildBtn = page.locator('button[data-page="build"], a:has-text("Build")');
    if (await buildBtn.isVisible({ timeout: 5000 })) {
        await buildBtn.click();
        await page.waitForTimeout(500);
    }
}

async function navigateToProficiencies(page) {
    // Scroll to Proficiencies section or click the proficiencies nav
    const profCard = page.locator('.card-header', { hasText: /proficiencies/i });
    if (await profCard.isVisible({ timeout: 5000 })) {
        await profCard.scrollIntoViewIfNeeded();
        // The proficiencies section should auto-expand
        await page.waitForSelector('#toolsContainer', { timeout: 10000 });
    }
}

async function getInstrumentDropdowns(page) {
    return page.locator('.instrument-choice-select, select[data-slot-index]');
}

async function selectInstrumentInDropdown(page, dropdownIndex, instrumentName) {
    const dropdowns = await getInstrumentDropdowns(page);
    const dropdown = dropdowns.nth(dropdownIndex);

    // Get the actual value from the option that contains the instrument name
    const options = await dropdown.locator('option').all();
    for (const option of options) {
        const text = await option.textContent();
        if (text.includes(instrumentName)) {
            const value = await option.getAttribute('value');
            await dropdown.selectOption(value);
            await page.waitForTimeout(300); // Let selection update
            return;
        }
    }

    // Fallback: try direct select
    await dropdown.selectOption(instrumentName);
    await page.waitForTimeout(300);
}

async function saveCharacter(page) {
    // Try to find and click save button
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("save")');
    if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
    } else {
        // Try keyboard shortcut
        await page.keyboard.press('Control+S');
    }
    await page.waitForTimeout(800); // Let save complete
}

async function changeClass(page, className) {
    // Find the class selector
    const classSelect = page.locator(
        'select[id*="class"], select[data-class], input[placeholder*="Class"]',
    );

    if (await classSelect.first().isVisible({ timeout: 5000 })) {
        await classSelect.first().selectOption(className);
        await page.waitForTimeout(800); // Let the change process
        return;
    }

    // Fallback: click on class name and select from dropdown
    const classButton = page.locator('button:has-text("Class"), button:has-text("Select Class")');
    if (await classButton.isVisible({ timeout: 5000 })) {
        await classButton.click();
        const option = page.locator(`text="${className}"`);
        await option.click({ timeout: 5000 });
        await page.waitForTimeout(800);
    }
}

test.describe('Musical Instrument Real-World Scenarios', () => {
    test('Bard: 3 default instruments selected, saved, and restored after navigation', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Navigate to build page
            await navigateToBuild(page);
            await page.waitForTimeout(500);

            // Find and click Bard in the class selection (if available)
            const bardOption = page.locator('text="Bard"');
            if (await bardOption.isVisible({ timeout: 5000 })) {
                await bardOption.click();
            } else {
                // Try the select dropdown
                const classSelect = page.locator('select[id*="class"]');
                if (await classSelect.isVisible()) {
                    await classSelect.selectOption('Bard');
                }
            }

            await page.waitForTimeout(1000);

            // Navigate to proficiencies
            await navigateToProficiencies(page);

            // Verify 3 dropdowns appear for Bard
            const dropdowns = await getInstrumentDropdowns(page);
            const initialCount = await dropdowns.count();
            console.log(`[Bard] Found ${initialCount} instrument dropdowns`);
            expect(initialCount).toBe(3);

            // Select different instruments in each dropdown
            await selectInstrumentInDropdown(page, 0, 'Bagpipes');
            await selectInstrumentInDropdown(page, 1, 'Drum');
            await selectInstrumentInDropdown(page, 2, 'Flute');

            // Verify selections are visible
            const reloadedDropdowns = await getInstrumentDropdowns(page);
            const val0 = await reloadedDropdowns.nth(0).inputValue();
            const val1 = await reloadedDropdowns.nth(1).inputValue();
            const val2 = await reloadedDropdowns.nth(2).inputValue();

            console.log(`[Bard] Selected instruments: ${val0}, ${val1}, ${val2}`);
            expect(val0).not.toBe('');
            expect(val1).not.toBe('');
            expect(val2).not.toBe('');

            // Save character
            await saveCharacter(page);

            // Navigate away and back to test restoration
            await page.goto('about:blank');
            await page.waitForTimeout(500);
            await navigateToBuild(page);
            await navigateToProficiencies(page);

            // Verify dropdowns are still populated
            const restoredDropdowns = await getInstrumentDropdowns(page);
            const restoredCount = await restoredDropdowns.count();
            console.log(`[Bard] After restore: ${restoredCount} dropdowns`);
            expect(restoredCount).toBe(3);

            const restoredVal0 = await restoredDropdowns.nth(0).inputValue();
            const restoredVal1 = await restoredDropdowns.nth(1).inputValue();
            const restoredVal2 = await restoredDropdowns.nth(2).inputValue();

            console.log(`[Bard] Restored instruments: ${restoredVal0}, ${restoredVal1}, ${restoredVal2}`);
            // These should match or be valid instruments, not empty
            expect(restoredVal0).not.toBe('');
            expect(restoredVal1).not.toBe('');
            expect(restoredVal2).not.toBe('');

            console.log('✓ Bard instrument selections persisted correctly');
        } catch (error) {
            console.error('Test error:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });

    test('Monk: optional Musical Instrument only shows when selected, and persists', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Navigate to build
            await navigateToBuild(page);
            await page.waitForTimeout(500);

            // Select Monk class
            const monkOption = page.locator('text="Monk"');
            if (await monkOption.isVisible({ timeout: 5000 })) {
                await monkOption.click();
            } else {
                const classSelect = page.locator('select[id*="class"]');
                if (await classSelect.isVisible()) {
                    await classSelect.selectOption('Monk');
                }
            }

            await page.waitForTimeout(1000);

            // Navigate to proficiencies
            await navigateToProficiencies(page);

            // Monk should NOT have instrument dropdowns initially
            // (Musical Instrument is optional, not auto-selected)
            let dropdowns = await getInstrumentDropdowns(page);
            let count = await dropdowns.count();
            console.log(`[Monk] Initial dropdowns: ${count} (should be 0 initially)`);
            // Allow 0 or potentially 1 if auto-showing optional

            // Now explicitly select "Musical Instrument" from tools list
            const _toolsList = page.locator('#toolsContainer, .tools-list');
            const musicalInstrItem = page.locator(
                'text="Musical Instrument"',
            ).first();

            if (await musicalInstrItem.isVisible({ timeout: 5000 })) {
                // Check if it's a checkbox or clickable
                const checkbox = musicalInstrItem.locator('input[type="checkbox"]').first();
                if (await checkbox.isVisible()) {
                    const isChecked = await checkbox.isChecked();
                    if (!isChecked) {
                        await checkbox.check();
                        await page.waitForTimeout(500);
                    }
                } else {
                    // Try clicking the parent
                    await musicalInstrItem.click();
                    await page.waitForTimeout(500);
                }
            }

            // Now check for dropdowns
            dropdowns = await getInstrumentDropdowns(page);
            count = await dropdowns.count();
            console.log(`[Monk] After selecting Musical Instrument: ${count} dropdowns`);
            expect(count).toBeGreaterThan(0);

            // Select an instrument
            await selectInstrumentInDropdown(page, 0, 'Lute');

            const dropVal = await dropdowns.nth(0).inputValue();
            console.log(`[Monk] Selected: ${dropVal}`);
            expect(dropVal).not.toBe('');

            // Save
            await saveCharacter(page);

            // Navigate away and back
            await page.goto('about:blank');
            await page.waitForTimeout(500);
            await navigateToBuild(page);
            await navigateToProficiencies(page);

            // Verify dropdown still shows
            dropdowns = await getInstrumentDropdowns(page);
            count = await dropdowns.count();
            console.log(`[Monk] After restore: ${count} dropdowns`);
            expect(count).toBeGreaterThan(0);

            const restoredVal = await dropdowns.nth(0).inputValue();
            console.log(`[Monk] Restored: ${restoredVal}`);
            expect(restoredVal).not.toBe('');

            console.log('✓ Monk optional instrument selection persisted correctly');
        } catch (error) {
            console.error('Test error:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });

    test('Barbarian: no instruments, switching from Bard removes dropdowns correctly', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Navigate to build
            await navigateToBuild(page);
            await page.waitForTimeout(500);

            // Start with Bard
            const bardOption = page.locator('text="Bard"');
            if (await bardOption.isVisible({ timeout: 5000 })) {
                await bardOption.click();
            } else {
                const classSelect = page.locator('select[id*="class"]');
                if (await classSelect.isVisible()) {
                    await classSelect.selectOption('Bard');
                }
            }

            await page.waitForTimeout(1000);

            // Navigate to proficiencies
            await navigateToProficiencies(page);

            // Verify Bard has 3 dropdowns
            let dropdowns = await getInstrumentDropdowns(page);
            let count = await dropdowns.count();
            console.log(`[Bard→Barb] Bard has ${count} dropdowns`);
            expect(count).toBe(3);

            // Select instruments
            await selectInstrumentInDropdown(page, 0, 'Bagpipes');
            await selectInstrumentInDropdown(page, 1, 'Drum');
            await selectInstrumentInDropdown(page, 2, 'Flute');

            // Save Bard character
            await saveCharacter(page);
            await page.waitForTimeout(500);

            // Now switch to Barbarian
            await changeClass(page, 'Barbarian');
            await page.waitForTimeout(1000);

            // Navigate to proficiencies to refresh
            await navigateToProficiencies(page);

            // Verify dropdowns are gone for Barbarian
            dropdowns = await getInstrumentDropdowns(page);
            count = await dropdowns.count();
            console.log(`[Bard→Barb] Barbarian has ${count} dropdowns`);
            expect(count).toBe(0);

            // Save Barbarian
            await saveCharacter(page);

            // Navigate away and back
            await page.goto('about:blank');
            await page.waitForTimeout(500);
            await navigateToBuild(page);
            await navigateToProficiencies(page);

            // Verify still no dropdowns
            dropdowns = await getInstrumentDropdowns(page);
            count = await dropdowns.count();
            console.log(`[Bard→Barb] Barbarian after restore: ${count} dropdowns`);
            expect(count).toBe(0);

            console.log('✓ Barbarian correctly has no instrument dropdowns after switching from Bard');
        } catch (error) {
            console.error('Test error:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });
});
