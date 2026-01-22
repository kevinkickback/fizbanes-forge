import { _electron as electron } from '@playwright/test';
import { test } from './fixtures.js';

test('Debug Standard Array Initialization', async () => {
	test.setTimeout(60000);

	const electronApp = await electron.launch({
		args: ['.'],
		env: {
			...process.env,
			FF_DEBUG: 'true',
			FF_ALLOW_DEFAULT_DATA: 'true',
		},
	});

	// Get main renderer window (exclude DevTools)
	let page = electronApp
		.windows()
		.find((win) => !win.url().startsWith('devtools://'));
	if (!page) {
		page = await electronApp.waitForEvent(
			'window',
			(win) => !win.url().startsWith('devtools://'),
		);
	}

	// Set up console capturing
	page.on('console', (msg) => {
		const type = msg.type().toUpperCase();
		console.log(`[CONSOLE ${type}] ${msg.text()}`);
	});

	// Wait for app to load
	await page.waitForLoadState('domcontentloaded');
	await page.waitForSelector('#pageContent', { timeout: 60000 });

	// Navigate through character creation to ability scores page
	await page.getByRole('button', { name: '+ Create Character' }).click();
	await page.getByRole('textbox', { name: 'Enter character name' }).click();
	await page
		.getByRole('textbox', { name: 'Enter character name' })
		.fill('TestChar');
	await page.getByRole('button', { name: 'Next' }).click();

	// Select Standard Array
	await page.getByText('Standard Array').click();
	await page.getByRole('button', { name: 'Next' }).click();

	// Select race
	await page.getByLabel('Race', { exact: true }).selectOption('Human|||PHB');
	await page.getByLabel('Subrace').selectOption('Variant');
	await page.getByRole('button', { name: 'Next' }).click();

	// Select class
	await page.getByLabel('Class', { exact: true }).selectOption('Barbarian_PHB');
	await page.getByRole('button', { name: 'Next' }).click();

	// Skip background
	await page.getByRole('button', { name: 'Next' }).click();

	// Now we should be on ability scores page
	await page.waitForSelector('.step-5-ability-scores', { timeout: 5000 });

	console.log('\n=== ABILITY SCORES PAGE LOADED ===\n');

	// Check the ability score boxes and their values
	const abilities = [
		'strength',
		'dexterity',
		'constitution',
		'intelligence',
		'wisdom',
		'charisma',
	];

	for (const ability of abilities) {
		// Get the ability score box
		const box = page.locator(`.ability-score-box[data-ability="${ability}"]`);

		// Get the displayed score
		const scoreText = await box.locator('.score').textContent();

		// Get the dropdown select element
		const dropdown = page.locator(`#controls-${ability} select`);
		const dropdownValue = await dropdown.inputValue();

		// Get all available options
		const options = await dropdown.locator('option').allTextContents();

		console.log(`\n${ability.toUpperCase()}:`);
		console.log(`  Displayed Score: ${scoreText}`);
		console.log(`  Dropdown Value: ${dropdownValue}`);
		console.log(`  Available Options: ${options.join(', ')}`);
	}

	// Evaluate stagedData in browser context
	const stagedData = await page.evaluate(() => {
		// Access the modal's session
		const modal = window.__characterCreationModal;
		if (modal?.session) {
			return modal.session.getStagedData();
		}
		return null;
	});

	console.log('\n=== STAGED DATA ===');
	console.log('Method:', stagedData?.abilityScoreMethod);
	console.log(
		'Ability Scores:',
		JSON.stringify(stagedData?.abilityScores, null, 2),
	);

	// Test swapping
	console.log('\n=== TESTING SWAP FUNCTIONALITY ===');
	const strDropdown = page.locator('#controls-strength select');
	const dexDropdown = page.locator('#controls-dexterity select');

	const strBefore = await strDropdown.inputValue();
	const dexBefore = await dexDropdown.inputValue();

	console.log(`\nBefore swap - STR: ${strBefore}, DEX: ${dexBefore}`);

	// Try to set STR to DEX's value (should trigger swap)
	await strDropdown.selectOption(dexBefore);

	// Wait a bit for any updates
	await page.waitForTimeout(500);

	const strAfter = await strDropdown.inputValue();
	const dexAfter = await dexDropdown.inputValue();

	console.log(`After swap - STR: ${strAfter}, DEX: ${dexAfter}`);

	if (strAfter === dexBefore && dexAfter === strBefore) {
		console.log('✅ SWAP WORKING CORRECTLY');
	} else {
		console.log('❌ SWAP NOT WORKING - Expected swap but got different values');
	}

	await electronApp.close();
});
