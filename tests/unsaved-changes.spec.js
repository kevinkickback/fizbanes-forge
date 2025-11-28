const { test, expect, _electron: electron } = require('@playwright/test');

// Reuse helper to select the main app window
async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
    const start = Date.now();
    let windows = [];
    while (Date.now() - start < maxWaitMs) {
        windows = await app.windows();
        if (windows.length > 0) break;
        await new Promise(res => setTimeout(res, pollIntervalMs));
    }
    for (const win of windows) {
        try {
            const title = await win.title();
            if (title && !title.includes('DevTools')) return win;
        } catch (e) {
            // ignore
        }
    }
    return windows[0] || null;
}

test.describe('Unsaved changes indicator', () => {
    test('shows when details form is edited and hides after save', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });

        // Select a character card before navigation
        await mainWindow.waitForSelector('.character-card', { timeout: 10000 });
        await mainWindow.click('.character-card');

        // Navigate to details
        await mainWindow.click('button[data-page="details"]');
        await mainWindow.waitForSelector('#characterName', { timeout: 10000 });

        // Ensure indicator starts hidden
        const unsaved = mainWindow.locator('#unsavedChangesIndicator');
        await expect(unsaved).toBeHidden();

        // Wait briefly to avoid initialization suppression, then make a manual change
        await mainWindow.waitForTimeout(500);
        await mainWindow.fill('#characterName', 'Playwright Test Name');
        // Allow event propagation
        await mainWindow.waitForTimeout(300);

        // Indicator should be visible
        await expect(unsaved).toBeVisible();

        // Click save
        await mainWindow.click('#saveCharacter');
        // Allow save flow
        await mainWindow.waitForTimeout(500);

        // Indicator should be hidden after save
        await expect(unsaved).toBeHidden();

        await app.close();
    });
});
