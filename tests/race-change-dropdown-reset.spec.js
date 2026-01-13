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

async function createCharacter(page, characterName) {
	// Click "New Character" button
	const newCharacterBtn = page.locator('#newCharacterBtn');
	await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
	await newCharacterBtn.click();

	// Wait for modal to appear
	await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

	// Fill in character name
	const nameInput = page.locator('#newCharacterName');
	await expect(nameInput).toBeVisible({ timeout: 10000 });
	await nameInput.fill(characterName);

	// Navigate through wizard steps (0->1->2->3->Create)
	const nextBtn = page.locator('#wizardNextBtn');
	await expect(nextBtn).toBeVisible({ timeout: 10000 });
	await nextBtn.click(); // Step 0 -> 1
	await nextBtn.click(); // Step 1 -> 2
	await nextBtn.click(); // Step 2 -> 3
	await nextBtn.click(); // Step 3 -> Create character

	// Wait for modal to close
	await page.waitForSelector('#newCharacterModal.show', {
		state: 'hidden',
		timeout: 15000,
	});

	// Wait for character card to appear
	await page.waitForTimeout(1000);
	const characterCard = page
		.locator('.character-card', { hasText: characterName })
		.first();
	await expect(characterCard).toBeVisible({ timeout: 15000 });
}

async function deleteCharacter(page, characterName) {
	try {
		// Navigate to home page
		await page.waitForSelector('button.nav-link[data-page="home"]', {
			timeout: 15000,
		});
		await page.click('button.nav-link[data-page="home"]');
		await page.waitForSelector('[data-current-page="home"]', {
			timeout: 30000,
		});
		await page.waitForTimeout(1000);

		// Find and click delete button on character card
		const deleteCard = page
			.locator('.character-card', { hasText: characterName })
			.first();
		if (await deleteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
			const deleteButton = deleteCard.locator('.delete-character');
			if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
				await deleteButton.click();

				// Confirm deletion
				const confirmButton = page
					.locator('#confirmDeleteBtn, .btn-danger')
					.filter({ hasText: /delete|confirm/i })
					.first();
				await confirmButton
					.waitFor({ state: 'visible', timeout: 5000 })
					.catch(() => { });
				if (
					await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)
				) {
					await confirmButton.click();
				}

				await page.waitForTimeout(1000);
			}
		}
	} catch (error) {
		console.error(
			`Failed to delete character "${characterName}":`,
			error.message,
		);
	}
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
		const testCharacterName = `test-race-reset-${Date.now()}`;

		try {
			const { app, page } = await launchApp();
			electronApp = app;

			await createCharacter(page, testCharacterName);
			await openCharacter(page, testCharacterName);

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

			// Clean up: delete the test character
			await deleteCharacter(page, testCharacterName);
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});

	test('resets ability choice dropdowns when changing subrace', async () => {
		test.setTimeout(180000);
		let electronApp;
		const testCharacterName = `test-subrace-reset-${Date.now()}`;

		try {
			const { app, page } = await launchApp();
			electronApp = app;

			await createCharacter(page, testCharacterName);
			await openCharacter(page, testCharacterName);

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

			// Clean up: delete the test character
			await deleteCharacter(page, testCharacterName);
		} finally {
			if (electronApp) {
				await electronApp.close();
			}
		}
	});
});
