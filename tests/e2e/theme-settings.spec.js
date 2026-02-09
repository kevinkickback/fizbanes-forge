import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 3. Theme & Settings
 * Verifies theme toggling, persistence across navigation,
 * and the settings page rendering.
 */

async function launchAndWaitForHome() {
	const electronApp = await electron.launch({ args: ['.'] });

	let page = electronApp
		.windows()
		.find((win) => !win.url().startsWith('devtools://'));
	if (!page) {
		page = await electronApp.waitForEvent(
			'window',
			(win) => !win.url().startsWith('devtools://'),
		);
	}

	await page.waitForSelector('#pageContent', { timeout: 60_000 });
	return { electronApp, page };
}

test.describe('Theme & Settings', () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		test.setTimeout(60_000);
		({ electronApp, page } = await launchAndWaitForHome());
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test('3.1 — Theme toggle button switches between light and dark mode', async () => {
		const themeToggle = page.locator('#themeToggle');
		await expect(themeToggle).toBeVisible();

		// Read the initial theme
		const initialTheme = await page.getAttribute('html', 'data-theme');

		// Click to toggle
		await themeToggle.click();

		const afterToggle = await page.getAttribute('html', 'data-theme');
		expect(afterToggle).not.toBe(initialTheme);

		// The label text should reflect the new state
		const label = page.locator('#themeToggleLabel');
		if (afterToggle === 'dark') {
			await expect(label).toHaveText('Light Mode');
		} else {
			await expect(label).toHaveText('Dark Mode');
		}
	});

	test('3.2 — Theme persists across navigation', async () => {
		const themeToggle = page.locator('#themeToggle');

		// Read initial theme and toggle to get the opposite
		const initialTheme = await page.getAttribute('html', 'data-theme');
		await themeToggle.click();

		const newTheme = await page.getAttribute('html', 'data-theme');
		expect(newTheme).not.toBe(initialTheme);

		// Navigate to settings
		await page.locator('button[data-page="settings"]').click();
		await page.waitForFunction(
			() => document.body.getAttribute('data-current-page') === 'settings',
			{ timeout: 10_000 },
		);

		// Theme should still be the toggled value
		const themeAfterNav = await page.getAttribute('html', 'data-theme');
		expect(themeAfterNav).toBe(newTheme);

		// Navigate back to home
		await page.locator('button[data-page="home"]').click();
		await page.waitForFunction(
			() => document.body.getAttribute('data-current-page') === 'home',
			{ timeout: 10_000 },
		);

		const themeAfterReturn = await page.getAttribute('html', 'data-theme');
		expect(themeAfterReturn).toBe(newTheme);
	});

	test('3.3 — Settings page renders with expected controls', async () => {
		await page.locator('button[data-page="settings"]').click();
		await page.waitForFunction(
			() => document.body.getAttribute('data-current-page') === 'settings',
			{ timeout: 10_000 },
		);

		// Settings page should have the data source configuration section
		const configBtn = page.locator('#reconfigureDataSourceBtn');
		await expect(configBtn).toBeVisible();

		// App Data Path section
		const appDataBtn = page.locator('#chooseAppDataFolderBtn');
		await expect(appDataBtn).toBeVisible();

		// Auto-update checkbox
		const autoUpdate = page.locator('#autoUpdateDataCheckbox');
		await expect(autoUpdate).toBeAttached();
	});
});
