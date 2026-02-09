import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 4. Character Creation (New Character Wizard)
 * Walks through the 7-step wizard to verify modal behaviour,
 * step navigation, and successful character creation.
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

/** Open the New Character modal and wait for it to be visible. */
async function openWizard(page) {
    await clickCreateCharacterBtn(page);
    await page.waitForSelector('#newCharacterModal.show', { timeout: 10_000 });
}

/** Delete the currently loaded character via the Home page card's delete button. */
async function deleteCurrentCharacter(page) {
    // Navigate to home to see the character list
    await page.locator('button[data-page="home"]').click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'home',
        { timeout: 10_000 },
    );

    // Click the delete button on the first character card
    const deleteBtn = page.locator('.delete-character').first();
    if (await deleteBtn.isVisible()) {
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

test.describe('Character Creation Wizard', () => {
    let electronApp;
    let page;

    test.beforeEach(async () => {
        test.setTimeout(90_000);
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

    test('4.1 — "New Character" button opens the creation modal', async () => {
        await openWizard(page);
        const modal = page.locator('#newCharacterModal');
        await expect(modal).toBeVisible();
    });

    test('4.2 — Wizard stepper shows all 7 steps', async () => {
        await openWizard(page);

        const stepItems = page.locator('#newCharacterStepper .list-group-item');
        await expect(stepItems).toHaveCount(7);

        // Verify step labels
        const expectedLabels = [
            'Basics',
            'Rules',
            'Race',
            'Class',
            'Background',
            'Ability Scores',
            'Review',
        ];

        for (let i = 0; i < expectedLabels.length; i++) {
            const text = await stepItems.nth(i).textContent();
            expect(text).toContain(expectedLabels[i]);
        }
    });

    test('4.3 — Step 0 (Basics): can enter character name', async () => {
        await openWizard(page);

        const nameInput = page.locator('#characterName');
        await expect(nameInput).toBeVisible();

        await nameInput.fill('Thalion Starweaver');
        await expect(nameInput).toHaveValue('Thalion Starweaver');
    });

    test('4.10 — Back button returns to previous step', async () => {
        await openWizard(page);

        // Step 0: fill name and go next
        await page.locator('#characterName').fill('Testback');
        await page.locator('#wizardNextBtn').click();

        // Wait for step 1 to become active
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // Click back
        await page.locator('#wizardBackBtn').click();

        // Wait for step 0 to become active again
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="0"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });
    });

    test('4.12 — Cancelling the wizard returns to Home with no character created', async () => {
        await openWizard(page);

        // Cancel via the dismiss button
        await page
            .locator('#newCharacterModal button[data-bs-dismiss="modal"]')
            .first()
            .click();

        // Modal should close
        await expect(page.locator('#newCharacterModal')).not.toBeVisible({
            timeout: 5_000,
        });

        // Should still be on home page
        const currentPage = await page.getAttribute('body', 'data-current-page');
        expect(currentPage).toBe('home');

        // Titlebar should still show no character
        const charName = await page.locator('#titlebarCharacterName').textContent();
        expect(charName.trim()).toBe('No Character Loaded');
    });

    test('4.11 — Full wizard walkthrough: create a character end-to-end', async () => {
        await openWizard(page);

        // ── Step 0: Basics ──
        await page.locator('#characterName').fill('E2E Test Hero');
        await page.locator('#wizardNextBtn').click();

        // Verify we moved to step 1
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 1: Rules ──
        // Point Buy should be the default; ensure an ability score method is selected
        const pointBuyRadio = page.locator('#pointBuy');
        if (!(await pointBuyRadio.isChecked())) {
            await pointBuyRadio.click();
        }

        // PHB should be pre-selected by default — just click Next
        await page.locator('#wizardNextBtn').click();

        // Verify we moved to step 2
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="2"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 2: Race ──
        const raceSelect = page.locator('#modalRaceSelect');
        await expect(raceSelect).toBeVisible({ timeout: 5_000 });

        // Wait for options to populate, then pick the first real option
        await page.waitForFunction(
            () => {
                const sel = document.getElementById('modalRaceSelect');
                return sel && sel.options.length > 1;
            },
            { timeout: 15_000 },
        );

        // Select the first available race (index 1 to skip placeholder)
        await raceSelect.selectOption({ index: 1 });
        await page.locator('#wizardNextBtn').click();

        // Verify step 3
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="3"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 3: Class ──
        const classSelect = page.locator('#modalClassSelect');
        await expect(classSelect).toBeVisible({ timeout: 5_000 });

        await page.waitForFunction(
            () => {
                const sel = document.getElementById('modalClassSelect');
                return sel && sel.options.length > 1;
            },
            { timeout: 15_000 },
        );

        await classSelect.selectOption({ index: 1 });
        await page.locator('#wizardNextBtn').click();

        // Verify step 4
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="4"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 4: Background ──
        const bgSelect = page.locator('#modalBackgroundSelect');
        await expect(bgSelect).toBeVisible({ timeout: 5_000 });

        await page.waitForFunction(
            () => {
                const sel = document.getElementById('modalBackgroundSelect');
                return sel && sel.options.length > 1;
            },
            { timeout: 15_000 },
        );

        await bgSelect.selectOption({ index: 1 });
        await page.locator('#wizardNextBtn').click();

        // Verify step 5
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="5"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 5: Ability Scores ──
        // With point-buy defaults, just proceed (defaults are valid at base 8s)
        await page.locator('#wizardNextBtn').click();

        // Verify step 6 (Review)
        await expect(
            page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
        ).toHaveClass(/active/, { timeout: 5_000 });

        // ── Step 6: Review ──
        // The Next button should now say "Create"
        const createBtn = page.locator('#wizardNextBtn');
        const btnText = await createBtn.textContent();
        expect(btnText.trim()).toContain('Create');

        // The review section should show our character name
        const reviewContent = page.locator('[data-step-content]');
        const reviewText = await reviewContent.textContent();
        expect(reviewText).toContain('E2E Test Hero');

        // Click "Create"
        await createBtn.click();

        // Modal should close
        await expect(page.locator('#newCharacterModal')).not.toBeVisible({
            timeout: 10_000,
        });

        // ── Verify post-creation state ──

        // 4.13 — Titlebar should update with the character name
        await expect(page.locator('#titlebarCharacterName')).toHaveText(
            'E2E Test Hero',
            { timeout: 10_000 },
        );

        // Should navigate away from home to a character page (build)
        // or at minimum the character-gated pages should now be enabled
        const buildBtn = page.locator('button[data-page="build"]');
        const isDisabled = await buildBtn.getAttribute('disabled');
        expect(isDisabled).toBeNull(); // no longer disabled
    });
});
