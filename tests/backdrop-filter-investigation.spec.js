import { _electron as electron } from '@playwright/test';
import { test } from './fixtures.js';

// Test to investigate backdrop-filter CSS on level-up modal
// Run with: "npx playwright test backdrop-filter-investigation.spec.js --headed"

test('Select character and open level-up modal to investigate backdrop-filter', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    // Get main renderer window (exclude DevTools)
    let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
    }

    // Set up console capturing
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`[CONSOLE ${type}] ${msg.text()}`);
    });

    try {
        // Wait for app to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#pageContent', { timeout: 60000 });

        console.log('✓ App loaded');

        // Wait for character cards to appear
        await page.waitForSelector('.character-card', { timeout: 30000 });
        console.log('✓ Character cards loaded');

        // Get the first character card and click it to select it
        const firstCharCard = page.locator('.character-card').first();
        await firstCharCard.click();
        console.log('✓ Clicked first character card');

        // Wait for the page to navigate to build page
        await page.waitForSelector('#buildPageContent, [data-page="build"]', { timeout: 10000 }).catch(() => null);
        console.log('✓ Character selected');

        // Wait a moment for the UI to stabilize
        await page.waitForTimeout(500);

        // Click the level-up button (usually in titlebar)
        const levelUpBtn = page.locator('[data-action="level-up"], .titlebar-action-button:has-text("Level Up"), button:has-text("Level Up")').first();

        // Try to find and click it
        const levelUpVisible = await levelUpBtn.isVisible().catch(() => false);
        if (levelUpVisible) {
            await levelUpBtn.click();
            console.log('✓ Clicked level-up button');
        } else {
            console.log('⚠ Level-up button not found, trying alternate selector');
            // Try clicking any button with level up text
            await page.click('button:has-text("Level Up")').catch(() => console.log('⚠ Could not find level up button'));
        }

        // Wait for the modal to appear
        await page.waitForSelector('.modal.show', { timeout: 10000 });
        console.log('✓ Modal opened');

        // Wait a moment for animations to complete
        await page.waitForTimeout(1000);

        // Now inspect the HTML and CSS
        const backdropHTML = await page.locator('.modal-backdrop').innerHTML();
        console.log('Modal Backdrop HTML:', backdropHTML);

        const backdropStyles = await page.locator('.modal-backdrop').evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                display: styles.display,
                position: styles.position,
                zIndex: styles.zIndex,
                backgroundColor: styles.backgroundColor,
                backdropFilter: styles.backdropFilter,
                webkitBackdropFilter: styles.webkitBackdropFilter,
                width: styles.width,
                height: styles.height,
                top: styles.top,
                left: styles.left,
                willChange: styles.willChange,
                transform: styles.transform,
            };
        });
        console.log('Modal Backdrop Computed Styles:', JSON.stringify(backdropStyles, null, 2));

        const modalStyles = await page.locator('.modal.show').evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                display: styles.display,
                zIndex: styles.zIndex,
                position: styles.position,
            };
        });
        console.log('Modal Computed Styles:', JSON.stringify(modalStyles, null, 2));

        // Check if backdrop filter is working
        const hasBackdropFilter = await page.locator('.modal-backdrop').evaluate(el => {
            const styles = window.getComputedStyle(el);
            const filter = styles.backdropFilter || styles.webkitBackdropFilter;
            return !!filter && filter !== 'none';
        });
        console.log('Backdrop Filter Active:', hasBackdropFilter);

        console.log('✓ Backdrop filter investigation complete - check console output above');

    } finally {
        await electronApp.close();
    }
});
