import { _electron as electron } from '@playwright/test';
import { expect } from '../fixtures.js';

/**
 * Shared E2E helper functions.
 * Extracted from duplicate implementations across E2E test files.
 */

/** Launch the Electron app and wait for the home page to be ready. */
export async function launchAndWaitForHome() {
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

/** Launch the Electron app without waiting for #pageContent. */
export async function launchApp() {
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

    return { electronApp, page };
}

/** Click whichever "create character" button is visible (empty-state vs normal). */
export async function clickCreateCharacterBtn(page) {
    const emptyStateBtn = page.locator('#welcomeCreateCharacterBtn');
    if (await emptyStateBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await emptyStateBtn.click();
    } else {
        await page.locator('#newCharacterBtn').click();
    }
}

/** Run through the wizard to create a level-1 character. */
export async function createCharacter(page, name) {
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
    await raceSelect.selectOption({ label: /Human/ });
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
    await classSelect.selectOption({ label: /Fighter/ });
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
    await bgSelect.selectOption({ label: /Acolyte/ });
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

/** Delete a character by name from the home page. */
export async function deleteCharacterByName(page, characterName) {
    // Navigate to home to see the character list
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

        // Confirm in the confirmation modal
        const confirmBtn = page.locator('#confirmButton');
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();

        // Wait for modal to close
        await expect(page.locator('#confirmationModal')).not.toBeVisible({
            timeout: 5_000,
        });
    }
}

/** Navigate to a specific page by its data-page attribute. */
export async function navigateToPage(page, pageName) {
    const btn = page.locator(`button[data-page="${pageName}"]`);
    await expect(btn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await btn.click();
    await page.waitForFunction(
        (name) => document.body.getAttribute('data-current-page') === name,
        pageName,
        { timeout: 10_000 },
    );
}
