import { _electron as electron, expect, test } from '@playwright/test';

// Simulate a service initialization failure and verify warning banner + creation guard

test('shows service failure banner and blocks character creation', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    try {
        // Pipe renderer console to test output for easier debugging
        const pageLogs = [];

        // Acquire the renderer window (exclude devtools)
        let page = electronApp
            .windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent(
                'window',
                (win) => !win.url().startsWith('devtools://'),
            );
        }

        page.on('console', (msg) => {
            pageLogs.push(msg.text());
            console.log(`[console][${msg.type()}] ${msg.text()}`);
        });

        // Inject failure before app scripts run; force spells load to throw and clear caches
        await page.addInitScript(() => {
            try {
                window.localStorage?.removeItem('ff:data-cache:v1');
            } catch (_) {
                // ignore
            }

            const shouldFail = (url) => {
                if (!url) return false;
                const asString = String(url);
                return asString.includes('spells') && asString.endsWith('.json');
            };

            const originalLoader = window.data?.loadJSON;
            window.data = window.data || {};
            window.data.loadJSON = async (url) => {
                if (shouldFail(url)) {
                    console.error('[TestStub] loadJSON forced failure for', url);
                    throw new Error('forced spell load failure');
                }
                if (originalLoader) {
                    return originalLoader(url);
                }
                throw new Error('No data loader available');
            };

            // Also fail fetch as a fallback path for spell JSON
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = args?.[0];
                if (shouldFail(url)) {
                    console.error('[TestStub] fetch forced failure for', url);
                    throw new Error('forced spell fetch failure');
                }
                return originalFetch.apply(window, args);
            };
        });

        // Reload to ensure init script applies before AppInitializer runs
        await page.reload();

        // Wait for app to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Ensure stub actually fired (either loadJSON or fetch)
        const stubTriggered = pageLogs.some((log) => log.includes('[TestStub]'));
        expect(stubTriggered, 'expected stubbed failure to trigger').toBeTruthy();

        // Expect service failure banner to appear with the failed service listed
        const banner = page.locator('#serviceFailureBanner');
        await expect(banner).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#serviceFailureList')).toContainText(/spells/i);

        // Attempt to start character creation and expect it to be blocked
        const welcomeBtn = page.locator('#welcomeCreateCharacterBtn');
        const newBtn = page.locator('#newCharacterBtn');

        if (await welcomeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await welcomeBtn.click();
        } else if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newBtn.click();
        }

        await page.waitForSelector('#newCharacterModal', { timeout: 15000 });
        const nameInput = page.locator('#newCharacterName');
        if (await nameInput.isVisible().catch(() => false)) {
            await nameInput.fill('ShouldFail');
        }
        const nextBtn = page.locator('#wizardNextBtn');
        await nextBtn.click().catch(() => { });
        await nextBtn.click().catch(() => { });
        await nextBtn.click().catch(() => { });
        await nextBtn.click().catch(() => { });

        await expect(page.locator('.notification')).toContainText(
            /Cannot create characters/i,
            { timeout: 10000 },
        );
    } finally {
        await electronApp.close();
    }
});
