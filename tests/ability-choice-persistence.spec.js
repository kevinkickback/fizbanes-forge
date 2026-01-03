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

	// Submit form
	const createButton = page.locator('#createCharacterBtn');
	await expect(createButton).toBeVisible({ timeout: 10000 });
	await createButton.click();

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
				if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
					await confirmButton.click();
				}

				await page.waitForTimeout(1000);
			}
		}
	} catch (error) {
		console.error(`Failed to delete character "${characterName}":`, error.message);
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

async function selectRaceAndChoices(page) {
	const raceSelect = page.locator('#raceSelect');
	await expect(raceSelect).toBeVisible({ timeout: 15000 });
	await raceSelect.selectOption('Half-Elf_PHB');

	// Wait for ability choices to appear
	const abilitySelects = page.locator('.ability-choice-select');
	await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });

	await abilitySelects.nth(0).selectOption('strength');
	await abilitySelects.nth(1).selectOption('dexterity');

	// Capture the displayed bonuses after selection
	const bonusSnapshot = {
		strength: await getBonusText(page, 'strength'),
		dexterity: await getBonusText(page, 'dexterity'),
		charisma: await getBonusText(page, 'charisma'),
	};

	await saveCharacter(page);

	return bonusSnapshot;
}

async function expectBonus(page, ability, expectedText) {
	const bonusLocator = page.locator(`[data-ability="${ability}"] .bonus`);
	await bonusLocator.waitFor({ state: 'visible', timeout: 15000 });
	await expect(bonusLocator).toHaveText(expectedText);
}

async function getBonusText(page, ability) {
	const bonusLocator = page.locator(`[data-ability="${ability}"] .bonus`);
	await bonusLocator.waitFor({ state: 'visible', timeout: 15000 });
	return (await bonusLocator.textContent())?.trim() || '';
}

async function saveCharacter(page) {
	const saveButton = page.locator('#saveCharacter');
	await expect(saveButton).toBeVisible({ timeout: 15000 });
	await saveButton.click();

	// Wait for unsaved indicator to disappear if present
	const unsaved = page.locator('#unsavedChangesIndicator');
	await unsaved.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });

	// Small buffer to allow disk write
	await page.waitForTimeout(500);
}

async function verifyRestoredState(page, expectedBonuses) {
	const raceSelect = page.locator('#raceSelect');
	await expect(raceSelect).toHaveValue('Half-Elf_PHB', { timeout: 15000 });

	const abilitySelects = page.locator('.ability-choice-select');
	await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });
	await expect(abilitySelects.nth(0)).toHaveValue('strength');
	await expect(abilitySelects.nth(1)).toHaveValue('dexterity');

	// Validate that the displayed bonuses match what we saw before closing
	await expectBonus(page, 'strength', expectedBonuses.strength);
	await expectBonus(page, 'dexterity', expectedBonuses.dexterity);
	await expectBonus(page, 'charisma', expectedBonuses.charisma);
}

// End-to-end regression: racial ability choices should persist after reload
// and be re-applied when the character is reopened.
test.describe('Racial Ability Choice Persistence', () => {
	test('persists selections across app restart', async () => {
		test.setTimeout(180000);
		let electronAppOne;
		let electronAppTwo;
		let initialBonuses;
		const testCharacterName = `test-ability-choice-${Date.now()}`;

		try {
			// First run: create character, set race + ability choices and let auto-save persist them
			const firstLaunch = await launchApp();
			electronAppOne = firstLaunch.app;
			const { page: firstPage } = firstLaunch;

			await createCharacter(firstPage, testCharacterName);
			await openCharacter(firstPage, testCharacterName);
			initialBonuses = await selectRaceAndChoices(firstPage);

			// Give the app a moment to persist changes
			await firstPage.waitForTimeout(1500);
		} finally {
			if (electronAppOne) {
				await electronAppOne.close();
			}
		}

		try {
			// Second run: reopen and verify choices were restored
			const secondLaunch = await launchApp();
			electronAppTwo = secondLaunch.app;
			const { page: secondPage } = secondLaunch;

			await openCharacter(secondPage, testCharacterName);
			await verifyRestoredState(secondPage, initialBonuses);

			// Clean up: delete the test character
			await deleteCharacter(secondPage, testCharacterName);
		} finally {
			if (electronAppTwo) {
				await electronAppTwo.close();
			}
		}
	});
});
