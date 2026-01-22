import { test as base } from '@playwright/test';

/**
 * Fixture that captures console messages from the page/renderer
 * All console output is logged to terminal for visibility during test runs
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        // Capture all console messages
        page.on('console', msg => {
            const type = msg.type().toUpperCase();
            console.log(`[CONSOLE ${type}] ${msg.text()}`);
        });

        // Capture page errors
        page.on('pageerror', err => {
            console.error('[PAGE ERROR]', err);
        });

        // Capture request failures
        page.on('requestfailed', req => {
            console.error(`[REQUEST FAILED] ${req.url()} - ${req.failure().errorText}`);
        });

        await use(page);
    },
});

export { expect } from '@playwright/test';
