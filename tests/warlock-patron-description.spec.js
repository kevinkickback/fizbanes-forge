import { _electron as electron, expect, test } from '@playwright/test';

test('warlock patron selection modal should display descriptions', async () => {
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
        let page = electronApp
            .windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) =>
                !win.url().startsWith('devtools://'),
            );
        }

        // Capture console output
        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Start character creation
        await page.locator('[data-nav="home"]').click();
        await page.waitForTimeout(500);
        await page.locator('#createCharacterBtn').click();

        // Wait for modal
        await page.waitForSelector('#characterCreationModal.show', {
            timeout: 10000,
        });

        // Select Warlock class
        await page.locator('#modalClassSelect').selectOption('Warlock');
        await page.waitForTimeout(500);

        // Select a race to enable next button
        const raceSelect = page.locator('#modalRaceSelect');
        await raceSelect.waitFor({ state: 'visible', timeout: 5000 });
        await raceSelect.selectOption({ index: 1 }); // Select first non-empty option
        await page.waitForTimeout(500);

        // Click next to go to class step
        await page.locator('#modalNextBtn').click();
        await page.waitForTimeout(500);

        // Wait for subclass selection to appear (Warlock gets it at level 1)
        const subclassSelect = page.locator('#modalSubclassSelect');
        await subclassSelect.waitFor({ state: 'visible', timeout: 10000 });

        // Select The Fiend patron
        await subclassSelect.selectOption('The Fiend_PHB');
        await page.waitForTimeout(1000);

        // Check that description is shown in the info area
        const classInfo = page.locator('#modalClassInfo');
        const infoText = await classInfo.textContent();

        console.log('Class info content:', infoText);

        // Verify patron description is displayed
        expect(infoText).toContain('fiend'); // Should contain patron description text
        expect(infoText).not.toBe(''); // Should not be empty

        // Check for specific patron description text
        const hasFiendDescription =
            infoText.toLowerCase().includes('pact with a fiend') ||
            infoText.toLowerCase().includes('demon lords') ||
            infoText.toLowerCase().includes('archdevils');

        expect(hasFiendDescription).toBe(true);

        console.log('✓ Warlock patron description successfully displayed');
    } finally {
        await electronApp.close();
    }
});
