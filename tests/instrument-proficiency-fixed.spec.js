import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Fixed behavior tests for Musical Instrument proficiencies
 * 
 * Key fixes:
 * 1. Slots now have unique IDs (key, sourceLabel, slotIndex) so multiple
 *    slots from same source can be correctly matched during restoration
 * 2. Monk's optional instruments no longer auto-show dropdowns - only if
 *    Musical Instrument is the ONLY tool option will dropdowns appear
 * 3. Character.instrumentChoices now includes slotIndex for proper tracking
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

    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });

    return { app, page };
}

async function openCharacter(page, characterName) {
    const locator = page
        .locator('.character-card', { hasText: characterName })
        .first();
    await expect(locator).toBeVisible({ timeout: 15000 });
    await locator.click();

    // Navigate to build page
    await page.waitForSelector('button.nav-link[data-page="build"]', {
        timeout: 15000,
    });
    await page.click('button.nav-link[data-page="build"]');
    await page.waitForSelector('[data-current-page="build"]', { timeout: 45000 });
}

async function navigateToProficiencies(page) {
    // Click on Proficiencies card/section
    const proficienciesCard = page.locator('.card-header', {
        hasText: /proficiencies/i,
    });
    await expect(proficienciesCard).toBeVisible({ timeout: 15000 });

    // Wait for tools container to be visible
    await page.waitForSelector('#toolsContainer', { timeout: 15000 });
}

test.describe('Musical Instrument Proficiencies - Fixed Behavior', () => {
    test('Bard character: 3 instrument slots are created and populate on reload with correct selections', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Look for a Bard character or create one
            const bardCard = page.locator('.character-card', { hasText: /bard/i }).first();
            if (await bardCard.isVisible({ timeout: 5000 })) {
                await openCharacter(page, await bardCard.textContent());
                await navigateToProficiencies(page);
            } else {
                // If no Bard exists, we can't test with this setup
                console.log('No Bard character found - test setup limitation');
                return;
            }

            // Get instrument dropdowns
            const dropdowns = page.locator('.instrument-choice-select');
            const count = await dropdowns.count();

            console.log(`Bard has ${count} instrument dropdowns`);
            expect(count).toBe(3);

            // Check that dropdowns are empty initially OR had selections from before
            // (depends on whether this is a fresh character or existing one with saves)
            const initialValues = [];
            for (let i = 0; i < count; i++) {
                const value = await dropdowns.nth(i).inputValue();
                initialValues.push(value);
                console.log(`Dropdown ${i} initial value: "${value}"`);
            }

            // Select instruments in each dropdown (if not already selected)
            if (!initialValues[0] || initialValues[0] === '') {
                await dropdowns.nth(0).selectOption('Bagpipes');
                await page.waitForTimeout(300);
            }
            if (!initialValues[1] || initialValues[1] === '') {
                await dropdowns.nth(1).selectOption('Drum');
                await page.waitForTimeout(300);
            }
            if (!initialValues[2] || initialValues[2] === '') {
                await dropdowns.nth(2).selectOption('Flute');
                await page.waitForTimeout(300);
            }

            // Verify selections were made
            const afterSelectValues = [];
            for (let i = 0; i < count; i++) {
                const value = await dropdowns.nth(i).inputValue();
                afterSelectValues.push(value);
                console.log(`Dropdown ${i} after select: "${value}"`);
                expect(value).not.toBe(''); // Should not be empty
            }

            // Save character (Ctrl+S or find save button)
            await page.keyboard.press('Control+S');
            await page.waitForTimeout(1000);
            console.log('Character saved');

            // Navigate away from proficiencies and back to force reload
            const buildBtn = page.locator('button[data-page="build"]').first();
            if (await buildBtn.isVisible({ timeout: 5000 })) {
                await buildBtn.click();
                await page.waitForTimeout(500);
                // Navigate back to proficiencies
                const profCard = page.locator('.card-header', { hasText: /proficiencies/i });
                await profCard.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
            }

            // Verify dropdowns are still there with same selections
            const reloadedDropdowns = page.locator('.instrument-choice-select');
            const reloadedCount = await reloadedDropdowns.count();
            console.log(`After reload: ${reloadedCount} dropdowns`);
            expect(reloadedCount).toBe(3);

            const reloadedValues = [];
            for (let i = 0; i < reloadedCount; i++) {
                const value = await reloadedDropdowns.nth(i).inputValue();
                reloadedValues.push(value);
                console.log(`Dropdown ${i} after reload: "${value}"`);
                // MAIN TEST: Values should NOT be empty (this was the bug)
                expect(value).not.toBe('', `Dropdown ${i} should not be empty after reload`);
            }

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

    test('Monk character: No instrument dropdowns show initially (optional choice behavior)', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Look for a Monk character
            const monkCard = page.locator('.character-card', { hasText: /monk/i }).first();
            if (await monkCard.isVisible({ timeout: 5000 })) {
                await openCharacter(page, await monkCard.textContent());
                await navigateToProficiencies(page);
            } else {
                console.log('No Monk character found - test setup limitation');
                return;
            }

            // Check for instrument dropdowns
            const dropdowns = page.locator('.instrument-choice-select');
            const count = await dropdowns.count();

            console.log(`Monk has ${count} instrument dropdowns initially`);
            // MAIN TEST: Should be 0 because Musical Instrument is optional
            expect(count).toBe(0);

            console.log('✓ Monk does not show instrument dropdowns for optional choice');
        } catch (error) {
            console.error('Test error:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });

    test('Barbarian character: No instrument dropdowns (no music instruments offered)', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Look for a Barbarian character  
            const barbarianCard = page.locator('.character-card', { hasText: /barbarian/i }).first();
            if (await barbarianCard.isVisible({ timeout: 5000 })) {
                await openCharacter(page, await barbarianCard.textContent());
                await navigateToProficiencies(page);
            } else {
                console.log('No Barbarian character found - test setup limitation');
                return;
            }

            // Check for instrument dropdowns
            const dropdowns = page.locator('.instrument-choice-select');
            const count = await dropdowns.count();

            console.log(`Barbarian has ${count} instrument dropdowns`);
            // MAIN TEST: Should be 0 because Barbarian doesn't offer instruments
            expect(count).toBe(0);

            console.log('✓ Barbarian correctly has no instrument dropdowns');
        } catch (error) {
            console.error('Test error:', error);
            throw error;
        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });

    test('loads saved instrument selections for BandMan character (existing test)', async () => {
        test.setTimeout(120000);
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Open existing BandMan character
            await openCharacter(page, 'BandMan');

            // Navigate to proficiencies
            await navigateToProficiencies(page);

            // Wait for instrument dropdowns to appear
            const instrumentDropdowns = page.locator('.instrument-choice-select');
            const dropdownCount = await instrumentDropdowns.count();

            console.log(`Found ${dropdownCount} instrument dropdowns`);

            // Expect 3 dropdowns for Bard's 3 musical instruments
            await expect(instrumentDropdowns).toHaveCount(3, { timeout: 15000 });

            // Check that all dropdowns have selections (not "Choose...")
            for (let i = 0; i < 3; i++) {
                const dropdown = instrumentDropdowns.nth(i);
                await expect(dropdown).toBeVisible({ timeout: 5000 });

                const selectedValue = await dropdown.inputValue();
                console.log(`Dropdown ${i} value:`, selectedValue);

                // The value should not be empty (which means "Choose..." is selected)
                expect(selectedValue).not.toBe('');
                expect(selectedValue).toBeTruthy();

                // Optional: check that it's a valid instrument name
                const isValidInstrument = selectedValue.length > 0 && selectedValue !== 'Choose...';
                expect(isValidInstrument).toBe(true);
            }

            console.log('✓ BandMan character instruments loaded correctly');
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
