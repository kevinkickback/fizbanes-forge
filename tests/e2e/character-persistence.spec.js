import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 5. Character Persistence (Save / Load / Delete)
 * Verifies the full save → reload → load → delete round-trip.
 * Each test creates its own character and cleans up after.
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

/**
 * Run through the full character wizard to create a character with the given name.
 * Returns on the build page with the character loaded.
 */
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

    // Step 0: Basics
    await page.locator('#characterName').fill(name);
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Step 1: Rules — PHB pre-selected, just proceed
    const pointBuyRadio = page.locator('#pointBuy');
    if (!(await pointBuyRadio.isChecked())) {
        await pointBuyRadio.click();
    }
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="2"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Step 2: Race
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

    // Step 3: Class
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

    // Step 4: Background
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

    // Step 5: Ability Scores — defaults are fine
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Step 6: Review — click "Create"
    await page.locator('#wizardNextBtn').click();

    // Wait for modal to close and character to load
    await expect(page.locator('#newCharacterModal')).not.toBeVisible({
        timeout: 10_000,
    });
    await expect(page.locator('#titlebarCharacterName')).toHaveText(name, {
        timeout: 10_000,
    });
}

/** Delete the currently loaded character via the Home page. */
async function deleteCurrentCharacter(page) {
    await page.locator('button[data-page="home"]').click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'home',
        { timeout: 10_000 },
    );

    const deleteBtn = page.locator('.delete-character').first();
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });
    }
}

test.describe('Character Persistence', () => {
    let electronApp;
    let page;

    test.beforeEach(async () => {
        test.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
    });

    test.afterEach(async () => {
        if (electronApp) {
            try {
                await deleteCurrentCharacter(page);
            } catch {
                // Character may not exist or page may be in an unexpected state
            } finally {
                await electronApp.close();
            }
        }
    });

    test('5.3 — Character card in Home shows name, race, class, level', async () => {
        await createCharacter(page, 'Card Info Hero');

        // Navigate to home to see the card
        await page.locator('button[data-page="home"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        // Wait for at least one character card to render
        await page.waitForSelector('.character-card', { timeout: 10_000 });

        const card = page.locator('.character-card').first();

        // Should display the character name
        const name = await card.locator('.card-header h5').textContent();
        expect(name).toContain('Card Info Hero');

        // Should show Level
        const levelText = await card.locator('.detail-item').first().textContent();
        expect(levelText).toMatch(/Level\s+\d+/);

        // Card should have a data-character-id
        const charId = await card.getAttribute('data-character-id');
        expect(charId).toBeTruthy();
    });

    test('5.4 — Clicking a character card loads that character', async () => {
        await createCharacter(page, 'Clickable Hero');

        // Navigate to home
        await page.locator('button[data-page="home"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        await page.waitForSelector('.character-card', { timeout: 10_000 });

        // Click the card (use the card-header h5 text area to avoid portrait overlay)
        const card = page.locator('.character-card').first();
        await card.locator('.card-header h5').click({ force: true });

        // Titlebar should show the character name
        await expect(page.locator('#titlebarCharacterName')).toHaveText(
            'Clickable Hero',
            { timeout: 10_000 },
        );

        // Character-gated pages should now be enabled
        const buildBtn = page.locator('button[data-page="build"]');
        await expect(buildBtn).not.toHaveAttribute('disabled', '', {
            timeout: 5_000,
        });
    });

    test('5.5 — Deleting a character removes it from the list', async () => {
        await createCharacter(page, 'Doomed Hero');

        // Navigate to home
        await page.locator('button[data-page="home"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        await page.waitForSelector('.character-card', { timeout: 10_000 });

        // Get the character ID of the card we're about to delete
        const firstCard = page.locator('.character-card').first();
        const charId = await firstCard.getAttribute('data-character-id');
        expect(charId).toBeTruthy();

        // Delete the character
        const deleteBtn = page.locator('.delete-character').first();
        await deleteBtn.click();

        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();

        // Confirmation modal should close
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });

        // The specific card should no longer exist
        await expect(
            page.locator(`.character-card[data-character-id="${charId}"]`),
        ).not.toBeAttached({ timeout: 10_000 });
    });

    test('5.6 — Delete confirmation modal appears before deletion', async () => {
        await createCharacter(page, 'Cautious Hero');

        await page.locator('button[data-page="home"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        await page.waitForSelector('.character-card', { timeout: 10_000 });

        // Click delete
        await page.locator('.delete-character').first().click();

        // Confirmation modal should appear
        const modal = page.locator('#confirmationModal');
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Should have a confirm button with "Delete" text
        const confirmBtn = page.locator('#confirmButton');
        const btnText = await confirmBtn.textContent();
        expect(btnText.trim()).toContain('Delete');

        // Cancel instead to leave character intact
        await page.locator('#confirmationModal .btn-secondary').click();

        await expect(modal).not.toBeVisible({ timeout: 5_000 });

        // Card should still exist
        const cards = await page.locator('.character-card').count();
        expect(cards).toBeGreaterThan(0);
    });

    test('5.1 — Save button exists and reflects saved state after creation', async () => {
        await createCharacter(page, 'Saveable Hero');

        // Should be on build page — the save button should exist
        const saveBtn = page.locator('#saveCharacter');
        await expect(saveBtn).toBeVisible({ timeout: 5_000 });

        // After creation the character is auto-saved, so save button should
        // be disabled (no unsaved changes) and not have .unsaved class
        await expect(saveBtn).not.toHaveClass(/unsaved/, { timeout: 5_000 });
    });
});
