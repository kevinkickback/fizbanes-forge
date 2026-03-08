import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome } from './helpers.js';

/**
 * 2. Navigation
 * Verifies sidebar routing, active-state highlighting, and
 * character-gated page guards.
 */

test.describe('Navigation', () => {
    let electronApp;
    let page;
    let testCharacterName;

    test.beforeEach(async () => {
        test.setTimeout(120_000);
        testCharacterName = null;
        ({ electronApp, page } = await launchAndWaitForHome());
    });

    test.afterEach(async () => {
        if (electronApp) {
            try {
                if (testCharacterName) {
                    await deleteCharacterByName(page, testCharacterName);
                }
            } catch {
                // Character may not exist or page may be in an unexpected state
            } finally {
                await electronApp.close();
            }
        }
    });

    test('2.1 — Home nav button is active on startup', async () => {
        const homeBtn = page.locator('button[data-page="home"]');
        await expect(homeBtn).toHaveClass(/active/);
    });

    test('2.2 — Clicking Settings navigates to settings page', async () => {
        const settingsBtn = page.locator('button[data-page="settings"]');
        await settingsBtn.click();

        // Wait for the page attribute to update
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'settings',
            { timeout: 10_000 },
        );

        const currentPage = await page.getAttribute('body', 'data-current-page');
        expect(currentPage).toBe('settings');

        // Settings button should now be active
        await expect(settingsBtn).toHaveClass(/active/);

        // Home button should no longer be active
        const homeBtn = page.locator('button[data-page="home"]');
        await expect(homeBtn).not.toHaveClass(/active/);
    });

    test('2.3 — Character-required pages are blocked without a character', async () => {
        const gatedPages = ['build', 'feats', 'spells', 'equipment', 'details'];

        for (const pageName of gatedPages) {
            const btn = page.locator(`button[data-page="${pageName}"]`);
            // The button should be disabled or have the disabled class
            const isDisabled =
                (await btn.getAttribute('disabled')) !== null ||
                (await btn.evaluate((el) => el.classList.contains('disabled')));

            expect(isDisabled).toBe(true);
        }
    });

    test('2.5 — Active nav button updates on page change', async () => {
        // Navigate to settings
        const settingsBtn = page.locator('button[data-page="settings"]');
        await settingsBtn.click();

        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'settings',
            { timeout: 10_000 },
        );

        await expect(settingsBtn).toHaveClass(/active/);

        // Navigate back to home
        const homeBtn = page.locator('button[data-page="home"]');
        await homeBtn.click();

        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 10_000 },
        );

        await expect(homeBtn).toHaveClass(/active/);
        await expect(settingsBtn).not.toHaveClass(/active/);
    });

    test('2.4 — Character-required pages become accessible after character creation', async () => {
        // Create a character
        await createCharacter(page, 'Nav Test Hero');
        testCharacterName = 'Nav Test Hero';

        // All gated pages should now be enabled
        const gatedPages = ['build', 'feats', 'spells', 'equipment', 'details'];

        for (const pageName of gatedPages) {
            const btn = page.locator(`button[data-page="${pageName}"]`);
            await expect(btn).not.toHaveAttribute('disabled', '', {
                timeout: 5_000,
            });
        }

        // Should be able to navigate to each gated page
        for (const pageName of gatedPages) {
            const btn = page.locator(`button[data-page="${pageName}"]`);
            await btn.click();

            await page.waitForFunction(
                (p) => document.body.getAttribute('data-current-page') === p,
                pageName,
                { timeout: 10_000 },
            );

            const currentPage = await page.getAttribute('body', 'data-current-page');
            expect(currentPage).toBe(pageName);
        }
    });

    test('2.6 — Build sub-nav items scroll to sections', async () => {
        await createCharacter(page, 'SubNav Hero');
        testCharacterName = 'SubNav Hero';

        // Navigate to build
        await page.locator('button[data-page="build"]').click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'build',
            { timeout: 10_000 },
        );

        // The build sub-nav should be visible
        const buildNavGroup = page.locator('[data-nav-group="build"]');
        await expect(buildNavGroup).toHaveClass(/is-open/, { timeout: 5_000 });

        // Sub-nav items should exist
        const subNavItems = [
            'build-race',
            'build-class',
            'build-background',
            'build-ability-scores',
            'build-proficiencies',
        ];

        for (const sectionName of subNavItems) {
            const subBtn = page.locator(`[data-section="${sectionName}"]`);
            await expect(subBtn).toBeVisible({ timeout: 5_000 });
        }

        // Click a sub-nav item and verify it becomes active
        const classSubNav = page.locator('[data-section="build-class"]');
        await classSubNav.click();
        await expect(classSubNav).toHaveClass(/active/, { timeout: 5_000 });
    });
});
