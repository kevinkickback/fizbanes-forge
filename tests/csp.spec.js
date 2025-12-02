import { _electron as electron, expect, test } from '@playwright/test';

async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
    const start = Date.now();
    let windows = [];
    while (Date.now() - start < maxWaitMs) {
        windows = await app.windows();
        if (windows.length > 0) break;
        await new Promise((res) => setTimeout(res, pollIntervalMs));
    }
    for (const win of windows) {
        const title = await win.title().catch(() => '');
        if (title && !title.includes('DevTools')) return win;
    }
    return windows[0] || null;
}

test.describe('CSP Tightening', () => {
    test('index.html includes strict CSP meta', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        const csp = await mainWindow.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta?.getAttribute('content') || '';
        });

        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");

        await app.close();
    });

    test('inline scripts are blocked by CSP', async () => {
        const app = await electron.launch({ args: ['.'] });
        const mainWindow = await getMainWindow(app);
        if (!mainWindow) throw new Error('No Electron window found');

        const result = await mainWindow.evaluate(() => {
            window.__cspTestVar = 'not-set';
            const s = document.createElement('script');
            s.textContent = "window.__cspTestVar = 'set-by-inline'";
            document.head.appendChild(s);
            return window.__cspTestVar;
        });

        // If CSP blocks inline scripts, the variable should remain 'not-set'
        expect(result).toBe('not-set');

        await app.close();
    });
});
