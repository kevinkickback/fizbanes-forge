import { _electron as electron, expect, test } from '@playwright/test';

test('debug class and subclass dropdown loading', async () => {
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
        // Get main window (exclude devtools)
        let page = electronApp
            .windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) =>
                !win.url().startsWith('devtools://'),
            );
        }

        // Capture console messages for debugging
        page.on('console', (msg) => {
            const type = msg.type();
            const text = msg.text();
            console.log(`[Browser ${type}] ${text}`);
        });

        // Capture page errors
        page.on('pageerror', (error) => {
            console.error('[Page Error]', error.message);
        });

        // Wait for app to be ready
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        console.log('✓ Page loaded');

        // Wait a bit for services to initialize
        await page.waitForTimeout(2000);

        // Click on character info to select character
        console.log('Clicking character info...');
        const characterInfo = page.locator('.character-info');
        await expect(characterInfo).toBeVisible({ timeout: 10000 });
        await characterInfo.click();
        await page.waitForTimeout(1000);

        // Click Character Build button
        console.log('Clicking Character Build button...');
        const buildButton = page.getByRole('button', { name: /Character Build/i });
        await expect(buildButton).toBeVisible({ timeout: 10000 });
        await buildButton.click();
        await page.waitForTimeout(2000);

        // Wait for build page to load
        await page.waitForSelector('.class-card-body', { timeout: 10000 });
        console.log('✓ Build page loaded');

        // Click Class section button
        console.log('Clicking Class button...');
        const classButton = page.getByRole('button', { name: 'Class' });
        await expect(classButton).toBeVisible({ timeout: 10000 });
        await classButton.click();
        await page.waitForTimeout(1000);

        // Check if class select dropdown exists
        console.log('Looking for class dropdown...');
        const classSelect = page.locator('#classSelect');
        const classSelectExists = await classSelect.count();
        console.log('Class select count:', classSelectExists);

        if (classSelectExists === 0) {
            // Check what's actually in the class card
            const classCardHtml = await page.locator('.class-card-body').innerHTML();
            console.log('Class card HTML:', classCardHtml.substring(0, 500));
        }

        await expect(classSelect).toBeVisible({ timeout: 10000 });
        console.log('✓ Class dropdown visible');

        // Get the selected value
        const classValue = await classSelect.evaluate((el) => el.value);
        console.log('Class dropdown value:', classValue);

        // Get all options
        const classOptions = await classSelect.locator('option').allTextContents();
        console.log('Class dropdown options:', classOptions);

        // Check if subclass select exists
        const subclassSelect = page.locator('#subclassSelect');
        const subclassVisible = await subclassSelect.isVisible();
        console.log('Subclass dropdown visible:', subclassVisible);

        if (subclassVisible) {
            const subclassValue = await subclassSelect.evaluate((el) => el.value);
            console.log('Subclass dropdown value:', subclassValue);

            const subclassOptions = await subclassSelect
                .locator('option')
                .allTextContents();
            console.log('Subclass dropdown options:', subclassOptions);
        }

        // Get character data from AppState for debugging
        const characterData = await page.evaluate(() => {
            const AppState = window.AppState;
            if (!AppState) return null;
            const char = AppState.getCurrentCharacter();
            if (!char) return null;
            return {
                name: char.name,
                progression: char.progression,
                hasPrimaryClass: typeof char.getPrimaryClass === 'function',
                primaryClass: char.getPrimaryClass ? char.getPrimaryClass() : null,
            };
        });
        console.log('Character data from AppState:', JSON.stringify(characterData, null, 2));

        // Check if character is loaded properly
        expect(characterData).not.toBeNull();
        expect(characterData.progression).toBeDefined();
        expect(characterData.progression.classes).toHaveLength(1);

        // Verify getPrimaryClass exists and works
        expect(characterData.hasPrimaryClass).toBe(true);
        expect(characterData.primaryClass).not.toBeNull();
        expect(characterData.primaryClass.name).toBe('Warlock');
        expect(characterData.primaryClass.subclass).toBe('The Fiend');

        // Check if the class dropdown has the correct value selected
        expect(classValue).toBe('Warlock_PHB');

        // Check if subclass dropdown is visible and has correct value
        expect(subclassVisible).toBe(true);
        const finalSubclassValue = await subclassSelect.evaluate((el) => el.value);
        expect(finalSubclassValue).toBe('The Fiend');

        console.log('✓ Test completed successfully');
    } finally {
        await electronApp.close();
    }
});
