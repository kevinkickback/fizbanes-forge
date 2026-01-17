import { _electron as electron, expect, test } from '@playwright/test';

test('debug Cleric (PHB) subclass selection', async () => {
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
            console.log(`[CONSOLE ${msg.type()}] ${text}`);
        });

        // Wait for app to load
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        console.log('✓ App loaded');

        // Click "New Character" button
        await page.locator('button:has-text("New Character")').click();
        console.log('✓ Clicked New Character');

        // Wait for modal to appear
        await page.waitForSelector('#newCharacterModal.show', { timeout: 10000 });
        console.log('✓ Modal opened');

        // Wait for step content container
        await page.waitForSelector('[data-step-content]', { timeout: 5000 });

        // Wait for step 0 (Basics) to load - wait for the character name input
        await page.waitForSelector('#characterName', { timeout: 10000 });
        console.log('✓ Step 0 content loaded');

        // Step 0 - Basics: Fill in name
        await page.locator('#characterName').fill('Test Cleric');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 0 completed');

        // Step 1 - Rules: Just click Next
        await page.waitForSelector('#pointBuy', { timeout: 5000 });
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 1 completed');

        // Step 2 - Race: Select Human and click Next
        await page.waitForSelector('#modalRaceSelect', { timeout: 5000 });
        const raceSelect = page.locator('#modalRaceSelect');
        await raceSelect.selectOption('Human_PHB');
        await page.locator('#wizardNextBtn').click();
        console.log('✓ Step 2 completed');

        // Step 3 - Class: This is where we test
        await page.waitForSelector('#modalClassSelect', { timeout: 5000 });
        console.log('✓ Step 3 loaded');

        // Get the class select
        const classSelect = page.locator('#modalClassSelect');
        await expect(classSelect).toBeVisible();

        // Get all available class options
        const classOptions = await classSelect.locator('option').allTextContents();
        console.log('Available classes:', classOptions);

        // Find and select Cleric (PHB)
        const clericPHBOption = classOptions.find(opt => opt.includes('Cleric') && opt.includes('PHB'));
        console.log('Found Cleric (PHB):', clericPHBOption);

        if (clericPHBOption) {
            await classSelect.selectOption({ label: clericPHBOption });
            console.log('✓ Selected', clericPHBOption);

            // Wait a bit for the subclass dropdown to update
            await page.waitForTimeout(500);

            // Check the subclass dropdown
            const subclassSelect = page.locator('#modalSubclassSelect');
            await expect(subclassSelect).toBeVisible();

            const isDisabled = await subclassSelect.isDisabled();
            console.log('Subclass dropdown disabled:', isDisabled);

            const subclassOptions = await subclassSelect.locator('option').allTextContents();
            console.log('Subclass options:', subclassOptions);

            // Get the class data from the page's context
            const classData = await page.evaluate(() => {
                const select = document.getElementById('modalClassSelect');
                const [className, source] = select.value.split('_');
                const classService = window.__debugClassService;
                if (classService) {
                    const cls = classService.getClass(className, source);
                    return {
                        name: cls?.name,
                        source: cls?.source,
                        edition: cls?.edition,
                        hasClassFeatures: !!cls?.classFeatures,
                        classFeatureCount: cls?.classFeatures?.length || 0,
                        firstFeature: cls?.classFeatures?.[0]
                    };
                }
                return null;
            });
            console.log('Class data:', JSON.stringify(classData, null, 2));

            // Get subclass data
            const subclassData = await page.evaluate(() => {
                const select = document.getElementById('modalClassSelect');
                const [className, source] = select.value.split('_');
                const classService = window.__debugClassService;
                if (classService) {
                    const subclasses = classService.getSubclasses(className, source);
                    return {
                        count: subclasses?.length || 0,
                        first: subclasses?.[0],
                        all: subclasses?.map(sc => ({ name: sc.name, source: sc.source, classSource: sc.classSource }))
                    };
                }
                return null;
            });
            console.log('Subclass data:', JSON.stringify(subclassData, null, 2));

            // Check if classService is available for debugging
            const hasDebugService = await page.evaluate(() => !!window.__debugClassService);
            console.log('Debug service available:', hasDebugService);

            if (!hasDebugService) {
                console.log('Setting up debug service...');
                await page.evaluate(() => {
                    // Try to access classService from the Step3Class instance
                    const modal = document.getElementById('newCharacterModal');
                    if (modal?._currentStep?._classService) {
                        window.__debugClassService = modal._currentStep._classService;
                        console.log('Debug service set up');
                    }
                });
            }

            // Verify expectations
            if (!isDisabled) {
                expect(subclassOptions.length).toBeGreaterThan(1); // More than just "Select Subclass"
                console.log('✓ Subclass dropdown is enabled with options');
            } else {
                console.log('✗ Subclass dropdown is disabled');
                console.log('Current dropdown content:', subclassOptions[0]);
            }
        } else {
            console.log('✗ Could not find Cleric (PHB) option');
        }

    } finally {
        await electronApp.close();
    }
});
