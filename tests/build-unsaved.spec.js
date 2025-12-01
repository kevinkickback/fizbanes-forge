const { test, expect, _electron: electron } = require('@playwright/test');

async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
	const start = Date.now();
	let windows = [];
	while (Date.now() - start < maxWaitMs) {
		windows = await app.windows();
		if (windows.length > 0) break;
		await new Promise((res) => setTimeout(res, pollIntervalMs));
	}
	for (const win of windows) {
		try {
			const title = await win.title();
			if (title && !title.includes('DevTools')) return win;
		} catch (_e) {}
	}
	return windows[0] || null;
}

test('build page should not show unsaved indicator on navigation', async () => {
	const app = await electron.launch({ args: ['.'] });
	const mainWindow = await getMainWindow(app);
	if (!mainWindow) throw new Error('No Electron window');

	await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
	await mainWindow.waitForSelector('.character-card', { timeout: 10000 });
	await mainWindow.click('.character-card');

	// Navigate to build page
	await mainWindow.click('button[data-page="build"]');
	// Wait for potential initialization to complete
	await mainWindow.waitForTimeout(800);

	const unsaved = mainWindow.locator('#unsavedChangesIndicator');
	await expect(unsaved).toBeHidden();

	await app.close();
});
