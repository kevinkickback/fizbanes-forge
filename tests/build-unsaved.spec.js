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
	// Create a character via IPC so a card exists
	await mainWindow.evaluate(async () => {
		const idRes = await window.characterStorage.generateUUID();
		const id = idRes?.data || 'test-id';
		const character = {
			id,
			name: 'Test Hero',
			level: 1,
			allowedSources: ['PHB-2014'],
			abilityScores: {
				strength: 10,
				dexterity: 10,
				constitution: 10,
				intelligence: 10,
				wisdom: 10,
				charisma: 10,
			},
			proficiencies: {},
			hitPoints: { current: 10, max: 10, temp: 0 },
		};
		await window.characterStorage.saveCharacter(character);
	});
	// Reload home to render the character list
	await mainWindow.click('button[data-page="home"]');
	await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
	// Navigate to build page even if disabled
	await mainWindow.evaluate(() => {
		const btn = document.querySelector('button[data-page="build"]');
		if (btn) {
			btn.disabled = false;
			btn.classList.remove('disabled');
		}
	});
	await mainWindow.click('button[data-page="build"]');
	// Wait for potential initialization to complete
	await mainWindow.waitForTimeout(800);

	const unsaved = mainWindow.locator('#unsavedChangesIndicator');
	await expect(unsaved).toBeHidden();

	await app.close();
});
