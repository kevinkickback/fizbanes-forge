import { _electron as electron, test } from '@playwright/test';

async function launchApp() {
	const app = await electron.launch({
		args: ['.'],
		env: { ...process.env, FF_DEBUG: 'true', FF_ALLOW_DEFAULT_DATA: 'true' },
	});

	let page = app.windows().find((win) => !win.url().startsWith('devtools://'));
	if (!page) {
		page = await app.waitForEvent(
			'window',
			(win) => !win.url().startsWith('devtools://'),
		);
	}

	await page.waitForLoadState('domcontentloaded');
	await page.waitForSelector('#pageContent', { timeout: 60000 });

	return { app, page };
}

test('Inspect actual background field structure', async () => {
	const { app, page } = await launchApp();

	const bgData = await page.evaluate(async () => {
		const result = await window.data.loadJSON('backgrounds.json');
		if (result.success && result.data) {
			const acolyte = result.data.background?.find((b) => b.name === 'Acolyte');
			if (acolyte) {
				return {
					startingEquipment: acolyte.startingEquipment,
					languageProficiencies: acolyte.languageProficiencies,
					skillProficiencies: acolyte.skillProficiencies,
					toolProficiencies: acolyte.toolProficiencies,
				};
			}
		}
		return null;
	});

	console.log('\n=== ACOLYTE ACTUAL FIELDS ===');
	console.log(
		'startingEquipment:',
		JSON.stringify(bgData.startingEquipment, null, 2),
	);
	console.log(
		'languageProficiencies:',
		JSON.stringify(bgData.languageProficiencies, null, 2),
	);
	console.log(
		'skillProficiencies:',
		JSON.stringify(bgData.skillProficiencies, null, 2),
	);
	console.log(
		'toolProficiencies:',
		JSON.stringify(bgData.toolProficiencies, null, 2),
	);

	await app.close();
});
