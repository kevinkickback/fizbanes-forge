import { _electron as electron, expect, test } from '@playwright/test';

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
	await page.waitForSelector('.character-card', { timeout: 60000 });

	return { app, page };
}

async function openCharacter(page, characterName) {
	const locator = page
		.locator('.character-card', { hasText: characterName })
		.first();
	await expect(locator).toBeVisible({ timeout: 15000 });
	await locator.click();

	// Navigate to build page
	await page.waitForSelector('button.nav-link[data-page="build"]', {
		timeout: 15000,
	});
	await page.click('button.nav-link[data-page="build"]');
	await page.waitForSelector('[data-current-page="build"]', { timeout: 45000 });
}

test.describe('Race Change Dropdown Reset', () => {
	test('resets ability choice dropdowns when changing race', async () => {
		test.setTimeout(180000);
		let electronApp;

		try {
			const { app, page } = await launchApp();
			electronApp = app;

			const characterName = 'PLZ WRK';
			await openCharacter(page, characterName);

			// Select Half-Elf and make ability choices
			const raceSelect = page.locator('#raceSelect');
			await expect(raceSelect).toBeVisible({ timeout: 15000 });
			await raceSelect.selectOption('Half-Elf_PHB');

			// Wait for ability choices to appear
			const abilitySelects = page.locator('.ability-choice-select');
			await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });

			// Make selections
			await abilitySelects.nth(0).selectOption('strength');
			await abilitySelects.nth(1).selectOption('dexterity');

			// Verify selections are set
			await expect(abilitySelects.nth(0)).toHaveValue('strength');
			await expect(abilitySelects.nth(1)).toHaveValue('dexterity');

			// Change to a different race (Elf)
			await raceSelect.selectOption('Elf_PHB');

			// Wait a moment for the UI to update
			await page.waitForTimeout(500);

			// Verify dropdowns are reset (should not exist for Elf)
			const abilitySelectsAfterChange = await page
				.locator('.ability-choice-select')
				.count();
			expect(abilitySelectsAfterChange).toBe(0);

			// Change back to Half-Elf
			await raceSelect.selectOption('Half-Elf_PHB');

			// Wait for ability choices to appear again
			await expect(page.locator('.ability-choice-select')).toHaveCount(2, {
				timeout: 15000,
			});

			// Verify dropdowns are reset to "Choose..." (empty value)
			const newAbilitySelects = page.locator('.ability-choice-select');
			await expect(newAbilitySelects.nth(0)).toHaveValue('');
			await expect(newAbilitySelects.nth(1)).toHaveValue('');

			console.log(
				'✓ Ability choice dropdowns properly reset when changing race',
			);
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('resets ability choice dropdowns when changing subrace', async () => {
		test.setTimeout(180000);
		let electronApp;

		try {
			const { app, page } = await launchApp();
			electronApp = app;

			const characterName = 'PLZ WRK';
			await openCharacter(page, characterName);

			// Select Human race (which has subrace options)
			const raceSelect = page.locator('#raceSelect');
			await expect(raceSelect).toBeVisible({ timeout: 15000 });
			await raceSelect.selectOption('Human_PHB');

			// Wait for subrace dropdown to be enabled
			const subraceSelect = page.locator('#subraceSelect');
			await expect(subraceSelect).toBeEnabled({ timeout: 15000 });

			// Select Variant Human (which has ability choices)
			await subraceSelect.selectOption('Variant');

			// Wait for ability choices to appear
			const abilitySelects = page.locator('.ability-choice-select');
			await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });

			// Make selections
			await abilitySelects.nth(0).selectOption('intelligence');
			await abilitySelects.nth(1).selectOption('wisdom');

			// Verify selections are set
			await expect(abilitySelects.nth(0)).toHaveValue('intelligence');
			await expect(abilitySelects.nth(1)).toHaveValue('wisdom');

			// Change to base Human (no ability choices)
			await subraceSelect.selectOption('');

			// Wait a moment for the UI to update
			await page.waitForTimeout(500);

			// Verify dropdowns are removed (base Human has no choices)
			const abilitySelectsAfterChange = await page
				.locator('.ability-choice-select')
				.count();
			expect(abilitySelectsAfterChange).toBe(0);

			// Change back to Variant Human
			await subraceSelect.selectOption('Variant');

			// Wait for ability choices to appear again
			await expect(page.locator('.ability-choice-select')).toHaveCount(2, {
				timeout: 15000,
			});

			// Verify dropdowns are reset to "Choose..." (empty value)
			const newAbilitySelects = page.locator('.ability-choice-select');
			await expect(newAbilitySelects.nth(0)).toHaveValue('');
			await expect(newAbilitySelects.nth(1)).toHaveValue('');

			console.log(
				'✓ Ability choice dropdowns properly reset when changing subrace',
			);
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});
});
