import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 1. Application Lifecycle
 * Verifies the Electron app launches, the loading sequence completes,
 * and the home page renders in a clean state.
 */

/** Helper: launch app, acquire renderer page, and return both. */
async function launchApp() {
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

	return { electronApp, page };
}

test.describe('Application Lifecycle', () => {
	let electronApp;
	let page;

	test.beforeEach(async () => {
		test.setTimeout(60_000);
		({ electronApp, page } = await launchApp());
	});

	test.afterEach(async () => {
		if (electronApp) {
			await electronApp.close();
		}
	});

	test('1.1 — App launches and renderer window opens', async () => {
		// The renderer window should already exist from launchApp()
		const windows = electronApp.windows();
		const rendererWindows = windows.filter(
			(w) => !w.url().startsWith('devtools://'),
		);
		expect(rendererWindows.length).toBeGreaterThanOrEqual(1);
	});

	test('1.2 — Loading modal appears during initialization', async () => {
		// The loading modal element should be present in the DOM
		await page.waitForLoadState('domcontentloaded');
		const loadingModal = page.locator('#loadingModal');
		await expect(loadingModal).toBeAttached();
	});

	test('1.3 — Loading modal dismisses after services load', async () => {
		// Wait for full app readiness (pageContent visible means init is done)
		await page.waitForSelector('#pageContent', { timeout: 60_000 });

		// After init, the loading modal should not be visible
		const loadingModal = page.locator('#loadingModal');
		await expect(loadingModal).not.toBeVisible({ timeout: 10_000 });
	});

	test('1.4 — Home page renders by default after startup', async () => {
		await page.waitForSelector('#pageContent', { timeout: 60_000 });

		// body should have data-current-page="home"
		const currentPage = await page.getAttribute('body', 'data-current-page');
		expect(currentPage).toBe('home');

		// Either the "New Character" button (characters exist) or
		// "Create Character" button (empty state) should be visible
		const newCharBtn = page.locator('#newCharacterBtn');
		const emptyStateBtn = page.locator('#welcomeCreateCharacterBtn');
		const eitherVisible =
			(await newCharBtn.isVisible().catch(() => false)) ||
			(await emptyStateBtn.isVisible().catch(() => false));
		expect(eitherVisible).toBe(true);
	});

	test('1.5 — Titlebar displays "Fizbane\'s Forge" branding', async () => {
		await page.waitForSelector('#pageContent', { timeout: 60_000 });

		const brandText = await page.locator('.titlebar-logo span').textContent();
		expect(brandText).toContain("Fizbane's Forge");
	});

	test('1.6 — Titlebar shows "No Character Loaded" initially', async () => {
		await page.waitForSelector('#pageContent', { timeout: 60_000 });

		const charName = await page.locator('#titlebarCharacterName').textContent();
		expect(charName.trim()).toBe('No Character Loaded');
	});

	test('1.7 — No console errors during clean startup', async () => {
		const errors = [];
		page.on('pageerror', (err) => errors.push(err));
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.waitForSelector('#pageContent', { timeout: 60_000 });

		// Filter out known non-critical noise (e.g. DevTools, favicon)
		const real = errors.filter((e) => {
			const text = typeof e === 'string' ? e : e.message || '';
			return (
				!text.includes('favicon') &&
				!text.includes('DevTools') &&
				!text.includes('net::ERR_FILE_NOT_FOUND')
			);
		});

		expect(real).toEqual([]);
	});
});
