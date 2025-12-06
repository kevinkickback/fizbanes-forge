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
		const title = await win.title().catch(() => '');
		if (title && !title.includes('DevTools')) return win;
	}
	return windows[0] || null;
}

test.describe('Character validation via IPC', () => {
	test('save rejects invalid character payloads', async () => {
		const app = await electron.launch({ args: ['.'] });
		const win = await getMainWindow(app);
		expect(win).toBeTruthy();

		// Construct an invalid character (missing id and name)
		const invalid = {
			level: 0,
			abilityScores: {
				strength: 10,
				dexterity: 10,
				constitution: 10,
				intelligence: 10,
				wisdom: 10,
				charisma: 10,
			},
			proficiencies: {},
			hitPoints: { current: 0, max: 0, temp: 0 },
			allowedSources: [],
		};

		const result = await win.evaluate(async (payload) => {
			return window.characterStorage.saveCharacter(payload);
		}, invalid);

		expect(result).toHaveProperty('success', false);
		expect(String(result.error || '')).toContain('Invalid character');
	});
});
