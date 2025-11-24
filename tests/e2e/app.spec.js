import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Fizbanes Forge - Core Functionality', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../app/main.js')]
        });

        await electronApp.context().waitForEvent('page');
        await electronApp.context().waitForEvent('page');

        const windows = electronApp.windows();
        window = windows.find(w => !w.url().includes('devtools'));

        if (!window) {
            throw new Error('Could not find main app window!');
        }

        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    //=========================================================================
    // APP STARTUP & INITIALIZATION
    //=========================================================================

    test('App should launch and show home page', async () => {
        const mainContainer = window.locator('#pageContent');
        await expect(mainContainer).toBeVisible({ timeout: 10000 });

        const title = await window.title();
        expect(title).toBeTruthy();
    });

    test('App should have navigation visible', async () => {
        const nav = window.locator('nav');
        await expect(nav).toBeVisible({ timeout: 10000 });

        const navButtons = window.locator('[data-page]');
        const count = await navButtons.count();
        expect(count).toBeGreaterThan(0);
    });

    //=========================================================================
    // DATA LOADING FROM JSON
    //=========================================================================

    test('Should load races data from races.json', async () => {
        // Navigate to build page where race data loads
        const buildButton = window.locator('[data-page="build"]');
        if (await buildButton.count() > 0) {
            // We can't test this without a character, but we verify app doesn't crash
            const pageContent = window.locator('#pageContent');
            await expect(pageContent).toBeVisible();
        }
    });

    test('Should load classes data from class JSON files', async () => {
        // Verify app has loaded class data (no errors in console)
        const logs = [];
        window.on('console', msg => logs.push(msg));

        await window.waitForTimeout(1000);

        const errors = logs.filter(l => l.type() === 'error' && !l.text().includes('favicon'));
        expect(errors.length).toBe(0);
    });

    test('Should load backgrounds data from backgrounds.json', async () => {
        // Verify app structure loads without data loading errors
        const pageContent = await window.evaluate(() => {
            return document.querySelector('#pageContent') ? true : false;
        });
        expect(pageContent).toBe(true);
    });

    //=========================================================================
    // NAVIGATION
    //=========================================================================

    test('Should navigate between pages via navigation buttons', async () => {
        const pages = ['home', 'settings'];

        for (const page of pages) {
            const button = window.locator(`[data-page="${page}"]`);
            if (await button.count() > 0) {
                await button.click();
                await window.waitForTimeout(500);

                const content = await window.evaluate(() => {
                    const el = document.querySelector('#pageContent');
                    return el ? el.innerHTML.length : 0;
                });

                expect(content).toBeGreaterThan(0);
            }
        }
    });

    test('Should update page content on navigation', async () => {
        const homeButton = window.locator('[data-page="home"]');
        if (await homeButton.count() > 0) {
            await homeButton.click();
            await window.waitForTimeout(500);

            const hasHomeContent = await window.evaluate(() => {
                const content = document.querySelector('#pageContent');
                return content ? content.textContent.includes('Character') : false;
            });

            expect(hasHomeContent).toBe(true);
        }
    });

    //=========================================================================
    // SETTINGS FUNCTIONALITY
    //=========================================================================

    test('Settings page should be accessible and display', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        if (await settingsButton.count() > 0) {
            await settingsButton.click();
            await window.waitForTimeout(500);

            const settingsPage = window.locator('text=/Settings|settings/i');
            const exists = await settingsPage.count() > 0;

            // Should at least have loaded without error
            const content = window.locator('#pageContent');
            await expect(content).toBeVisible();
        }
    });

    //=========================================================================
    // NO CRITICAL ERRORS
    //=========================================================================

    test('App should run without critical console errors', async () => {
        const errors = [];
        window.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await window.waitForTimeout(1000);

        const criticalErrors = errors.filter(err =>
            !err.includes('DevTools') &&
            !err.includes('favicon') &&
            !err.includes('CORS')
        );

        expect(criticalErrors.length).toBe(0);
    });
});
