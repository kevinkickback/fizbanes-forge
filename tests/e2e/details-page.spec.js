import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 10. Details Page
 * Verifies the details page renders and character info fields
 * are editable.
 */

async function launchAndWaitForHome() {
    const electronApp = await electron.launch({ args: ['.'] });

    let page = electronApp
        .windows()
        .find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await electronApp.waitForEvent(
            'window',
            (win) => !win.url().startsWith('devtools://'),
        );
    }

    await page.waitForSelector('#pageContent', { timeout: 60_000 });
    return { electronApp, page };
}

/** Click whichever "create character" button is visible (empty-state vs normal). */
async function clickCreateCharacterBtn(page) {
    const emptyStateBtn = page.locator('#welcomeCreateCharacterBtn');
    if (await emptyStateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await emptyStateBtn.click();
    } else {
        await page.locator('#newCharacterBtn').click();
    }
}

async function createCharacter(page, name) {
    await clickCreateCharacterBtn(page);
    await page.waitForSelector('#newCharacterModal.show', { timeout: 10_000 });

    await page.locator('#characterName').fill(name);
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const pointBuyRadio = page.locator('#pointBuy');
    if (!(await pointBuyRadio.isChecked())) {
        await pointBuyRadio.click();
    }
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="2"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const raceSelect = page.locator('#modalRaceSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalRaceSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await raceSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="3"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const classSelect = page.locator('#modalClassSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalClassSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await classSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="4"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const bgSelect = page.locator('#modalBackgroundSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalBackgroundSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await bgSelect.selectOption({ index: 1 });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="5"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(page.locator('#newCharacterModal')).not.toBeVisible({
        timeout: 10_000,
    });
    await expect(page.locator('#titlebarCharacterName')).toHaveText(name, {
        timeout: 10_000,
    });
}

/** Delete a specific test character by name via the Home page. */
async function deleteCharacterByName(page, characterName) {
    await page.locator('button[data-page="home"]').click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'home',
        { timeout: 10_000 },
    );
    const card = page.locator('.character-card', {
        has: page.locator('.card-header h5', { hasText: characterName }),
    });
    const deleteBtn = card.locator('.delete-character');
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });
    }
}

async function navigateToDetails(page) {
    const detailsBtn = page.locator('button[data-page="details"]');
    await expect(detailsBtn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await detailsBtn.click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'details',
        { timeout: 10_000 },
    );
}

test.describe('Details Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Details Hero');
        await navigateToDetails(page);
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
        await alignment.selectOption({ index: 1 });
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

        await navigateToDetails(page);

        // Verify fields persisted
        const eyeColor = page.locator('#eyeColor');
        await expect(eyeColor).toHaveValue('Blue', { timeout: 5_000 });

        const hairColor = page.locator('#hairColor');
        await expect(hairColor).toHaveValue('Auburn', { timeout: 5_000 });
    });
});
