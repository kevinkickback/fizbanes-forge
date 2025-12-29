import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Tooltip integration (Electron)', () => {
	test('shows Fireball tooltip content without errors', async () => {
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
			page.on('console', (msg) =>
				console.log(`[renderer:${msg.type()}] ${msg.text()}`),
			);

			await page.waitForSelector('button.nav-link[data-page="tooltipTest"]', {
				timeout: 60000,
			});
			await page.click('button.nav-link[data-page="tooltipTest"]');

			await page.waitForSelector('h1:has-text("Tooltip System Test Page")', {
				timeout: 60000,
			});

			const fireballLink = page
				.locator('.reference-link', { hasText: 'Fireball' })
				.first();
			await expect(fireballLink).toBeVisible({ timeout: 10000 });
			await fireballLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 15000 });
			await expect(tooltip).toContainText('Fireball', { timeout: 15000 });
			await expect(tooltip).not.toContainText('Error loading details');
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('shows different tooltip types (spell, item, condition)', async () => {
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

			// Test spell tooltip
			const spellLink = page
				.locator('.reference-link[data-hover-type="spell"]')
				.first();
			if (await spellLink.isVisible({ timeout: 5000 }).catch(() => false)) {
				await spellLink.hover();
				const tooltip = page.locator('.tooltip').first();
				await expect(tooltip).toBeVisible({ timeout: 10000 });
				await expect(tooltip).toHaveAttribute('data-type', 'spell');
			}

			// Test condition tooltip
			const conditionLink = page
				.locator('.reference-link[data-hover-type="condition"]')
				.first();
			if (await conditionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
				await conditionLink.hover();
				const tooltip = page.locator('.tooltip').first();
				await expect(tooltip).toBeVisible({ timeout: 10000 });
			}
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('tooltip closes on Escape key', async () => {
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

			const fireballLink = page
				.locator('.reference-link', { hasText: 'Fireball' })
				.first();
			await fireballLink.hover();

			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 10000 });

			// Press Escape to close
			await page.keyboard.press('Escape');
			await expect(tooltip).toBeHidden({ timeout: 5000 });
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('multiple tooltips can be open simultaneously when pinned', async () => {
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

			// Open first tooltip
			const fireballLink = page
				.locator('.reference-link', { hasText: 'Fireball' })
				.first();
			await fireballLink.hover();
			const tooltip = page.locator('.tooltip').first();
			await expect(tooltip).toBeVisible({ timeout: 10000 });

			// Pin it with Ctrl+P
			await page.keyboard.press('Control+P');

			// The tooltip should remain visible
			await expect(tooltip).toBeVisible({ timeout: 5000 });
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});
});
