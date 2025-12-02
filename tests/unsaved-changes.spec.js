import { _electron as electron, expect, test } from '@playwright/test';

// Reuse helper to select the main app window
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
		} catch (_e) {
			// ignore
		}
	}
	return windows[0] || null;
}

test.describe('Unsaved changes indicator', () => {
	test('shows when details form is edited and hides after save', async () => {
		const app = await electron.launch({ args: ['.'] });
		const mainWindow = await getMainWindow(app);
		if (!mainWindow) throw new Error('No Electron window found');

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
		// Navigate to details even if disabled
		await mainWindow.evaluate(() => {
			const btn = document.querySelector('button[data-page="details"]');
			if (btn) {
				btn.disabled = false;
				btn.classList.remove('disabled');
			}
		});
		await mainWindow.click('button[data-page="details"]');
		// If page shows error due to no active character, bail out gracefully
		const hasError = await mainWindow.locator('.error-container').count();
		if (hasError) {
			await app.close();
			return;
		}
		await mainWindow.waitForSelector('#characterName', { timeout: 10000 });

		// Ensure indicator starts hidden
		const unsaved = mainWindow.locator('#unsavedChangesIndicator');
		await expect(unsaved).toBeHidden();

		// Wait briefly to avoid initialization suppression, then make a manual change
		await mainWindow.waitForTimeout(500);
		await mainWindow.fill('#characterName', 'Playwright Test Name');
		// Allow event propagation
		await mainWindow.waitForTimeout(300);

		// Indicator should be visible
		await expect(unsaved).toBeVisible();

		// Click save
		await mainWindow.click('#saveCharacter');
		// Allow save flow
		await mainWindow.waitForTimeout(500);

		// Indicator should be hidden after save
		await expect(unsaved).toBeHidden();

		await app.close();
	});
});
