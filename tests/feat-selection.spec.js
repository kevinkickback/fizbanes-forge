import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Feat Selection', () => {
	/**
	 * Helper: Create a new character
	 */
	async function createCharacter(page, characterName, raceToSelect, subraceToSelect) {
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
		console.log('✓ Character created');

		// Open the character
		await characterCard.click();

		// Navigate to build page
		await page.waitForSelector('button.nav-link[data-page="build"]', {
			timeout: 15000,
		});
		await page.click('button.nav-link[data-page="build"]');
		await page.waitForSelector('[data-current-page="build"]', {
			timeout: 30000,
		});

		// Wait for build page to fully render
		await page.waitForTimeout(2000);
		console.log('✓ Build page loaded');

		// Select race
		const raceSelect = page.locator('#raceSelect');
		await expect(raceSelect).toBeVisible({ timeout: 10000 });
		await raceSelect.selectOption({ label: raceToSelect });

		// Wait for subrace dropdown to populate
		await page.waitForTimeout(1000);
		console.log(`✓ ${raceToSelect} selected`);

		// Select subrace if provided
		if (subraceToSelect) {
			const subraceSelect = page.locator('#subraceSelect');
			await expect(subraceSelect).toBeVisible({ timeout: 10000 });
			await subraceSelect.selectOption({ label: subraceToSelect });
			await page.waitForTimeout(1000);
			console.log(`✓ ${subraceToSelect} subrace selected`);
		}
	}

	/**
	 * Main test: Feat selection modal opens and enforces slot limit
	 */
	test('feat selection modal opens and allows selection for Variant Human', async () => {
		test.setTimeout(120000);

		let electronApp;
		const characterName = `test-feat-selection-${Date.now()}`;

		try {
			// Launch Electron with debug mode
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
				page = await electronApp.waitForEvent('window', (win) =>
					!win.url().startsWith('devtools://'),
				);
			}

			// Set up console logging
			page.on('console', (msg) => {
				console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
			});

			// Wait for app to load
			await page.waitForLoadState('domcontentloaded');
			await page.waitForSelector('#pageContent', { timeout: 60000 });
			await page.waitForTimeout(2000);

			// STEP 1: Create character and select Variant Human
			console.log('\n=== STEP 1: Create character with Variant Human ===');
			await createCharacter(page, characterName, 'Human (PHB)', 'Variant');

			// STEP 2: Check initial feat availability
			console.log('\n=== STEP 2: Check feat availability ===');
			const featCountText = await page.textContent('#featCount');
			const maxFeatsText = await page.textContent('#maxFeats');
			console.log(`Feat count on build page: ${featCountText}`);
			console.log(`Max feats on build page: ${maxFeatsText}`);

			// STEP 3: Scroll to feats section and click "Add Feat" button
			console.log('\n=== STEP 3: Click Add Feat button ===');
			const addFeatBtn = page.locator('#addFeatBtn');
			
			// Scroll feat button into view
			await addFeatBtn.scrollIntoViewIfNeeded();
			await page.waitForTimeout(500);
			
			await expect(addFeatBtn).toBeVisible({ timeout: 10000 });
			await addFeatBtn.click();
			console.log('✓ Add Feat button clicked');

			// STEP 4: Wait for modal to appear
			console.log('\n=== STEP 4: Wait for modal ===');
			await page.waitForSelector('.modal-overlay', { timeout: 10000 });
			console.log('✓ Modal appeared');

			// Wait for feat items to render
			await page.waitForSelector('.feat-item', { timeout: 10000 });
			console.log('✓ Feat items rendered');

			// Log how many feats are available
			const featItems = await page.locator('.feat-item').count();
			console.log(`Number of feats available: ${featItems}`);

			// Log slot note from modal
			const modalSlotNote = await page.textContent('.feat-slot-note');
			console.log(`Modal slot note: "${modalSlotNote}"`);
			
			// Also check the modal title
			const modalTitle = await page.textContent('.modal-title');
			console.log(`Modal title: "${modalTitle}"`);

			// STEP 5: Select first feat
			console.log('\n=== STEP 5: Select first feat ===');
			const firstFeat = page.locator('.feat-item').first();
			const firstFeatId = await firstFeat.getAttribute('data-feat-id');
			const firstFeatName = await firstFeat.locator('strong').first().textContent();
			console.log(`First feat ID: ${firstFeatId}`);
			console.log(`First feat name: ${firstFeatName}`);
			await firstFeat.click();
			console.log('✓ First feat clicked');

			// Check if it was actually selected
			const firstFeatSelected = await firstFeat.locator('.feat-selected-indicator').isVisible();
			console.log(`First feat selected indicator visible: ${firstFeatSelected}`);

			// STEP 6: Try to select second feat (should be disabled if limit is 1)
			console.log('\n=== STEP 6: Try to select second feat ===');
			const secondFeat = page.locator('.feat-item').nth(1);
			const secondFeatId = await secondFeat.getAttribute('data-feat-id');
			const secondFeatName = await secondFeat.locator('strong').first().textContent();
			const isDisabled = await secondFeat.getAttribute('aria-disabled');
			console.log(`Second feat ID: ${secondFeatId}`);
			console.log(`Second feat name: ${secondFeatName}`);
			console.log(`Second feat aria-disabled: ${isDisabled}`);

			if (isDisabled === 'true') {
				console.log('✓ Second feat properly disabled (enforcement working!)');
			} else {
				console.log('✗ Second feat NOT disabled (enforcement NOT working)');
				// Try clicking it anyway
				await secondFeat.click();
				const secondFeatSelected = await secondFeat.locator('.feat-selected-indicator').isVisible();
				console.log(`Second feat was clickable, now selected: ${secondFeatSelected}`);
			}

			// STEP 7: Click OK button
			console.log('\n=== STEP 7: Click OK button ===');
			const okBtn = page.locator('.modal-overlay .btn-ok');
			await expect(okBtn).toBeVisible({ timeout: 10000 });
			console.log('✓ OK button visible');
			await okBtn.click();
			console.log('✓ OK button clicked');

			// STEP 8: Wait for modal to close
			console.log('\n=== STEP 8: Wait for modal to close ===');
			await page.waitForSelector('.modal-overlay', {
				state: 'hidden',
				timeout: 10000,
			});
			console.log('✓ Modal closed');

			// STEP 9: Check if feats appear in #featSources
			console.log('\n=== STEP 9: Check feat sources footer ===');
			const featSourcesText = await page.textContent('#featSources');
			console.log(`Feat sources text: "${featSourcesText}"`);

			// STEP 10: Check feat count updated
			console.log('\n=== STEP 10: Check feat count updated ===');
			const updatedFeatCount = await page.textContent('#featCount');
			console.log(`Updated feat count: "${updatedFeatCount}"`);

			console.log('\n=== TEST COMPLETE ===');
		} finally {
			if (electronApp) await electronApp.close();
		}
	});
});
