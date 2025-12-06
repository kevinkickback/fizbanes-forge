import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Helper to get main window (non-DevTools)
 */
async function getMainWindow(app, maxWaitMs = 5000, pollIntervalMs = 200) {
	const start = Date.now();
	let windows = [];
	while (Date.now() - start < maxWaitMs) {
		windows = await app.windows();
		if (windows.length > 0) break;
		await new Promise((res) => setTimeout(res, pollIntervalMs));
	}
	for (const win of windows) {
		const title = await win.title().catch(() => '');
		if (title && !title.includes('DevTools')) return win;
	}
	return windows[0] || null;
}

/**
 * Helper to clear preferences for testing first-run scenarios
 */
function clearPreferences() {
	const prefsPath = path.join(
		process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
		"Fizbane's Forge",
		'preferences.json',
	);

	if (fs.existsSync(prefsPath)) {
		// Backup and clear data source config only
		const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
		prefs.dataSourceType = null;
		prefs.dataSourceValue = null;
		fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
	}
}

/**
 * Helper to restore a specific preference value
 */
function setPreference(key, value) {
	const prefsPath = path.join(
		process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
		"Fizbane's Forge",
		'preferences.json',
	);

	if (fs.existsSync(prefsPath)) {
		const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
		prefs[key] = value;
		fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
	}
}

/**
 * Helper to read current preferences
 */
function getPreferences() {
	const prefsPath = path.join(
		process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
		"Fizbane's Forge",
		'preferences.json',
	);

	if (fs.existsSync(prefsPath)) {
		return JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
	}
	return {};
}

test.describe('Data Configuration - IPC Validation', () => {
	test.beforeEach(() => {
		// Clear data source configuration to simulate first run
		clearPreferences();
	});

	test('First run detection when default data is missing', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		const result = await win.evaluate(async () => {
			return window.app.checkDefaultDataFolder();
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(true);
		expect(result.hasDefaultData).toBe(false);

		await app.close();
	});

	test('Data source validation via IPC - valid URL', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Test URL validation through IPC
		const result = await win.evaluate(async () => {
			return window.app.validateDataSource({
				type: 'url',
				value: 'https://github.com/5etools-mirror-3/5etools-src',
			});
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(true);

		await app.close();
	});

	test('Data source validation via IPC - invalid URL', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Test with invalid URL
		const result = await win.evaluate(async () => {
			return window.app.validateDataSource({
				type: 'url',
				value: 'not-a-valid-url',
			});
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(false);
		expect(result).toHaveProperty('error');

		await app.close();
	});

	test('Data source validation via IPC - valid local folder', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Test with valid local folder (src/data should exist)
		const dataPath = path.resolve(process.cwd(), 'src', 'data');

		const result = await win.evaluate(async (testPath) => {
			return window.app.validateDataSource({
				type: 'local',
				value: testPath,
			});
		}, dataPath);

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(true);

		await app.close();
	});

	test('Data source validation via IPC - invalid local folder', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Test with non-existent folder
		const result = await win.evaluate(async () => {
			return window.app.validateDataSource({
				type: 'local',
				value: 'C:\\this\\path\\does\\not\\exist',
			});
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(false);
		expect(result).toHaveProperty('error');

		await app.close();
	});

	test('Get data source configuration via IPC - empty config', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Should return null values for cleared preferences
		const result = await win.evaluate(async () => {
			return window.app.getDataSource();
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(true);
		expect(result.type).toBeNull();
		expect(result.value).toBeNull();

		await app.close();
	});

	test('Get data source configuration via IPC - with saved config', async () => {
		// Set a saved configuration
		setPreference('dataSourceType', 'url');
		setPreference('dataSourceValue', 'https://example.com/data');

		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Should return saved values
		const result = await win.evaluate(async () => {
			return window.app.getDataSource();
		});

		expect(result).toHaveProperty('success');
		expect(result.success).toBe(true);
		expect(result.type).toBe('url');
		expect(result.value).toBe('https://example.com/data');

		await app.close();
	});

	test('Data source preferences persist between sessions', async () => {
		// First session: validate and configure
		let app = await electron.launch({ args: ['.'] });
		let win = await getMainWindow(app);

		const dataPath = path.resolve(process.cwd(), 'src', 'data');

		await win.evaluate(async (testPath) => {
			return window.app.validateDataSource({
				type: 'local',
				value: testPath,
			});
		}, dataPath);

		await app.close();

		// Verify preferences file was updated
		const prefs = getPreferences();
		expect(prefs.dataSourceType).toBe('local');
		expect(prefs.dataSourceValue).toBe(dataPath);

		// Second session: verify config is retained
		app = await electron.launch({ args: ['.'] });
		win = await getMainWindow(app);

		const result = await win.evaluate(async () => {
			return window.app.getDataSource();
		});

		expect(result.type).toBe('local');
		expect(result.value).toBe(dataPath);

		await app.close();
	});

	test('Clearing preferences resets data source config', async () => {
		// Set initial config
		setPreference('dataSourceType', 'url');
		setPreference('dataSourceValue', 'https://example.com/data');

		// Verify it's set
		let prefs = getPreferences();
		expect(prefs.dataSourceType).toBe('url');
		expect(prefs.dataSourceValue).toBe('https://example.com/data');

		// Clear preferences
		clearPreferences();

		// Verify it's cleared
		prefs = getPreferences();
		expect(prefs.dataSourceType).toBeNull();
		expect(prefs.dataSourceValue).toBeNull();

		// Launch app and verify via IPC
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);

		const result = await win.evaluate(async () => {
			return window.app.getDataSource();
		});

		expect(result.type).toBeNull();
		expect(result.value).toBeNull();

		await app.close();
	});
});
