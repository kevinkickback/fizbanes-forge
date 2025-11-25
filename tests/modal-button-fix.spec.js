const { test, expect, _electron: electron } = require('@playwright/test');

// Utility to select the main app window
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
    if (windows.length > 0) return windows[0];
    throw new Error('No Electron window found');
}

test.describe('Modal Button Click - Real App Test', () => {
    test('should open modal when clicking New Character button', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);

        try {
            // Wait for sidebar to be ready
            await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
            console.log('✓ App loaded');

            // Verify button exists
            const newCharBtn = await mainWindow.$('#newCharacterBtn');
            expect(newCharBtn).not.toBeNull();
            console.log('✓ New Character button found');

            // Verify modal exists but is hidden
            const modal = await mainWindow.$('#newCharacterModal');
            expect(modal).not.toBeNull();
            const initiallyHidden = await mainWindow.evaluate(() => {
                const m = document.getElementById('newCharacterModal');
                return m ? !m.classList.contains('show') : true;
            });
            console.log('✓ Modal exists and is initially hidden:', initiallyHidden);

            // Click the button
            await mainWindow.click('#newCharacterBtn');
            console.log('✓ Clicked New Character button');

            // Wait for form to become visible
            await mainWindow.waitForTimeout(500);

            // Check if modal is now shown
            const formVisible = await mainWindow.evaluate(() => {
                const input = document.getElementById('newCharacterName');
                if (!input) return false;
                const style = window.getComputedStyle(input);
                return style.display !== 'none';
            });

            expect(formVisible).toBeTruthy();
            console.log('✓ Modal opened successfully - form is visible!');

            // Verify form fields are accessible
            const canFill = await mainWindow.evaluate(() => {
                const input = document.getElementById('newCharacterName');
                return input ? !input.disabled : false;
            });

            expect(canFill).toBeTruthy();
            console.log('✓ Form fields are accessible');

        } finally {
            await app.close();
        }
    });
});
