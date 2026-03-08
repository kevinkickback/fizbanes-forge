import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome, navigateToPage } from './helpers.js';

/**
 * Character Sheet (PDF Preview)
 * Verifies the Character Sheet page loads bundled templates,
 * generates a filled PDF preview, and renders canvas pages.
 */

test.describe('Character Sheet', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'PDF Preview Hero');
        await navigateToPage(page, 'preview');
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCharacterByName(page, 'PDF Preview Hero');
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
