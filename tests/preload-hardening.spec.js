// Playwright-based sanity tests for hardened preload API
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

test.describe('Preload Hardened API', () => {
	test('exposes whitelisted domains and methods', async () => {
		const app = await electron.launch({ args: ['.'] });
		const mainWindow = await getMainWindow(app);
		if (!mainWindow) throw new Error('No Electron window found');

		// Check that FF_DEBUG and domains exist
		const hasFFDebug = await mainWindow.evaluate(
			() => typeof window.FF_DEBUG !== 'undefined',
		);
		expect(hasFFDebug).toBeTruthy();

		const hasApp = await mainWindow.evaluate(
			() => typeof window.app !== 'undefined',
		);
		const hasData = await mainWindow.evaluate(
			() => typeof window.data !== 'undefined',
		);
		const hasCharacterStorage = await mainWindow.evaluate(
			() => typeof window.characterStorage !== 'undefined',
		);
		expect(hasApp).toBeTruthy();
		expect(hasData).toBeTruthy();
		expect(hasCharacterStorage).toBeTruthy();

		// Ensure generic invoke bridges are not present
		const hasGenericInvoke = await mainWindow.evaluate(
			() => !!window.electron?.invoke,
		);
		expect(hasGenericInvoke).toBeFalsy();
	});

	test('can generate UUID and list characters', async () => {
		const app = await electron.launch({ args: ['.'] });
		const mainWindow = await getMainWindow(app);
		if (!mainWindow) throw new Error('No Electron window found');

		const uuidResult = await mainWindow.evaluate(() =>
			window.characterStorage.generateUUID(),
		);
		expect(uuidResult).toHaveProperty('success', true);
		expect(uuidResult).toHaveProperty('data');

		const listResult = await mainWindow.evaluate(() =>
			window.characterStorage.loadCharacters(),
		);
		expect(listResult).toHaveProperty('characters');
		expect(Array.isArray(listResult.characters)).toBeTruthy();
	});

	test('can load app data JSON via data domain', async () => {
		const app = await electron.launch({ args: ['.'] });
		const mainWindow = await getMainWindow(app);
		if (!mainWindow) throw new Error('No Electron window found');

		const skillsResult = await mainWindow.evaluate(() =>
			window.data.loadJSON('data/skills.json'),
		);
		expect(skillsResult).toHaveProperty('success', true);
		expect(skillsResult).toHaveProperty('data');
	});
});
