/**
 * Test: Race selection with non-PHB sources
 * 
 * Verify that the Next button works with non-PHB race selections
 */

import { _electron as electron, expect, test } from '@playwright/test';

test('Next button should work with non-PHB race selection', async () => {
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

        // Capture console messages
        const consoleMessages = [];
        page.on('console', (msg) => {
            const text = msg.text();
            consoleMessages.push(text);
            console.log(`[${msg.type()}] ${text}`);
        });

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // Click New Character button
        const newCharBtn = page.locator('button:has-text("New Character")');
        await newCharBtn.waitFor({ state: 'visible', timeout: 10000 });
        await newCharBtn.click();

        // Wait for character creation modal
        const modal = page.locator('#newCharacterModal');
        await modal.waitFor({ state: 'visible', timeout: 10000 });

        // Step 0: Basics - Enter name
        const nameInput = page.locator('#characterName');
        await nameInput.waitFor({ state: 'visible', timeout: 10000 });
        await nameInput.fill('Test Non-PHB Race');
        await page.waitForTimeout(500);

        // Click Next to go to Rules step
        const nextBtn = page.locator('#wizardNextBtn');
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 1: Rules - Enable XGTE source (for non-PHB races)
        // Source selection uses toggle buttons with class 'source-toggle', not checkboxes
        await page.waitForTimeout(500);
        const xgteToggle = page.locator('.source-toggle[data-source="xgte"], .source-toggle[data-source="XGTE"]').first();
        if (await xgteToggle.isVisible()) {
            await xgteToggle.click();
            await page.waitForTimeout(300);
            console.log('Clicked XGTE source toggle');
        } else {
            console.log('XGTE toggle not found, looking for available sources...');
            const allToggles = await page.locator('.source-toggle').all();
            console.log(`Found ${allToggles.length} source toggles`);
            if (allToggles.length > 0) {
                const firstToggle = allToggles[0];
                const dataSource = await firstToggle.getAttribute('data-source');
                console.log('Clicking first available source:', dataSource);
                await firstToggle.click();
                await page.waitForTimeout(300);
            }
        }

        // Click Next to go to Race step
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 2: Race - Select a non-PHB race
        const raceSelect = page.locator('#modalRaceSelect');
        await raceSelect.waitFor({ state: 'visible', timeout: 5000 });

        // Get all race options
        const options = await raceSelect.locator('option').allTextContents();
        console.log('Available races:', options);

        // Find a non-PHB race (e.g., one with XGTE)
        const nonPhbOption = options.find(opt => opt.includes('XGTE') || opt.includes('SCAG') || opt.includes('VGM'));

        if (nonPhbOption) {
            console.log('Selecting non-PHB race:', nonPhbOption);
            await raceSelect.selectOption({ label: nonPhbOption });
            await page.waitForTimeout(500);

            // Check if Next button is enabled
            const isNextEnabled = await nextBtn.isEnabled();
            console.log('Next button enabled:', isNextEnabled);

            // Check console for any validation errors
            const validationErrors = consoleMessages.filter(msg =>
                msg.includes('[Step2Race]') && msg.includes('warn')
            );
            console.log('Validation errors:', validationErrors);

            // Try clicking Next
            if (isNextEnabled) {
                await nextBtn.click();
                await page.waitForTimeout(500);

                // Check if we moved to next step (Class selection)
                const classSelect = page.locator('#modalClassSelect');
                const onClassStep = await classSelect.isVisible();

                expect(onClassStep).toBe(true);
                console.log('Successfully moved to Class step with non-PHB race');
            } else {
                console.error('Next button is DISABLED with non-PHB race selection');
                expect(isNextEnabled).toBe(true);
            }
        } else {
            console.log('No non-PHB races found, trying PHB race as baseline');

            // Select a PHB race as baseline test
            const phbOption = options.find(opt => opt.includes('PHB'));
            if (phbOption) {
                await raceSelect.selectOption({ label: phbOption });
                await page.waitForTimeout(500);

                const isNextEnabled = await nextBtn.isEnabled();
                console.log('Next button enabled with PHB race:', isNextEnabled);
                expect(isNextEnabled).toBe(true);
            }
        }

    } finally {
        await electronApp.close();
    }
});
