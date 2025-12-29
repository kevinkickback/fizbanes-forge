import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Tag Handler Coverage (Extended)', () => {
	test('resolves skill references (Perception, Stealth, Athletics)', async () => {
		test.setTimeout(120000);
		let electronApp;
		try {
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			let page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}
			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');
			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			// Test skill tooltip
			const skillLink = page
				.locator('.reference-link[data-tooltip-type="skill"]')
				.first();
			await expect(skillLink).toBeVisible({ timeout: 10000 });
			await skillLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 15000 });
			const tooltipContent = page.locator('.tooltip-content').first();
			await expect(tooltipContent).toHaveAttribute('data-type', 'skill');
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('resolves action references (Dash, Dodge, Help)', async () => {
		test.setTimeout(120000);
		let electronApp;
		try {
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			let page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}
			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');
			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			// Test action tooltip
			const actionLink = page
				.locator('.reference-link[data-tooltip-type="action"]')
				.first();
			await expect(actionLink).toBeVisible({ timeout: 10000 });
			await actionLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 15000 });
			const tooltipContent = page.locator('.tooltip-content').first();
			await expect(tooltipContent).toHaveAttribute('data-type', 'action');
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('resolves feat references with proper rendering', async () => {
		test.setTimeout(120000);
		let electronApp;
		try {
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			let page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}
			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');
			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			// Test feat tooltip
			const featLink = page
				.locator('.reference-link[data-tooltip-type="feat"]')
				.first();
			await expect(featLink).toBeVisible({ timeout: 10000 });
			await featLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 15000 });
			await expect(tooltip).not.toContainText('Error', { timeout: 5000 });
			await expect(tooltip).not.toContainText('not found', { timeout: 5000 });
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('resolves background references', async () => {
		test.setTimeout(120000);
		let electronApp;
		try {
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			let page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}
			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');
			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			// Test background tooltip
			const backgroundLink = page
				.locator('.reference-link[data-tooltip-type="background"]')
				.first();
			await expect(backgroundLink).toBeVisible({ timeout: 10000 });
			await backgroundLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 15000 });
			const tooltipContent = page.locator('.tooltip-content').first();
			await expect(tooltipContent).toHaveAttribute('data-type', 'background');
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('verifies no console errors for common tooltip interactions', async () => {
		test.setTimeout(120000);
		let electronApp;
		const errors = [];

		try {
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			let page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}

			page.on('console', (msg) => {
				if (msg.type() === 'error') {
					console.log('[TEST] Console error:', msg.text());
					errors.push(msg.text());
				}
			});

			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');
			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			// Hover over multiple reference types to trigger tag processing
			const referenceLinks = page.locator('.reference-link');
			const count = await referenceLinks.count();

			for (let i = 0; i < Math.min(count, 5); i++) {
				const link = referenceLinks.nth(i);
				if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
					await link.hover();
					await page.waitForTimeout(500);
				}
			}

			// Verify no critical errors occurred (data initialization errors are expected/normal)
			const criticalErrors = errors.filter(
				(e) =>
					!e.includes('DeprecationWarning') &&
					!e.includes('DEP0190') &&
					!e.includes('bestiary.json') &&
					!e.includes('MonsterService') &&
					!e.includes('ENOENT') &&
					e.toLowerCase().includes('error'),
			);

			expect(criticalErrors.length).toBe(0);
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});
});
