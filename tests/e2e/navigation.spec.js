import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 2. Navigation
 * Verifies sidebar routing, active-state highlighting, and
 * character-gated page guards.
 */

/** Helper: launch app and wait for home page readiness. */
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

/** Run through the wizard to create a character quickly. */
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
