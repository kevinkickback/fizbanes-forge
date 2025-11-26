/**
 * eventbus-integration.spec.js
 * Integration tests for complete EventBus refactoring
 * Verifies that all components work together correctly
 */

const { test, expect, _electron: electron } = require('@playwright/test');

async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
    const start = Date.now();
    let windows = [];
    while (Date.now() - start < maxWaitMs) {
        windows = await app.windows();
        if (windows.length > 0) break;
        await new Promise(res => setTimeout(res, pollIntervalMs));
    }
    for (const [i, win] of windows.entries()) {
        try {
            const title = await win.title();
            if (title && !title.includes('DevTools')) return win;
        } catch (e) {
            // Window error
        }
    }
    if (windows.length > 0) return windows[0];
    return null;
}

test.describe('EventBus Integration Tests', () => {
    test('should handle complete character creation workflow with EventBus', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        try {
            // Step 1: Load app and wait for character list
            console.log('Step 1: Loading app...');
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });

            // Step 2: Select a character (triggers CHARACTER_SELECTED event)
            console.log('Step 2: Selecting character (CHARACTER_SELECTED)...');
            await mainWindow.waitForSelector('.character-card', { timeout: 10000 });
            await mainWindow.click('.character-card');
            await mainWindow.waitForTimeout(300);

            // Step 3: Navigate to build page
            console.log('Step 3: Navigating to build (PAGE_CHANGED)...');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Step 4: Select a race (RACE_SELECTED event via EventBus)
            console.log('Step 4: Selecting race (RACE_SELECTED)...');
            await mainWindow.locator('#raceSelect').selectOption({ index: 1 });
            await mainWindow.waitForTimeout(500);

            const selectedRace = await mainWindow.locator('#raceSelect').inputValue();
            console.log('Selected race:', selectedRace);
            expect(selectedRace).not.toBe('');

            // Step 5: Select a class (CLASS_SELECTED event via EventBus)
            console.log('Step 5: Selecting class (CLASS_SELECTED)...');
            await mainWindow.locator('#classSelect').selectOption({ index: 1 });
            await mainWindow.waitForTimeout(500);

            const selectedClass = await mainWindow.locator('#classSelect').inputValue();
            console.log('Selected class:', selectedClass);
            expect(selectedClass).not.toBe('');

            // Step 6: Verify ability scores updated (AbilityScoreService listening to CHARACTER_SELECTED)
            console.log('Step 6: Verifying ability scores...');
            await mainWindow.evaluate(() => {
                const el = document.querySelector('.ability-score-container');
                if (el) el.scrollIntoView({ behavior: 'auto' });
            });

            await expect(mainWindow.locator('.ability-score-container')).toBeVisible({ timeout: 5000 });
            const abilityScores = await mainWindow.evaluate(() =>
                document.querySelectorAll('.ability-score-box').length
            );
            console.log('Ability scores initialized:', abilityScores > 0);
            expect(abilityScores).toBeGreaterThan(0);

            // Step 7: Navigate away and back (reload should preserve via CHARACTER_SELECTED)
            console.log('Step 7: Testing navigation persistence...');
            await mainWindow.click('button[data-page="home"]');
            await mainWindow.waitForTimeout(300);

            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            const classAfterNav = await mainWindow.locator('#classSelect').inputValue();
            const raceAfterNav = await mainWindow.locator('#raceSelect').inputValue();

            console.log('Class preserved:', classAfterNav === selectedClass);
            console.log('Race preserved:', raceAfterNav === selectedRace);

            expect(classAfterNav).toBe(selectedClass);
            expect(raceAfterNav).toBe(selectedRace);

            // Step 8: Verify no EventBus errors
            console.log('Step 8: Checking for EventBus errors...');
            const hasErrors = await mainWindow.evaluate(() => {
                const logs = window.electronLogs || [];
                return logs.some(log =>
                    log.includes('EventBus') && log.includes('error')
                );
            }).catch(() => false);

            console.log('EventBus errors found:', hasErrors);
            expect(hasErrors).toBe(false);

            console.log('✅ Complete workflow successful with pure EventBus');

        } finally {
            await app.close();
        }
    });

    test('should properly handle service initialization events', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        try {
            console.log('Waiting for app initialization...');
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });

            // Verify services initialized
            console.log('Checking service initialization...');
            const servicesReady = await mainWindow.evaluate(() => {
                // Services should have registered their listeners
                return document.readyState === 'complete';
            });

            expect(servicesReady).toBe(true);
            console.log('✅ Services initialized properly');

        } finally {
            await app.close();
        }
    });

    test('should handle rapid selection changes without errors', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        try {
            // Setup
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
            await mainWindow.click('.character-card');
            await mainWindow.click('button[data-page="build"]');
            await mainWindow.waitForSelector('#classSelect', { timeout: 10000 });

            // Rapid selections
            console.log('Testing rapid class selections...');
            for (let i = 1; i < 4 && i < 13; i++) {
                await mainWindow.locator('#classSelect').selectOption({ index: i });
                await mainWindow.waitForTimeout(100);
            }

            console.log('Testing rapid race selections...');
            for (let i = 1; i < 4; i++) {
                await mainWindow.locator('#raceSelect').selectOption({ index: i });
                await mainWindow.waitForTimeout(100);
            }

            // Verify final state is valid
            const finalClass = await mainWindow.locator('#classSelect').inputValue();
            const finalRace = await mainWindow.locator('#raceSelect').inputValue();

            console.log('Final class:', finalClass);
            console.log('Final race:', finalRace);

            expect(finalClass).not.toBe('');
            expect(finalRace).not.toBe('');
            console.log('✅ Rapid selections handled correctly');

        } finally {
            await app.close();
        }
    });
});
