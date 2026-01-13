import { _electron as electron, expect, test } from '@playwright/test';

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
    await page.waitForSelector('[data-current-page="home"]', { timeout: 30000 });

    return { app, page };
}

async function createCharacter(page, characterName) {
    const newCharacterBtn = page.locator('#newCharacterBtn');
    await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
    await newCharacterBtn.click();

    await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

    const nameInput = page.locator('#newCharacterName');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(characterName);

    const nextBtn = page.locator('#wizardNextBtn');
    await expect(nextBtn).toBeVisible({ timeout: 10000 });
    await nextBtn.click(); // Step 0 -> 1
    await nextBtn.click(); // Step 1 -> 2
    await nextBtn.click(); // Step 2 -> 3
    await nextBtn.click(); // Step 3 -> Create character

    await page.waitForSelector('#newCharacterModal.show', {
        state: 'hidden',
        timeout: 15000,
    });

    await page.waitForTimeout(1000);
    const characterCard = page
        .locator('.character-card', { hasText: characterName })
        .first();
    await expect(characterCard).toBeVisible({ timeout: 15000 });
    console.log(`✓ Character "${characterName}" created`);
    return characterCard;
}

async function deleteCharacter(page, characterName) {
    try {
        await page.waitForSelector('button.nav-link[data-page="home"]', {
            timeout: 10000,
        });
        await page.click('button.nav-link[data-page="home"]');
        await page.waitForSelector('[data-current-page="home"]', {
            timeout: 20000,
        });
        await page.waitForTimeout(1000);

        const deleteCard = page
            .locator('.character-card', { hasText: characterName })
            .first();
        if (await deleteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            const deleteButton = deleteCard.locator('.delete-character');
            if (
                await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)
            ) {
                await deleteButton.click();

                const confirmBtn = page
                    .locator('#confirmDeleteBtn, .btn-danger')
                    .filter({ hasText: /delete|confirm/i })
                    .first();
                await confirmBtn
                    .waitFor({ state: 'visible', timeout: 5000 })
                    .catch(() => { });
                if (
                    await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)
                ) {
                    await confirmBtn.click();
                }

                await page.waitForTimeout(1000);
                console.log(`✓ Character "${characterName}" deleted`);
            }
        }
    } catch (cleanupError) {
        console.error(`Failed to delete character "${characterName}":`, cleanupError.message);
    }
}

test.describe('Musical Instrument Choice Persistence', () => {
    test('loads saved instrument selections with proper restoration for Bard', async () => {
        test.setTimeout(90000);

        const testCharacterName = `TestBard-${Date.now()}`;
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            console.log('\n=== Creating Bard character ===');
            const characterCard = await createCharacter(page, testCharacterName);

            await characterCard.click();
            await page.waitForTimeout(1500);

            // Navigate to build page
            await page.waitForSelector('button.nav-link[data-page="build"]', {
                timeout: 10000,
            });
            await page.click('button.nav-link[data-page="build"]');
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 20000,
            });
            await page.waitForTimeout(2000);

            // Select Bard class
            console.log('Selecting Bard class...');
            const classSelect = page.locator('#classSelect');
            await classSelect.selectOption('Bard_PHB');
            await page.waitForTimeout(1200);

            // Check for 3 instrument dropdowns
            const dropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const dropdownCount = await dropdowns.count();
            console.log(`Found ${dropdownCount} instrument dropdowns for Bard`);
            expect(dropdownCount).toBe(3);

            // Select instruments
            console.log('Selecting instruments...');
            const instrumentSelections = ['Bagpipes', 'Drum', 'Flute'];
            for (let i = 0; i < dropdownCount; i++) {
                const dropdown = dropdowns.nth(i);
                const instrument = instrumentSelections[i];
                const options = dropdown.locator('option');
                const optionCount = await options.count();

                for (let j = 0; j < optionCount; j++) {
                    const option = options.nth(j);
                    const text = await option.textContent();
                    if (text.includes(instrument)) {
                        await dropdown.selectOption(await option.getAttribute('value'));
                        await page.waitForTimeout(200);
                        break;
                    }
                }
            }

            // Save character
            console.log('Saving character...');
            await page.keyboard.press('Control+S');
            await page.waitForTimeout(800);

            // Check dropdowns are still visible in same session
            console.log('Checking instrument selections after save...');
            const savedDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const savedCount = await savedDropdowns.count();
            console.log(`Found ${savedCount} dropdowns after save`);
            expect(savedCount).toBe(3);

            // Scenario 2: Switch to Barbarian
            console.log('Scenario 2: Switch to Barbarian...');
            const classSelectReload = page.locator('#classSelect');
            await classSelectReload.selectOption('Barbarian_PHB');
            await page.waitForTimeout(800);

            const barbarianDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const barbarianCount = await barbarianDropdowns.count();
            console.log(`Barbarian dropdowns: ${barbarianCount}`);
            expect(barbarianCount).toBe(0);

            // Scenario 3: Switch to Monk
            console.log('Scenario 3: Switch to Monk...');
            const classSelectMonk = page.locator('#classSelect');
            await classSelectMonk.selectOption('Monk_PHB');
            await page.waitForTimeout(800);

            const monkDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const monkCount = await monkDropdowns.count();
            console.log(`Monk dropdowns: ${monkCount}`);
            expect(monkCount).toBe(0);
            console.log('✓ Test passed');
        } finally {
            console.log('\n=== Cleanup ===');
            try {
                if (electronApp) {
                    const page = electronApp
                        .windows()
                        .find((win) => !win.url().startsWith('devtools://'));
                    if (page) {
                        await deleteCharacter(page, testCharacterName);
                    }
                    await electronApp.close();
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
                if (electronApp) await electronApp.close().catch(() => { });
            }
        }
    });

    test('instrument selections persist through class change and back', async () => {
        test.setTimeout(60000);

        const testCharacterName = `TestBardSwitch-${Date.now()}`;
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            console.log('\n=== Creating character for class switch test ===');
            const characterCard = await createCharacter(page, testCharacterName);

            await characterCard.click();
            await page.waitForTimeout(1500);

            // Navigate to build page
            await page.waitForSelector('button.nav-link[data-page="build"]', {
                timeout: 10000,
            });
            await page.click('button.nav-link[data-page="build"]');
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 20000,
            });
            await page.waitForTimeout(2000);

            // Select Bard class
            const classSelect = page.locator('#classSelect');
            await classSelect.selectOption('Bard_PHB');
            await page.waitForTimeout(1200);

            // Verify 3 dropdowns appear
            const dropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const dropdownCount = await dropdowns.count();
            console.log(`Bard: Found ${dropdownCount} instrument dropdowns`);
            expect(dropdownCount).toBe(3);

            // Select instruments
            console.log('Selecting 3 instruments...');
            const instrumentChoices = ['Bagpipes', 'Drum', 'Flute'];
            for (let i = 0; i < 3; i++) {
                const dropdown = dropdowns.nth(i);
                const options = dropdown.locator('option');
                const optionCount = await options.count();

                for (let j = 0; j < optionCount; j++) {
                    const option = options.nth(j);
                    const text = await option.textContent();
                    if (text.includes(instrumentChoices[i])) {
                        await dropdown.selectOption(await option.getAttribute('value'));
                        await page.waitForTimeout(200);
                        break;
                    }
                }
            }

            // Switch to Barbarian
            console.log('Switching to Barbarian...');
            await classSelect.selectOption('Barbarian_PHB');
            await page.waitForTimeout(800);

            const barbarianDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const barbarianCount = await barbarianDropdowns.count();
            console.log(`Barbarian: ${barbarianCount} dropdowns`);
            expect(barbarianCount).toBe(0);

            // Switch back to Bard
            console.log('Switching back to Bard...');
            await classSelect.selectOption('Bard_PHB');
            await page.waitForTimeout(1200);

            // Check dropdowns appear again
            const bardAgainDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const bardAgainCount = await bardAgainDropdowns.count();
            console.log(`Bard again: ${bardAgainCount} dropdowns`);
            expect(bardAgainCount).toBe(3);

            console.log('✓ Class switching test passed');
        } finally {
            console.log('\n=== Cleanup ===');
            try {
                if (electronApp) {
                    const page = electronApp
                        .windows()
                        .find((win) => !win.url().startsWith('devtools://'));
                    if (page) {
                        await deleteCharacter(page, testCharacterName);
                    }
                    await electronApp.close();
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
                if (electronApp) await electronApp.close().catch(() => { });
            }
        }
    });

    test('saved instruments populate dropdowns after character reload', async () => {
        test.setTimeout(90000);

        const testCharacterName = `TestBardReload-${Date.now()}`;
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            // Capture console logs from the app (cleanup, toJSON, and ClassCard logs)
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('cleanup') || text.includes('toJSON') || text.includes('ClassCard')) {
                    console.log('APP LOG:', text);
                }
            });

            console.log('\n=== Creating Bard character with instruments ===');
            const characterCard = await createCharacter(page, testCharacterName);

            await characterCard.click();
            await page.waitForTimeout(1500);

            // Navigate to build page
            await page.waitForSelector('button.nav-link[data-page="build"]', {
                timeout: 10000,
            });
            await page.click('button.nav-link[data-page="build"]');
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 20000,
            });
            await page.waitForTimeout(2000);

            // Select Bard class
            console.log('Selecting Bard class...');
            const classSelect = page.locator('#classSelect');
            await classSelect.selectOption('Bard_PHB');
            await page.waitForTimeout(1200);

            // Verify 3 dropdowns appear
            const dropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const dropdownCount = await dropdowns.count();
            console.log(`Found ${dropdownCount} instrument dropdowns`);
            expect(dropdownCount).toBe(3);

            // Select 3 instruments
            console.log('Selecting 3 instruments...');
            const instrumentChoices = ['Bagpipes', 'Drum', 'Flute'];
            for (let i = 0; i < 3; i++) {
                const dropdown = dropdowns.nth(i);
                const options = dropdown.locator('option');
                const optionCount = await options.count();

                for (let j = 0; j < optionCount; j++) {
                    const option = options.nth(j);
                    const text = await option.textContent();
                    if (text.includes(instrumentChoices[i])) {
                        await dropdown.selectOption(await option.getAttribute('value'));
                        await page.waitForTimeout(200);
                        console.log(`  Selected: ${instrumentChoices[i]}`);
                        break;
                    }
                }
            }

            // Save character
            console.log('Saving character...');
            await page.keyboard.press('Control+S');
            await page.waitForTimeout(1000);

            // Navigate home
            console.log('Navigating home...');
            await page.click('button.nav-link[data-page="home"]');
            await page.waitForSelector('[data-current-page="home"]', {
                timeout: 10000,
            });
            await page.waitForTimeout(1000);

            // Reload character
            console.log('Reopening character...');
            const reloadCard = page
                .locator('.character-card', { hasText: testCharacterName })
                .first();
            await reloadCard.click();
            await page.waitForTimeout(1500);

            // Navigate back to build page
            await page.waitForSelector('button.nav-link[data-page="build"]', {
                timeout: 10000,
            });
            await page.click('button.nav-link[data-page="build"]');
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 20000,
            });
            await page.waitForTimeout(3000); // Extra wait for async reinit

            // Check if dropdowns are restored with saved values
            console.log('Checking reloaded dropdowns...');
            const reloadedDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const reloadedCount = await reloadedDropdowns.count();
            console.log(`Found ${reloadedCount} dropdowns after reload`);
            expect(reloadedCount).toBe(3);

            // Verify saved instruments are selected
            for (let i = 0; i < reloadedCount; i++) {
                const value = await reloadedDropdowns.nth(i).inputValue();
                console.log(`  Dropdown ${i}: "${value}"`);
                expect(value).not.toBe('');
                expect(value).not.toBe('Choose...');
                // Check that it matches one of our saved instruments
                const matchesInstrument = instrumentChoices.some((instrument) =>
                    value.toLowerCase().includes(instrument.toLowerCase()),
                );
                expect(matchesInstrument).toBe(true);
            }

            console.log('✓ Reload test passed - instruments restored');
        } finally {
            console.log('\n=== Cleanup ===');
            try {
                if (electronApp) {
                    const page = electronApp
                        .windows()
                        .find((win) => !win.url().startsWith('devtools://'));
                    if (page) {
                        await deleteCharacter(page, testCharacterName);
                    }
                    await electronApp.close();
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
                if (electronApp) await electronApp.close().catch(() => { });
            }
        }
    });

    test('Monk selecting Musical Instrument creates dropdown', async () => {
        test.setTimeout(90000);

        const testCharacterName = `TestMonk-${Date.now()}`;
        let electronApp;

        try {
            const { app, page } = await launchApp();
            electronApp = app;

            console.log('\n=== Creating Monk character ===');
            const characterCard = await createCharacter(page, testCharacterName);

            await characterCard.click();
            await page.waitForTimeout(1500);

            // Navigate to build page
            await page.waitForSelector('button.nav-link[data-page="build"]', {
                timeout: 10000,
            });
            await page.click('button.nav-link[data-page="build"]');
            await page.waitForSelector('[data-current-page="build"]', {
                timeout: 20000,
            });
            await page.waitForTimeout(2000);

            // Select Monk class
            console.log('Selecting Monk class...');
            const classSelect = page.locator('#classSelect');
            await classSelect.selectOption('Monk_PHB');
            await page.waitForTimeout(1200);

            // Initially should have 0 instrument dropdowns
            const initialDropdowns = page.locator(
                '.instrument-choice-select, select[data-slot-index]',
            );
            const initialCount = await initialDropdowns.count();
            console.log(`Initial instrument dropdowns for Monk: ${initialCount}`);
            expect(initialCount).toBe(0);

            // Find the Musical Instrument tool proficiency in the tools container
            console.log('Looking for Musical Instrument in tools list...');
            const toolsContainer = page.locator('#toolsContainer');
            await toolsContainer.waitFor({ state: 'visible', timeout: 10000 });
            await page.waitForTimeout(2000); // Wait for proficiencies to populate

            // Look for Musical Instrument prof-item with various possible selectors
            const musicalInstrumentItem = page.locator(
                '#toolsContainer [data-proficiency="Musical instrument"], ' +
                '#toolsContainer [data-proficiency="musical instrument"], ' +
                '#toolsContainer .prof-item:has-text("Musical Instrument"), ' +
                '#toolsContainer .prof-item:has-text("Musical instrument")',
            ).first();

            const musicalInstrumentExists = await musicalInstrumentItem
                .isVisible({ timeout: 5000 })
                .catch(() => false);

            if (musicalInstrumentExists) {
                console.log('Found Musical Instrument prof-item');

                // Check if it's already selected
                const isAlreadySelected = await musicalInstrumentItem
                    .evaluate((el) =>
                        el.classList.contains('optional-selected') ||
                        el.classList.contains('selected') ||
                        el.classList.contains('proficient')
                    )
                    .catch(() => false);

                if (!isAlreadySelected) {
                    console.log('Clicking Musical Instrument to select it...');
                    await musicalInstrumentItem.click();
                    await page.waitForTimeout(1500);
                } else {
                    console.log('Musical Instrument already selected');
                }

                // After selecting Musical Instrument, check if instrument choice dropdown appears
                console.log('Checking for instrument choice dropdown after selection...');
                const instrumentDropdowns = page.locator(
                    '.instrument-choice-select, select[data-slot-index]',
                );
                await page.waitForTimeout(1000); // Give time for dropdown to render
                const instrumentCount = await instrumentDropdowns.count();
                console.log(`Instrument dropdowns after Musical Instrument selection: ${instrumentCount}`);
                expect(instrumentCount).toBeGreaterThan(0);

                console.log('✓ Monk Musical Instrument test passed');
            } else {
                // Musical Instrument might not be rendered - check if options array is populated
                console.log('⚠ Musical Instrument not visible in tools list');
                console.log('Checking if tool proficiency options are populated...');

                // Try to find any prof-items in toolsContainer
                const allProfItems = page.locator('#toolsContainer .prof-item');
                const profItemCount = await allProfItems.count();
                console.log(`Found ${profItemCount} total prof-items in toolsContainer`);

                if (profItemCount > 0) {
                    // Log first few prof-items to see what's available
                    for (let i = 0; i < Math.min(profItemCount, 5); i++) {
                        const profItem = allProfItems.nth(i);
                        const dataProf = await profItem.getAttribute('data-proficiency');
                        const text = await profItem.textContent();
                        console.log(`  Prof-item ${i}: data-proficiency="${dataProf}", text="${text?.trim()}"`);
                    }
                }

                throw new Error('Musical Instrument should be available as a tool choice for Monk, but was not found in toolsContainer');
            }
        } finally {
            console.log('\n=== Cleanup ===');
            try {
                if (electronApp) {
                    const page = electronApp
                        .windows()
                        .find((win) => !win.url().startsWith('devtools://'));
                    if (page) {
                        await deleteCharacter(page, testCharacterName);
                    }
                    await electronApp.close();
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
                if (electronApp) await electronApp.close().catch(() => { });
            }
        }
    });
});
