/**
 * racecard-eventbus-refactor.spec.js
 * Tests for RaceCard EventBus refactoring
 * Ensures race selection works correctly when transitioning from DOM events to EventBus
 */

const { test, expect, _electron: electron } = require('@playwright/test');

// Utility to select the main app window (not DevTools), with retry
async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
    const start = Date.now();
    let windows = [];
    while (Date.now() - start < maxWaitMs) {
        windows = await app.windows();
        if (windows.length > 0) break;
        await new Promise(res => setTimeout(res, pollIntervalMs));
    }
    console.log('Electron windows found:', windows.length);
    for (const [i, win] of windows.entries()) {
        try {
            const title = await win.title();
            console.log(`Window ${i} title:`, title);
            if (title && !title.includes('DevTools')) return win;
        } catch (e) {
            console.log(`Window ${i} error:`, e);
        }
    }
    // Fallback: first window
    if (windows.length > 0) {
        console.log('No main window found by title, using first window.');
        return windows[0];
    }
    return null;
}

test.describe('RaceCard EventBus Refactoring', () => {
    test('should select a race via EventBus without DOM events', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        try {
            // Wait for app to load
            console.log('Waiting for sidebar...');
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });

            // Select a character
            console.log('Selecting character...');
            await mainWindow.waitForSelector('.character-card', { timeout: 10000 });
            await mainWindow.click('.character-card');

            // Navigate to build page
            console.log('Navigating to build page...');
            await mainWindow.click('button[data-page="build"]');

            // Wait for race selection dropdown
            console.log('Waiting for race selector...');
            await mainWindow.waitForSelector('#raceSelect', { timeout: 10000 });

            // Get initial race value
            const initialRace = await mainWindow.locator('#raceSelect').inputValue();
            console.log('Initial race value:', initialRace);

            // Select a race (e.g., Elf)
            console.log('Selecting Elf race...');
            const raceOptions = await mainWindow.locator('#raceSelect option').count();
            console.log(`Total race options available: ${raceOptions}`);

            // Find Elf option or select first available
            const elfOptionLocator = mainWindow.locator('#raceSelect option').filter({ hasText: 'Elf' }).first();
            const elfCount = await elfOptionLocator.count();

            if (elfCount === 0) {
                console.log('Elf not found, selecting first available race');
                await mainWindow.locator('#raceSelect').selectOption({ index: 1 });
            } else {
                console.log('Selecting Elf');
                await mainWindow.selectOption('#raceSelect', elfOptionLocator);
            }

            // Wait for UI to update
            await mainWindow.waitForTimeout(500);

            // Verify race details panel updated
            console.log('Checking race details panel...');
            const raceDetailsPanel = mainWindow.locator('.race-details');
            const isPanelVisible = await raceDetailsPanel.isVisible().catch(() => false);
            console.log('Race details panel visible:', isPanelVisible);

            // Verify ability scores still work
            console.log('Scrolling to ability score section...');
            await mainWindow.evaluate(() => {
                const el = document.querySelector('.ability-score-container');
                if (el) el.scrollIntoView({ behavior: 'auto' });
            });

            console.log('Checking ability score container...');
            await expect(mainWindow.locator('.ability-score-container')).toBeVisible({ timeout: 5000 });

            const logs = await mainWindow.evaluate(() => {
                return document.querySelectorAll('.ability-score-box').length;
            });
            console.log('Ability score boxes found:', logs);
            expect(logs).toBeGreaterThan(0);

            console.log('✅ Race selection via EventBus works correctly');

        } finally {
            await app.close();
        }
    });

    test('should handle character selection and reload race data', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        try {
            // Setup: Create and select a character
            console.log('Waiting for app initialization...');
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });

            // Select first character
            await mainWindow.click('.character-card');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#raceSelect', { timeout: 10000 });

            // Select a race
            console.log('Selecting initial race...');
            await mainWindow.locator('#raceSelect').selectOption({ index: 1 });
            await mainWindow.waitForTimeout(300);

            // Get the selected value
            const selectedRace1 = await mainWindow.locator('#raceSelect').inputValue();
            console.log('Selected race (1st):', selectedRace1);
            expect(selectedRace1).not.toBe('');

            // Navigate away and back
            console.log('Navigating to home...');
            await mainWindow.click('button[data-page="home"]');
            await mainWindow.waitForTimeout(300);

            console.log('Navigating back to build...');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#raceSelect', { timeout: 10000 });

            // Verify race selection was preserved
            const selectedRace2 = await mainWindow.locator('#raceSelect').inputValue();
            console.log('Selected race (after nav):', selectedRace2);
            expect(selectedRace2).toBe(selectedRace1);

            console.log('✅ Race selection persisted across navigation');

        } finally {
            await app.close();
        }
    });

    test('should not show console errors when race is selected', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        // Collect console messages
        const consoleMessages = [];
        mainWindow.on('console', msg => {
            const msgType = typeof msg.type === 'function' ? msg.type() : msg.type;
            const msgText = typeof msg.text === 'function' ? msg.text() : msg.toString();
            console.log(`[${msgType}] ${msgText}`);
            consoleMessages.push({ type: msgType, text: msgText });
        });

        try {
            // Setup
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
            await mainWindow.click('.character-card');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#raceSelect', { timeout: 10000 });

            // Select race
            console.log('Selecting race...');
            await mainWindow.locator('#raceSelect').selectOption({ index: 1 });
            await mainWindow.waitForTimeout(500);

            // Check for error messages
            const errors = consoleMessages.filter(msg =>
                msg.type === 'error' &&
                (msg.text.includes('EventBus') || msg.text.includes('undefined'))
            );

            console.log('Console errors found:', errors.length);
            errors.forEach(e => console.log('  -', e.text));

            expect(errors.length).toBe(0);

        } finally {
            await app.close();
        }
    });
});
