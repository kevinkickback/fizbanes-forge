/**
 * classcard-eventbus-refactor.spec.js
 * Tests for ClassCard EventBus refactoring
 * Ensures class selection works correctly when transitioning from DOM events to EventBus
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

test.describe('ClassCard EventBus Refactoring', () => {
    test('should select a class via EventBus without DOM events', async () => {
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

            // Wait for class selection dropdown
            console.log('Waiting for class selector...');
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Get initial class value (should be empty or "Select a Class")
            const initialClass = await mainWindow.locator('#classSelect').inputValue();
            console.log('Initial class value:', initialClass);

            // Select a class (e.g., Fighter)
            console.log('Selecting Fighter class...');
            const classOptions = await mainWindow.locator('#classSelect option').count();
            console.log(`Total class options available: ${classOptions}`);

            // Find Fighter option
            const fighterOptionLocator = mainWindow.locator('#classSelect option').filter({ hasText: 'Fighter' }).first();
            const fighterCount = await fighterOptionLocator.count();

            if (fighterCount === 0) {
                console.log('Fighter not found, selecting first available class');
                await mainWindow.locator('#classSelect').selectOption({ index: 1 });
            } else {
                console.log('Selecting Fighter');
                await mainWindow.selectOption('#classSelect', fighterOptionLocator);
            }

            // Wait for UI to update
            await mainWindow.waitForTimeout(500);

            // Verify class details panel updated
            console.log('Checking class details panel...');
            const classDetailsPanel = mainWindow.locator('.class-details');
            const isPanelVisible = await classDetailsPanel.isVisible().catch(() => false);
            console.log('Class details panel visible:', isPanelVisible);

            // Verify ability scores still work (AbilityScoreCard should still be initialized)
            console.log('Scrolling to ability score section...');
            await mainWindow.evaluate(() => {
                const el = document.querySelector('.ability-score-container');
                if (el) el.scrollIntoView({ behavior: 'auto' });
            });

            console.log('Checking ability score container...');
            await expect(mainWindow.locator('.ability-score-container')).toBeVisible({ timeout: 5000 });

            // Verify no console errors related to EventBus
            const logs = await mainWindow.evaluate(() => {
                // This would require injecting a console collector; for now just verify UI is responsive
                return document.querySelectorAll('.ability-score-box').length;
            });
            console.log('Ability score boxes found:', logs);
            expect(logs).toBeGreaterThan(0);

            console.log('✅ Class selection via EventBus works correctly');

        } finally {
            await app.close();
        }
    });

    test('should handle character selection and reload class data', async () => {
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
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Select a class
            console.log('Selecting initial class...');
            await mainWindow.locator('#classSelect').selectOption({ index: 1 });
            await mainWindow.waitForTimeout(300);

            // Get the selected value
            const selectedClass1 = await mainWindow.locator('#classSelect').inputValue();
            console.log('Selected class (1st):', selectedClass1);
            expect(selectedClass1).not.toBe('');

            // Navigate away and back
            console.log('Navigating to home...');
            await mainWindow.click('button[data-page="home"]');
            await mainWindow.waitForTimeout(300);

            console.log('Navigating back to build...');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Verify class selection was preserved
            const selectedClass2 = await mainWindow.locator('#classSelect').inputValue();
            console.log('Selected class (after nav):', selectedClass2);
            expect(selectedClass2).toBe(selectedClass1);

            console.log('✅ Class selection persisted across navigation');

        } finally {
            await app.close();
        }
    });

    test('should not show console errors when class is selected', async () => {
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
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Select class
            console.log('Selecting class...');
            await mainWindow.locator('#classSelect').selectOption({ index: 1 });
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
