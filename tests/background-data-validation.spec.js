import { test } from '@playwright/test';

/**
 * Test: Background Data Validation
 * Verifies that backgrounds load correctly with all fields populated
 * including languages and equipment that may not be rendering
 */

async function launchApp() {
	const app = await electron.launch({
		args: ['.'],
		env: {
			...process.env,
			FF_DEBUG: 'true',
			FF_ALLOW_DEFAULT_DATA: 'true',
		},
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

test.describe('Background Data Validation', () => {
	let app;
	let page;

	test.beforeAll(async () => {
		const context = await launchApp();
		app = context.app;
		page = context.page;
	});

	test.afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	test('Load Acolyte background JSON directly', async () => {
		// Try to load the background JSON directly
		const backgroundJson = await page.evaluate(async () => {
			try {
				// Try to load via the data API
				const result = await window.data.loadJSON('backgrounds.json');
				if (result.success && result.data) {
					const acolyte = result.data.background?.find(
						(b) => b.name === 'Acolyte',
					);
					if (acolyte) {
						return {
							success: true,
							hasEquipment: !!acolyte.equipment,
							hasLanguageProficiencies: !!acolyte.languageProficiencies,
							hasSkillProficiencies: !!acolyte.skillProficiencies,
							hasToolProficiencies: !!acolyte.toolProficiencies,
							equipmentCount: acolyte.equipment?.length || 0,
							languageCount: acolyte.languageProficiencies?.length || 0,
							skillCount: acolyte.skillProficiencies?.length || 0,
							toolCount: acolyte.toolProficiencies?.length || 0,
							keys: Object.keys(acolyte),
						};
					}
					return { error: 'Acolyte not found in backgrounds' };
				}
				return { error: result.error || 'Unknown error loading JSON' };
			} catch (e) {
				return { error: e.message };
			}
		});

		console.log('\n=== Acolyte Background JSON (Raw) ===');
		console.log('Result:', JSON.stringify(backgroundJson, null, 2));

		// Check if data loaded
		if (backgroundJson.error) {
			console.log('ERROR:', backgroundJson.error);
		} else {
			console.log('Has Equipment:', backgroundJson.hasEquipment);
			console.log(
				'Has Language Proficiencies:',
				backgroundJson.hasLanguageProficiencies,
			);
			console.log(
				'Has Skill Proficiencies:',
				backgroundJson.hasSkillProficiencies,
			);
			console.log(
				'Has Tool Proficiencies:',
				backgroundJson.hasToolProficiencies,
			);
			console.log('Equipment Count:', backgroundJson.equipmentCount);
			console.log('Languages Count:', backgroundJson.languageCount);
			console.log('All Keys in Acolyte:', backgroundJson.keys);
		}
	});

	test('Check Charlatan and Criminal backgrounds', async () => {
		const backgroundJson = await page.evaluate(async () => {
			try {
				const result = await window.data.loadJSON('backgrounds.json');
				if (result.success && result.data) {
					const charlatan = result.data.background?.find(
						(b) => b.name === 'Charlatan',
					);
					const criminal = result.data.background?.find(
						(b) => b.name === 'Criminal',
					);

					return {
						charlatan: charlatan
							? {
									hasEquipment: !!charlatan.equipment,
									hasLanguages: !!charlatan.languageProficiencies,
									equipmentCount: charlatan.equipment?.length || 0,
								}
							: null,
						criminal: criminal
							? {
									hasEquipment: !!criminal.equipment,
									hasLanguages: !!criminal.languageProficiencies,
									equipmentCount: criminal.equipment?.length || 0,
								}
							: null,
					};
				}
				return { error: result.error || 'Unknown error' };
			} catch (e) {
				return { error: e.message };
			}
		});

		console.log('\n=== Charlatan & Criminal ===');
		console.log(JSON.stringify(backgroundJson, null, 2));
	});
});
