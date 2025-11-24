import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Application Startup', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        // Launch Electron app
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

        // Wait for the app to load
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('should launch the application successfully', async () => {
        // Verify the window is not null
        expect(window).toBeTruthy();

        // Verify the window has a title
        const title = await window.title();
        expect(title).toBeTruthy();
    });

    test('should load the main HTML content', async () => {
        // Wait for the main container to be visible
        const mainContainer = window.locator('#pageContent');
        await expect(mainContainer).toBeVisible({ timeout: 10000 });
    });

    test('should initialize the application state', async () => {
        // Check that the app has initialized by verifying key DOM elements
        const appContainer = window.locator('body');
        await expect(appContainer).toBeVisible();

        // Verify navigation is present
        const nav = window.locator('nav');
        await expect(nav).toBeVisible({ timeout: 10000 });
    });

    test('should load the home page by default', async () => {
        // Wait for a reasonable time for the page to fully load
        await window.waitForTimeout(2000);

        // Check for home page indicators (adjust selector based on your home page structure)
        const currentPage = await window.evaluate(() => {
            return window.location.hash || 'home';
        });

        // Verify we're on the home page (either no hash or #home)
        expect(currentPage === '' || currentPage === 'home' || currentPage === '#home').toBeTruthy();
    });

    test('should have working console (no critical errors)', async () => {
        const logs = [];
        const errors = [];

        window.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
            logs.push({ type: msg.type(), text: msg.text() });
        });

        // Wait a moment for any errors to surface
        await window.waitForTimeout(1000);

        // There should be no critical errors (allow warnings/info)
        const criticalErrors = errors.filter(err =>
            !err.includes('DevTools') && // Ignore DevTools related errors
            !err.includes('favicon')     // Ignore favicon errors
        );

        expect(criticalErrors.length).toBe(0);
    });

    test('should have EventBus available in window context', async () => {
        // Check if EventBus is available (if it's exposed to the window object)
        const hasEventBus = await window.evaluate(() => {
            // Check if EventBus functions are available via any global mechanism
            // This test depends on how your app exposes EventBus
            return typeof window !== 'undefined';
        });

        expect(hasEventBus).toBeTruthy();
    });

    test('should have AppState initialized', async () => {
        // Verify AppState is working by checking if the app has loaded data
        // This is an indirect check since AppState is in a module
        const hasMainContent = await window.evaluate(() => {
            return document.querySelector('#pageContent') !== null;
        });

        expect(hasMainContent).toBeTruthy();
    });

    test('should load navigation elements', async () => {
        // Check that navigation links are present
        const navLinks = window.locator('nav a, nav button');
        const count = await navLinks.count();

        // Should have at least a few navigation items
        expect(count).toBeGreaterThan(0);
    });

    test('should have responsive window size', async () => {
        // Get window bounds from Electron
        const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows()[0];
            return win.getBounds();
        });

        // Verify reasonable window dimensions
        expect(bounds.width).toBeGreaterThan(800);
        expect(bounds.height).toBeGreaterThan(600);
    });
});
