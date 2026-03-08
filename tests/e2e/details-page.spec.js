import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome, navigateToPage } from './helpers.js';

/**
 * 10. Details Page
 * Verifies the details page renders and character info fields
 * are editable.
 */

test.describe('Details Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Details Hero');
        await navigateToPage(page, 'details');
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'Details Hero');
            } finally {
                await electronApp.close();
            }
        }
    });

    test('10.1 — Details page renders with character info fields', async () => {
        // All expected form fields should be present
        const fields = [
            '#characterName',
            '#playerName',
            '#height',
            '#weight',
            '#gender',
            '#eyeColor',
            '#hairColor',
            '#alignment',
            '#deity',
            '#backstory',
        ];

        for (const selector of fields) {
            const field = page.locator(selector);
            await expect(field).toBeAttached({ timeout: 5_000 });
        }

        // Character name should be pre-filled from creation
        const nameInput = page.locator('#characterName');
        await expect(nameInput).toHaveValue('Details Hero', { timeout: 5_000 });
    });

    test('10.2 — Editing fields updates character state', async () => {
        // Fill in several fields
        const playerName = page.locator('#playerName');
        await playerName.fill('Test Player');
        await expect(playerName).toHaveValue('Test Player');

        const alignment = page.locator('#alignment');
        await alignment.selectOption({ label: /Neutral/ });
        const alignValue = await alignment.inputValue();
        expect(alignValue).toBeTruthy();

        const backstory = page.locator('#backstory');
        await backstory.fill('A brave adventurer from the test realm.');
        await expect(backstory).toHaveValue(
            'A brave adventurer from the test realm.',
        );

        // After editing, the character should be in an unsaved state
        const saveBtn = page.locator('#saveCharacter');
        await expect(saveBtn).toHaveClass(/unsaved/, { timeout: 5_000 });

        // Save and verify the save succeeds
        await saveBtn.click();
        const toast = page.locator('.notification.success');
        await expect(toast).toBeVisible({ timeout: 10_000 });
    });

    test('10.3 — Eye color and hair color fields are editable', async () => {
        const eyeColor = page.locator('#eyeColor');
        const hairColor = page.locator('#hairColor');

        await eyeColor.fill('Blue');
        await hairColor.fill('Auburn');

        await expect(eyeColor).toHaveValue('Blue');
        await expect(hairColor).toHaveValue('Auburn');

        // Should mark character as unsaved
        const saveBtn = page.locator('#saveCharacter');
        await expect(saveBtn).toHaveClass(/unsaved/, { timeout: 5_000 });
    });

    test('10.4 — Ally selector is present with predefined options', async () => {
        const allySelector = page.locator('#allySelector');
        await expect(allySelector).toBeAttached({ timeout: 5_000 });

        // Should have multiple options including predefined factions
        const optionCount = await allySelector.locator('option').count();
        expect(optionCount).toBeGreaterThan(1);
    });

    test('10.5 — Selecting a predefined ally shows info', async () => {
        const allySelector = page.locator('#allySelector');
        await allySelector.selectOption('harpers');

        // Ally info text should appear with a description
        const allyInfo = page.locator('#allyInfo');
        await expect(allyInfo).not.toHaveClass(/u-hidden/, { timeout: 5_000 });
        const text = await allyInfo.textContent();
        expect(text).toBeTruthy();
        expect(text.length).toBeGreaterThan(10);
    });

    test('10.6 — Selecting custom ally shows notes textarea', async () => {
        const allySelector = page.locator('#allySelector');
        await allySelector.selectOption('custom');

        const customNotes = page.locator('#allyCustomNotes');
        await expect(customNotes).not.toHaveClass(/u-hidden/, { timeout: 5_000 });

        await customNotes.fill('My personal guild of adventurers.');
        await expect(customNotes).toHaveValue('My personal guild of adventurers.');
    });

    test('10.7 — Appearance and ally changes persist after save', async () => {
        // Save current state
        const saveBtn = page.locator('#saveCharacter');
        await saveBtn.click();
        const toast = page.locator('.notification.success');
        await expect(toast).toBeVisible({ timeout: 10_000 });

        // Navigate away and come back
        await page.locator('button[data-page="home"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        // Click on the character to re-select it
        const characterCard = page.locator('.character-card', {
            has: page.locator('.card-header h5', { hasText: 'Details Hero' }),
        });
        await characterCard.click();
        await page.waitForSelector('#titlebarCharacterName', { timeout: 10_000 });

        await navigateToPage(page, 'details');

        // Verify fields persisted
        const eyeColor = page.locator('#eyeColor');
        await expect(eyeColor).toHaveValue('Blue', { timeout: 5_000 });

        const hairColor = page.locator('#hairColor');
        await expect(hairColor).toHaveValue('Auburn', { timeout: 5_000 });
    });
});
