import { _electron as electron } from '@playwright/test';
import { test } from './fixtures.js';

// Use this as a template for new tests with Playwright Inspector
// Run with: "npx playwright test !boilerplate.spec.js --debug"
// Console output is automatically captured and displayed in terminal

test('Test Description Here', async () => {
	test.setTimeout(60000);

	const electronApp = await electron.launch({
		args: ['.'],
		env: {
			...process.env,
			FF_DEBUG: 'true',
			FF_ALLOW_DEFAULT_DATA: 'true',
		},
	});

	// Get main renderer window (exclude DevTools)
	let page = electronApp
		.windows()
		.find((win) => !win.url().startsWith('devtools://'));
	if (!page) {
		page = await electronApp.waitForEvent(
			'window',
			(win) => !win.url().startsWith('devtools://'),
		);
	}

	// Set up console capturing
	page.on('console', (msg) => {
		const type = msg.type().toUpperCase();
		console.log(`[CONSOLE ${type}] ${msg.text()}`);
	});

	// Wait for app to load
	await page.waitForLoadState('domcontentloaded');
	await page.waitForSelector('#pageContent', { timeout: 60000 });

	// Add your test interactions here using the Playwright Inspector

	await electronApp.close();
});
