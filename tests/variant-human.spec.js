import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Variant Human Loading', () => {
	test('creates new character with Variant Human, saves, and verifies persistence', async () => {
		test.setTimeout(120000);
		let electronApp;
		const consoleLogs = [];
		const testCharacterName = `test-variant-human-${Date.now()}`;
		let characterCreated = false;

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

			// Capture all console messages
			page.on('console', (msg) => {
				consoleLogs.push({
					type: msg.type(),
					text: msg.text(),
				});
				console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
			});

			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			// Wait for character list to load (may not exist if no characters)
			await page.waitForTimeout(2000);

			console.log('Creating new test character:', testCharacterName);

			// Click "New Character" button
			const newCharacterBtn = page.locator('#newCharacterBtn');
			await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
			await newCharacterBtn.click();

			// Wait for modal to appear
			await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

			// Fill in character name
			const nameInput = page.locator('#newCharacterName');
			await expect(nameInput).toBeVisible({ timeout: 10000 });
			await nameInput.fill(testCharacterName);

			// Submit form
			const createButton = page.locator('#createCharacterBtn');
			await expect(createButton).toBeVisible({ timeout: 10000 });
			await createButton.click();

			// Wait for modal to close and character to be created
			await page.waitForSelector('#newCharacterModal.show', {
				state: 'hidden',
				timeout: 15000,
			});
			characterCreated = true;

			// Wait for character card to appear
			await page.waitForTimeout(1000);
			const characterCard = page
				.locator('.character-card', { hasText: testCharacterName })
				.first();
			await expect(characterCard).toBeVisible({ timeout: 15000 });

			console.log('✓ Character created, opening character');

			// Open the newly created character
			await characterCard.click();

			// Navigate to build page
			await page.waitForSelector('button.nav-link[data-page="build"]', {
				timeout: 15000,
			});
			await page.click('button.nav-link[data-page="build"]');
			await page.waitForSelector('[data-current-page="build"]', {
				timeout: 30000,
			});

			// Wait for race card to initialize
			await page.waitForTimeout(2000);

			console.log('✓ Build page loaded, setting race to Human');

			// Select Human race
			const raceSelect = page.locator('#raceSelect');
			await expect(raceSelect).toBeVisible({ timeout: 15000 });
			await raceSelect.selectOption({ label: 'Human (PHB)' });

			// Wait for subrace dropdown to populate
			await page.waitForTimeout(1000);

			console.log('✓ Race set to Human, selecting Variant subrace');

			// Select Variant subrace
			const subraceSelect = page.locator('#subraceSelect');
			await expect(subraceSelect).toBeVisible({ timeout: 15000 });

			// Get all available options for debugging
			const options = await subraceSelect.locator('option').allTextContents();
			console.log('Available subrace options:', options);

			await subraceSelect.selectOption({ label: 'Variant' });

			// Verify selection took effect
			const selectedSubrace = await subraceSelect
				.locator('option:checked')
				.textContent();
			console.log('Selected subrace:', selectedSubrace);
			expect(selectedSubrace).toBe('Variant');

			console.log('✓ Variant Human selected, saving character');

			// Save the character
			const saveButton = page.locator('#saveCharacter');
			await expect(saveButton).toBeVisible({ timeout: 15000 });
			await saveButton.click();

			// Wait for save to complete
			await page.waitForTimeout(1500);

			console.log('✓ Character saved, closing and reopening app');

			// Close the app
			await electronApp.close();

			// Relaunch the app
			electronApp = await electron.launch({
				args: ['.'],
				env: {
					...process.env,
					FF_DEBUG: 'true',
					FF_ALLOW_DEFAULT_DATA: 'true',
				},
			});

			page = electronApp
				.windows()
				.find((win) => !win.url().startsWith('devtools://'));
			if (!page) {
				page = await electronApp.waitForEvent(
					'window',
					(win) => !win.url().startsWith('devtools://'),
				);
			}

			// Setup console logging again
			page.on('console', (msg) => {
				consoleLogs.push({
					type: msg.type(),
					text: msg.text(),
				});
				console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
			});

			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });

			// Wait for character list to load
			await page.waitForSelector('.character-card', { timeout: 30000 });

			console.log('✓ App relaunched, loading saved character');

			// Find and open the test character
			const reloadedCard = page
				.locator('.character-card', { hasText: testCharacterName })
				.first();
			await expect(reloadedCard).toBeVisible({ timeout: 15000 });
			await reloadedCard.click();

			// Navigate to build page
			await page.waitForSelector('button.nav-link[data-page="build"]', {
				timeout: 15000,
			});
			await page.click('button.nav-link[data-page="build"]');
			await page.waitForSelector('[data-current-page="build"]', {
				timeout: 30000,
			});

			// Wait for RaceCard to load saved data
			await page.waitForTimeout(2000);

			console.log('✓ Character loaded, verifying saved data');

			// Verify race is Human
			const reloadedRaceSelect = page.locator('#raceSelect');
			const reloadedRace = await reloadedRaceSelect.inputValue();
			console.log('Reloaded race:', reloadedRace);
			expect(reloadedRace).toContain('Human');

			// Verify subrace is Variant
			const reloadedSubraceSelect = page.locator('#subraceSelect');
			const reloadedSubrace = await reloadedSubraceSelect
				.locator('option:checked')
				.textContent();
			console.log('Reloaded subrace:', reloadedSubrace);
			expect(reloadedSubrace).toBe('Variant');

			console.log('✓ Variant Human persisted correctly!');

			// Check console logs for the loading message
			const loadingLogs = consoleLogs.filter(
				(log) =>
					log.text.includes('Loading saved subrace') &&
					log.text.includes('Variant'),
			);
			console.log('Loading logs found:', loadingLogs.length);

			console.log('✓ All checks passed, deleting test character');

			// Navigate back to home to delete the character
			await page.waitForSelector('button.nav-link[data-page="home"]', {
				timeout: 15000,
			});
			await page.click('button.nav-link[data-page="home"]');
			await page.waitForSelector('[data-current-page="home"]', {
				timeout: 30000,
			});
			await page.waitForTimeout(1000);

			// Find the character card again and click delete
			const deleteCard = page
				.locator('.character-card', { hasText: testCharacterName })
				.first();
			await expect(deleteCard).toBeVisible({ timeout: 15000 });

			// Click the delete button within the card
			const deleteButton = deleteCard.locator('.delete-character');
			await expect(deleteButton).toBeVisible({ timeout: 10000 });
			await deleteButton.click();

			// Confirm deletion in modal if it appears
			const confirmButton = page
				.locator('#confirmDeleteBtn, .btn-danger')
				.filter({ hasText: /delete|confirm/i })
				.first();
			await confirmButton
				.waitFor({ state: 'visible', timeout: 5000 })
				.catch(() => {});
			if (await confirmButton.isVisible()) {
				await confirmButton.click();
			}

			// Wait for character to be removed
			await page.waitForTimeout(1000);

			// Verify character is deleted
			const deletedCard = page.locator('.character-card', {
				hasText: testCharacterName,
			});
			await expect(deletedCard).toHaveCount(0, { timeout: 10000 });

			characterCreated = false; // Mark as deleted
			console.log('✓ Test character deleted successfully');
		} catch (error) {
			console.error('Test error:', error);
			throw error;
		} finally {
			// Clean up: try to delete the character if it still exists
			if (characterCreated && electronApp) {
				try {
					console.log('Attempting cleanup of test character');
					const page = electronApp
						.windows()
						.find((win) => !win.url().startsWith('devtools://'));
					if (page) {
						// Try to navigate to home and delete
						const homeBtn = page.locator('button.nav-link[data-page="home"]');
						if (await homeBtn.isVisible()) {
							await homeBtn.click();
							await page.waitForTimeout(1000);

							const deleteCard = page
								.locator('.character-card', { hasText: testCharacterName })
								.first();
							if (await deleteCard.isVisible()) {
								const deleteButton = deleteCard.locator('.delete-character');
								if (await deleteButton.isVisible()) {
									await deleteButton.click();
									await page.waitForTimeout(500);

									const confirmButton = page
										.locator('#confirmDeleteBtn, .btn-danger')
										.filter({ hasText: /delete|confirm/i })
										.first();
									if (await confirmButton.isVisible()) {
										await confirmButton.click();
									}
									console.log('✓ Cleanup successful');
								}
							}
						}
					}
				} catch (cleanupError) {
					console.error('Cleanup error (non-critical):', cleanupError);
				}
			}

			if (electronApp) {
				await electronApp.close();
			}
		}
	});
});
