import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 15000,
	expect: {
		timeout: 5000,
	},
	reporter: 'list',
	use: {
		headless: true,
		actionTimeout: 0,
		trace: 'on-first-retry',
	},
	webServer: undefined,
	// Capture console and page messages for debugging
	globalSetup: undefined,
});
