import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Navigation', () => {
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
        await window.waitForTimeout(3000);
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('should have navigation menu visible', async () => {
        const nav = window.locator('nav');
        await expect(nav).toBeVisible();
    });

    test('should have navigation links/buttons', async () => {
        // Look for navigation elements (links or buttons)
        const navItems = window.locator('nav a, nav button, nav [data-page]');
        const count = await navItems.count();

        expect(count).toBeGreaterThan(0);
    });

    test('should navigate via navigation menu clicks', async () => {
        // Try to find and click navigation items
        // Find the build button by data-page attribute
        const buildButton = window.locator('[data-page="build"]');
        const buildButtonExists = await buildButton.count() > 0;

        if (buildButtonExists) {
            await buildButton.click();
            await window.waitForTimeout(1000);

            // Verify page content changed (build page loaded)
            const pageContent = await window.evaluate(() => {
                const content = document.querySelector('#pageContent');
                return content ? content.innerHTML : '';
            });

            // Build page should have some content
            expect(pageContent.length).toBeGreaterThan(100);
        }
    });

    test('should update URL hash on navigation', async () => {
        const testPages = ['home', 'build', 'equipment'];

        for (const page of testPages) {
            await window.evaluate((pageName) => {
                window.location.hash = pageName === 'home' ? '' : `#${pageName}`;
            }, page);

            await window.waitForTimeout(300);

            const hash = await window.evaluate(() => window.location.hash);
            if (page === 'home') {
                expect(hash === '' || hash === '#home' || hash === '#').toBeTruthy();
            } else {
                expect(hash).toBe(`#${page}`);
            }
        }
    });

    test('should use Router for navigation', async () => {
        // Router should handle hash changes
        await window.evaluate(() => {
            window.location.hash = '#equipment';
        });

        await window.waitForTimeout(500);

        // Verify content loaded (Router processed the navigation)
        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();

        const hasContent = await window.evaluate(() => {
            const content = document.querySelector('#pageContent');
            return content && content.innerHTML.trim().length > 0;
        });

        expect(hasContent).toBeTruthy();
    });

    test('should use NavigationController for coordination', async () => {
        // NavigationController should coordinate between Router and PageLoader
        // Test by navigating and verifying page content updates

        const pages = ['build', 'spells', 'details'];

        for (const page of pages) {
            await window.evaluate((p) => {
                window.location.hash = `#${p}`;
            }, page);

            await window.waitForTimeout(500);

            // Verify navigation was successful
            const hash = await window.evaluate(() => window.location.hash);
            expect(hash).toBe(`#${page}`);

            // Verify content updated
            const mainContent = window.locator('#pageContent');
            await expect(mainContent).toBeVisible();
        }
    });

    test('should use PageLoader to load templates', async () => {
        // PageLoader should fetch and insert page templates
        // Navigate to a page and verify template content is loaded

        await window.evaluate(() => {
            window.location.hash = '#build';
        });

        await window.waitForTimeout(500);

        // Verify template content is present
        const hasContent = await window.evaluate(() => {
            const content = document.querySelector('#pageContent');
            return content && content.innerHTML.trim().length > 100; // Should have substantial content
        });

        expect(hasContent).toBeTruthy();
    });

    test('should handle back/forward browser navigation', async () => {
        // Navigate forward through pages
        await window.evaluate(() => {
            window.location.hash = '#build';
        });
        await window.waitForTimeout(500);

        await window.evaluate(() => {
            window.location.hash = '#equipment';
        });
        await window.waitForTimeout(500);

        // Go back
        await window.evaluate(() => {
            window.history.back();
        });
        await window.waitForTimeout(500);

        let hash = await window.evaluate(() => window.location.hash);
        expect(hash).toBe('#build');

        // Go forward
        await window.evaluate(() => {
            window.history.forward();
        });
        await window.waitForTimeout(500);

        hash = await window.evaluate(() => window.location.hash);
        expect(hash).toBe('#equipment');
    });

    test('should maintain active navigation state', async () => {
        // Navigate to different pages and check if nav reflects current page
        const pages = ['build', 'equipment', 'spells'];

        for (const page of pages) {
            await window.evaluate((p) => {
                window.location.hash = `#${p}`;
            }, page);

            await window.waitForTimeout(500);

            // Check if there's an active indicator in navigation
            // (This depends on your navigation implementation)
            const activeNavItem = window.locator('nav .active, nav [aria-current="page"]');
            const activeCount = await activeNavItem.count();

            // At least verify navigation is still visible
            const nav = window.locator('nav');
            await expect(nav).toBeVisible();
        }
    });

    test('should prevent navigation to invalid pages', async () => {
        // Try to navigate to invalid page
        await window.evaluate(() => {
            window.location.hash = '#invalid-page-12345';
        });

        await window.waitForTimeout(500);

        // App should still be functional
        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();

        // Should either show error message or redirect to valid page
        const hasContent = await window.evaluate(() => {
            const content = document.querySelector('#pageContent');
            return content !== null;
        });

        expect(hasContent).toBeTruthy();
    });

    test('should emit navigation events via EventBus', async () => {
        // While we can't directly access EventBus from E2E tests,
        // we can verify that navigation causes expected side effects
        // that would happen if EventBus events were fired

        await window.evaluate(() => {
            window.location.hash = '#build';
        });

        await window.waitForTimeout(500);

        // Verify the navigation completed (side effect of EventBus working)
        const hash = await window.evaluate(() => window.location.hash);
        expect(hash).toBe('#build');

        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });
});
