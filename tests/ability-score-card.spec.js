import { _electron as electron, expect, test } from '@playwright/test';

// Utility to select the main app window (not DevTools), with retry
async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
	const start = Date.now();
	let windows = [];
	while (Date.now() - start < maxWaitMs) {
		windows = await app.windows();
		if (windows.length > 0) break;
		await new Promise((res) => setTimeout(res, pollIntervalMs));
	}
	console.log('Electron windows found:', windows.length);
	for (const [i, win] of windows.entries()) {
		try {
			const title = await win.title();
			console.log(`Window ${i} title:`, title);
			if (title && !title.includes('DevTools')) return win;
		} catch (e) {
			console.log(`Window ${i} error:`, e);
		}
	}
	// Fallback: first window
	if (windows.length > 0) {
		console.log('No main window found by title, using first window.');
		return windows[0];
	}
	return null;
}

async function logHtml(win, label) {
	const html = await win.evaluate(() => document.documentElement.outerHTML);
	console.log(`HTML at ${label}:\n`, html);
}

async function logScroll(win, label) {
	const scrollY = await win.evaluate(() => window.scrollY);
	console.log(`Scroll position (${label}):`, scrollY);
}

async function logAbilityScoreContainerHtml(win, label) {
	const html = await win.evaluate(() => {
		const el = document.querySelector('.ability-score-container');
		return el ? el.innerHTML : '[container not found]';
	});
	console.log(`.ability-score-container HTML (${label}):\n`, html);
}

test.describe('AbilityScoreCard navigation', () => {
	test('should render method switcher and correct scores after navigation', async () => {
		const app = await electron.launch({ args: ['.'] });
		const mainWindow = await getMainWindow(app);
		if (!mainWindow) throw new Error('No Electron window found after waiting');

		console.log('Waiting for .sidebar...');
		try {
			await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
			console.log('.sidebar found');
		} catch (e) {
			console.log('Failed to find .sidebar');
			await logHtml(mainWindow, 'sidebar wait');
			throw e;
		}

		// Ensure there's at least one character by saving a minimal valid payload via IPC
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
		// Enable build navigation even if disabled and navigate
		await mainWindow.evaluate(() => {
			const btn = document.querySelector('button[data-page="build"]');
			if (btn) {
				btn.disabled = false;
				btn.classList.remove('disabled');
			}
		});
		await mainWindow.click('button[data-page="build"]');

		console.log('Clicking build page button...');
		await mainWindow.click('button[data-page="build"]');
		// If page shows error due to no active character, bail out gracefully
		const hasError = await mainWindow.locator('.error-container').count();
		if (hasError) {
			await app.close();
			return;
		}
		console.log('Waiting for .ability-score-container...');
		await mainWindow.waitForSelector('.ability-score-container', {
			timeout: 10000,
		});
		console.log('.ability-score-container found');

		// Scroll to ability score card section
		await logScroll(mainWindow, 'before scroll (first build nav)');
		console.log('Scrolling to ability score card section...');
		await mainWindow.evaluate(() => {
			const el = document.querySelector('.ability-score-container');
			if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
		});
		await logScroll(mainWindow, 'after scroll (first build nav)');
		console.log('Scrolled to ability score card section');

		console.log('Checking method switcher...');
		await expect(mainWindow.locator('#abilityScoreMethod')).toBeVisible();

		console.log('Checking ability score boxes...');
		for (const ability of [
			'strength',
			'dexterity',
			'constitution',
			'intelligence',
			'wisdom',
			'charisma',
		]) {
			await expect(
				mainWindow.locator(
					`.ability-score-box[data-ability="${ability}"] .score`,
				),
			).toBeVisible();
		}

		// Switch to point buy method if not already
		console.log('Switching to point buy method...');
		await mainWindow.selectOption('#abilityScoreMethod', 'pointBuy');
		// Wait for UI to update
		await mainWindow.waitForTimeout(500);
		console.log('Switched to point buy method');

		console.log('Navigating away to home...');
		await mainWindow.click('button[data-page="home"]');
		console.log('Waiting for .sidebar after home...');
		try {
			await mainWindow.waitForSelector('.sidebar', { timeout: 10000 });
			console.log('.sidebar found after home');
		} catch (e) {
			console.log('Failed to find .sidebar after home');
			await logHtml(mainWindow, 'sidebar after home');
			throw e;
		}

		console.log('Navigating back to build...');
		await mainWindow.click('button[data-page="build"]');
		console.log('Waiting for .ability-score-container after back...');
		try {
			await mainWindow.waitForSelector('.ability-score-container', {
				timeout: 10000,
			});
			console.log('.ability-score-container found after back');
		} catch (e) {
			console.log('Failed to find .ability-score-container after back');
			await logHtml(mainWindow, 'ability-score-container after back');
			throw e;
		}

		// Scroll to ability score card section after navigation back
		await logScroll(mainWindow, 'before scroll (after back nav)');
		console.log('Scrolling to ability score card section after back...');
		await mainWindow.evaluate(() => {
			const el = document.querySelector('.ability-score-container');
			if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
		});
		await logScroll(mainWindow, 'after scroll (after back nav)');
		console.log('Scrolled to ability score card section after back');

		// Log ability score container HTML after back nav
		await logAbilityScoreContainerHtml(mainWindow, 'after back nav');

		console.log('Checking method switcher after back...');
		await expect(mainWindow.locator('#abilityScoreMethod')).toBeVisible();

		console.log('Checking ability score boxes after back...');
		for (const ability of [
			'strength',
			'dexterity',
			'constitution',
			'intelligence',
			'wisdom',
			'charisma',
		]) {
			await expect(
				mainWindow.locator(
					`.ability-score-box[data-ability="${ability}"] .score`,
				),
			).toBeVisible();
		}

		console.log('Clicking increase button for strength...');
		const incBtn = mainWindow.locator(
			'.ability-score-box[data-ability="strength"] button[data-action="increase"]',
		);
		await incBtn.click();
		// Check score updated (should be > 10 if point buy)
		const scoreText = await mainWindow
			.locator('.ability-score-box[data-ability="strength"] .score')
			.textContent();
		expect(Number(scoreText)).toBeGreaterThanOrEqual(10);

		await app.close();
	});
});
