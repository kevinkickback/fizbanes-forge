import { _electron as electron, expect, test } from '@playwright/test';

async function launchApp() {
    const app = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    let page = app.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await app.waitForEvent(
            'window',
            (win) => !win.url().startsWith('devtools://'),
        );
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });

    return { app, page };
}

async function dismissLoadingModal(page) {
    const loadingModal = page.locator('#loadingModal');
    if ((await loadingModal.count()) === 0) return;

    try {
        await page.waitForSelector('#loadingModal.show', {
            state: 'hidden',
            timeout: 10000,
        });
    } catch {
        await page.evaluate(() => {
            const modal = document.getElementById('loadingModal');
            if (!modal) return;
            const instance =
                window.bootstrap?.Modal?.getInstance(modal) ||
                new window.bootstrap.Modal(modal);
            instance.hide();
            modal.classList.remove('show');
            modal.style.display = 'none';
        });
        await page.waitForTimeout(250);
    }
}

test.describe('Refresh Progress Modal', () => {
    test('exposes Done button after refresh completes', async () => {
        test.setTimeout(60000);
        let app;

        try {
            const launched = await launchApp();
            app = launched.app;
            const { page } = launched;

            await dismissLoadingModal(page);

            await page.click('button.nav-link[data-page="settings"]');
            await page.waitForSelector('[data-current-page="settings"]', {
                timeout: 30000,
            });

            await page.evaluate(() => {
                const originalRefresh = window.app.refreshDataSource;
                const originalOnProgress = window.app.onDataDownloadProgress;
                window.__refreshOriginals = { originalRefresh, originalOnProgress };

                const events = [];
                window.__refreshTestLog = events;

                window.app.onDataDownloadProgress = (cb) => {
                    const steps = [
                        { status: 'start', total: 3, completed: 0, file: 'init' },
                        { status: 'progress', total: 3, completed: 1, file: 'file-a' },
                        { status: 'progress', total: 3, completed: 2, file: 'file-b' },
                        { status: 'complete', total: 3, completed: 3, skipped: 0 },
                    ];
                    steps.forEach((step) => {
                        events.push({ stage: 'progress', step });
                        cb(step);
                    });
                    return () => {
                        events.push({ stage: 'unsubscribed' });
                    };
                };

                window.app.refreshDataSource = async () => {
                    events.push({ stage: 'refresh-called' });
                    await new Promise((resolve) => setTimeout(resolve, 150));
                    events.push({ stage: 'refresh-resolved' });
                    return { success: true, downloaded: 3, skipped: 0 };
                };
            });

            const refreshButton = page.locator('#refreshDataSourceBtn');
            await expect(refreshButton).toBeVisible({ timeout: 15000 });
            await refreshButton.click();

            const modal = page.locator('#refreshProgressModal');
            await expect(modal).toBeVisible({ timeout: 10000 });

            const confirmButton = modal.locator('.refresh-progress-confirm');
            await expect(confirmButton).toBeVisible({ timeout: 10000 });
            await expect(confirmButton).toHaveClass(/show/);

            const debugInfo = await page.evaluate(() => {
                const modalEl = document.getElementById('refreshProgressModal');
                const button = modalEl?.querySelector('.refresh-progress-confirm');
                return {
                    buttonClasses: button?.className || '',
                    buttonDisplay: button
                        ? window.getComputedStyle(button).display
                        : '',
                    statusText:
                        modalEl
                            ?.querySelector('.refresh-progress-status')
                            ?.textContent?.trim() || '',
                    messageText:
                        modalEl
                            ?.querySelector('.refresh-progress-message')
                            ?.textContent?.trim() || '',
                    events: window.__refreshTestLog || [],
                };
            });

            console.log('Refresh modal debug info:', JSON.stringify(debugInfo, null, 2));

            await page.screenshot({
                path: 'test-results/refresh-progress-confirm.png',
            });

            await confirmButton.click();
            await expect(modal).toBeHidden({ timeout: 10000 });

            await page.evaluate(() => {
                const originals = window.__refreshOriginals;
                if (originals?.originalRefresh) {
                    window.app.refreshDataSource = originals.originalRefresh;
                }
                if (originals?.originalOnProgress) {
                    window.app.onDataDownloadProgress = originals.originalOnProgress;
                }
            });
        } finally {
            if (app) {
                await app.close();
            }
        }
    });
});
