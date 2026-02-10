import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * Character Sheet (PDF Preview)
 * Verifies the Character Sheet page loads bundled templates,
 * generates a filled PDF preview, and renders canvas pages.
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

/** Run through the wizard to create a level-1 character. */
async function createCharacter(page, name) {
    await clickCreateCharacterBtn(page);
    await page.waitForSelector('#newCharacterModal.show', { timeout: 10_000 });

    // Step 0: Basics
    await page.locator('#characterName').fill(name);
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Step 1: Rules
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

    // Step 5: Ability Scores — defaults fine
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Step 6: Review — click "Create"
    await page.locator('#wizardNextBtn').click();
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

/** Navigate to the Character Sheet (preview) page. */
async function navigateToPreview(page) {
    const previewBtn = page.locator('button[data-page="preview"]');
    await expect(previewBtn).not.toHaveAttribute('disabled', '', {
        timeout: 10_000,
    });
    await previewBtn.click();
    await page.waitForFunction(
        () => document.body.getAttribute('data-current-page') === 'preview',
        { timeout: 15_000 },
    );
}

test.describe('Character Sheet', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'PDF Preview Hero');
        await navigateToPreview(page);
    });

    test.afterAll(async () => {
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

    test('should populate template dropdown with bundled templates', async () => {
        const select = page.locator('#previewTemplateSelect');
        await expect(select).toBeVisible({ timeout: 10_000 });

        // Should have at least one option that is not a placeholder
        const optionCount = await select.locator('option').count();
        expect(optionCount).toBeGreaterThan(0);

        // First option should have a non-empty value (real template, not placeholder)
        const firstValue = await select.locator('option').first().getAttribute('value');
        expect(firstValue).toBeTruthy();
        expect(firstValue).toMatch(/\.pdf$/);
    });

    test('should show empty state before generating', async () => {
        const emptyState = page.locator('#previewEmptyState');
        await expect(emptyState).toBeVisible({ timeout: 5_000 });

        // Canvas container should have no canvas elements yet
        const canvasCount = await page.locator('#previewCanvasContainer canvas').count();
        expect(canvasCount).toBe(0);
    });

    test('should have export button disabled before generating', async () => {
        const exportBtn = page.locator('#previewExportBtn');
        await expect(exportBtn).toBeDisabled();
    });

    test('should generate PDF preview on Generate click', async () => {
        test.setTimeout(60_000);

        const generateBtn = page.locator('#previewGenerateBtn');
        await generateBtn.click();

        // Loading state should appear (may be brief)
        // Then wait for canvas to appear — the real success indicator
        await page.waitForSelector('#previewCanvasContainer canvas', {
            timeout: 30_000,
        });

        // At least one canvas page should be rendered
        const canvasCount = await page.locator('#previewCanvasContainer canvas').count();
        expect(canvasCount).toBeGreaterThan(0);

        // Empty state should be hidden
        const emptyState = page.locator('#previewEmptyState');
        await expect(emptyState).not.toBeVisible();

        // Error state should be hidden
        const errorState = page.locator('#previewError');
        await expect(errorState).not.toBeVisible();
    });

    test('should enable export button after successful generation', async () => {
        // This test relies on the previous test having generated a preview
        const exportBtn = page.locator('#previewExportBtn');
        await expect(exportBtn).toBeEnabled({ timeout: 5_000 });
    });

    test('should render canvas with non-zero dimensions', async () => {
        const canvas = page.locator('#previewCanvasContainer canvas').first();
        await expect(canvas).toBeVisible();

        const width = await canvas.getAttribute('width');
        const height = await canvas.getAttribute('height');
        expect(Number(width)).toBeGreaterThan(0);
        expect(Number(height)).toBeGreaterThan(0);
    });
});
