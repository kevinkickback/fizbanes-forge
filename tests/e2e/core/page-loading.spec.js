import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Page Loading', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../../app/main.js')]
        });
        
        // Wait for both DevTools and Main app windows to open (DEBUG_MODE=true)
        await electronApp.context().waitForEvent('page');
        await electronApp.context().waitForEvent('page');
        
        // Find the main window (not devtools)
        const windows = electronApp.windows();
        window = windows.find(w => !w.url().includes('devtools'));
        
        if (!window) {
            throw new Error('Could not find main app window!');
        }
        
        await window.waitForLoadState('domcontentloaded');
        // Give the app a moment to fully initialize
        await window.waitForTimeout(2000);
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    const pages = [
        { name: 'home', selector: '#pageContent', hash: '' },
        { name: 'build', selector: '#pageContent', hash: '#build' },
        { name: 'equipment', selector: '#pageContent', hash: '#equipment' },
        { name: 'spells', selector: '#pageContent', hash: '#spells' },
        { name: 'details', selector: '#pageContent', hash: '#details' },
        { name: 'settings', selector: '#pageContent', hash: '#settings' }
    ];

    for (const page of pages) {
        test(`should load ${page.name} page`, async () => {
            // Navigate to the page via hash change
            await window.evaluate((hash) => {
                window.location.hash = hash;
            }, page.hash);

            // Wait for navigation to complete
            await window.waitForTimeout(500);

            // Verify the main content container is still visible
            const mainContent = window.locator(page.selector);
            await expect(mainContent).toBeVisible();

            // Verify the hash changed (unless it's home which might have no hash)
            const currentHash = await window.evaluate(() => window.location.hash);
            if (page.hash) {
                expect(currentHash).toBe(page.hash);
            }
        });
    }

    test('should handle rapid page transitions', async () => {
        // Navigate through pages quickly
        for (const page of pages) {
            await window.evaluate((hash) => {
                window.location.hash = hash;
            }, page.hash);
            await window.waitForTimeout(200); // Small delay between transitions
        }

        // Verify we end up on the last page and app is still responsive
        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });

    test('should maintain page state during navigation', async () => {
        // Navigate to build page
        await window.evaluate(() => {
            window.location.hash = '#build';
        });
        await window.waitForTimeout(500);

        // Navigate away
        await window.evaluate(() => {
            window.location.hash = '#equipment';
        });
        await window.waitForTimeout(500);

        // Navigate back
        await window.evaluate(() => {
            window.location.hash = '#build';
        });
        await window.waitForTimeout(500);

        // Verify main content is still visible (page loaded successfully)
        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });

    test('should handle invalid page routes gracefully', async () => {
        // Try to navigate to a non-existent page
        await window.evaluate(() => {
            window.location.hash = '#nonexistent-page';
        });

        await window.waitForTimeout(500);

        // App should still be responsive (either show error or fallback to home/last valid page)
        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });

    test('should load page templates from separate files', async () => {
        // Navigate to each page and verify content loads
        const pagesToTest = ['build', 'equipment', 'spells', 'details', 'settings'];

        for (const pageName of pagesToTest) {
            await window.evaluate((hash) => {
                window.location.hash = hash;
            }, `#${pageName}`);

            await window.waitForTimeout(500);

            // Verify the main content has changed (not empty)
            const hasContent = await window.evaluate(() => {
                const content = document.querySelector('#pageContent');
                return content && content.innerHTML.trim().length > 0;
            });

            expect(hasContent).toBeTruthy();
        }
    });
});
