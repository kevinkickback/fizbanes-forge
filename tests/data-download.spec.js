import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

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

function prefsPath() {
    return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        "Fizbane's Forge",
        'preferences.json',
    );
}

function cacheRootPath() {
    return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        "Fizbane's Forge",
        'cached-data',
    );
}

async function clearDataPreferences() {
    const file = prefsPath();
    if (!fs.existsSync(file)) return;
    const prefs = JSON.parse(fs.readFileSync(file, 'utf8'));
    prefs.dataSourceType = null;
    prefs.dataSourceValue = null;
    prefs.dataSourceCachePath = null;
    fs.writeFileSync(file, JSON.stringify(prefs, null, 2));
}

async function clearCache() {
    const root = cacheRootPath();
    await fsp.rm(root, { recursive: true, force: true });
}

function startStaticServer(rootDir) {
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url || '', 'http://localhost');
            const rel = url.pathname.replace(/^\/+/, '');
            const filePath = path.join(rootDir, rel);

            if (!filePath.startsWith(rootDir)) {
                res.statusCode = 403;
                res.end();
                return;
            }

            const stat = await fsp.stat(filePath);
            if (stat.isDirectory()) {
                res.statusCode = 404;
                res.end();
                return;
            }

            const stream = fs.createReadStream(filePath);
            res.statusCode = 200;
            res.setHeader('Content-Type', filePath.endsWith('.json') ? 'application/json' : 'application/octet-stream');
            stream.pipe(res);
        } catch (error) {
            res.statusCode = 404;
            res.end(error.message);
        }
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            resolve({ server, url: `http://127.0.0.1:${port}` });
        });
    });
}

function readPrefs() {
    if (!fs.existsSync(prefsPath())) return {};
    return JSON.parse(fs.readFileSync(prefsPath(), 'utf8'));
}

test.describe('Data download and cache usage', () => {
    test.setTimeout(120000);
    test.beforeEach(async () => {
        await clearDataPreferences();
        await clearCache();
    });

    test('downloads from URL and uses cached data on restart', async () => {
        const projectRoot = process.cwd();
        const { server, url } = await startStaticServer(projectRoot);
        const sourceUrl = `${url}/src`; // baseUrl will resolve to /src/data/...

        // First launch: validate & download
        let app = await electron.launch({
            args: ['.'],
            env: { ...process.env, FF_ALLOW_DEFAULT_DATA: 'false' },
        });
        let win = await getMainWindow(app);
        expect(win).toBeTruthy();

        const validation = await win.evaluate(async (value) => {
            return window.app.validateDataSource({ type: 'url', value });
        }, sourceUrl);

        expect(validation).toHaveProperty('success', true);

        await app.close();
        server.close();

        const prefs = readPrefs();
        expect(prefs.dataSourceType).toBe('url');
        expect(prefs.dataSourceValue).toBe(sourceUrl);
        expect(typeof prefs.dataSourceCachePath).toBe('string');
        expect(fs.existsSync(path.join(prefs.dataSourceCachePath, 'races.json'))).toBe(true);

        // Second launch with server offline: should load from cache
        app = await electron.launch({
            args: ['.'],
            env: { ...process.env, FF_ALLOW_DEFAULT_DATA: 'false' },
        });
        win = await getMainWindow(app);
        expect(win).toBeTruthy();

        const loadResult = await win.evaluate(async () => {
            return window.data.loadJSON('races.json');
        });

        expect(loadResult).toHaveProperty('success', true);
        expect(Array.isArray(loadResult.data?.race)).toBe(true);
        expect(loadResult.data.race.length).toBeGreaterThan(0);

        await app.close();
    });
});
