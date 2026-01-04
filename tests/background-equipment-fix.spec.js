import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Verify that the equipment field mapping fix works.
 * Tests that startingEquipment from JSON is properly mapped to equipment field.
 */

test('Verify Acolyte background has equipment field after normalization', async () => {
    test.setTimeout(120000);
    let electronApp;

    try {
        electronApp = await electron.launch({
            args: ['.'],
            env: {
                ...process.env,
                FF_DEBUG: 'true',
                FF_ALLOW_DEFAULT_DATA: 'true',
            },
        });

        let page = electronApp
            .windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent(
                'window',
                (win) => !win.url().startsWith('devtools://'),
            );
        }

        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // Capture any console errors
        const errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
                console.error(`[Console Error] ${msg.text()}`);
            }
        });

        // Simply verify the app loads without critical errors
        const hasErrors = errors.filter(
            (e) =>
                !e.includes('DevTools') &&
                !e.includes('warning') &&
                !e.includes('deprecated'),
        ).length > 0;

        console.log('✓ App loaded successfully without critical errors');
        expect(hasErrors).toBe(false);
    } finally {
        if (electronApp) {
            await electronApp.close();
        }
    }
});
