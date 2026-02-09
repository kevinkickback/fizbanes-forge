import { _electron as electron } from '@playwright/test';
import { expect, test } from '../fixtures.js';

/**
 * 6. Build Page (Character Sheet)
 * Verifies the Build page renders all sections with correct content
 * after character creation.
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

test.describe('Build Page', () => {
    let electronApp;
    let page;

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    test.beforeAll(async ({ }, testInfo) => {
        testInfo.setTimeout(120_000);
        ({ electronApp, page } = await launchAndWaitForHome());
        await createCharacter(page, 'Build Page Hero');

        // Navigate explicitly to build page
        const buildBtn = page.locator('button[data-page="build"]');
        await expect(buildBtn).not.toHaveAttribute('disabled', '', {
            timeout: 10_000,
        });
        await buildBtn.click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'build',
            { timeout: 15_000 },
        );
    });

    test.afterAll(async () => {
        if (electronApp) {
            try {
                await deleteCurrentCharacter(page);
            } finally {
                await electronApp.close();
            }
        }
    });

    test('6.1 — Build page renders all sections', async () => {
        const sections = [
            '#build-race',
            '#build-class',
            '#build-background',
            '#build-ability-scores',
            '#build-proficiencies',
        ];

        for (const selector of sections) {
            const section = page.locator(selector);
            await expect(section).toBeAttached({ timeout: 10_000 });
        }
    });

    test('6.2 — Race section displays selected race info', async () => {
        const raceSection = page.locator('#build-race');
        await expect(raceSection).toBeAttached({ timeout: 10_000 });

        // The race section should contain a search input or race list
        const raceSearch = raceSection.locator('#raceSearchInput');
        await expect(raceSearch).toBeAttached({ timeout: 5_000 });

        // The race info panel should have some content (the selected race)
        const infoPanel = raceSection.locator('#raceInfoPanel');
        const infoPanelText = await infoPanel.textContent();
        // After creation, the selected race info should be populated
        expect(infoPanelText.length).toBeGreaterThan(0);
    });

    test('6.3 — Class section displays selected class info', async () => {
        const classSection = page.locator('#build-class');
        await expect(classSection).toBeAttached({ timeout: 10_000 });

        // Should have a class select dropdown
        const classSelect = classSection.locator('#classSelect');
        await expect(classSelect).toBeAttached({ timeout: 5_000 });

        // The class info panel should have content
        const infoPanel = classSection.locator('#classInfoPanel');
        const infoPanelText = await infoPanel.textContent();
        expect(infoPanelText.length).toBeGreaterThan(0);
    });

    test('6.4 — Background section displays selected background', async () => {
        const bgSection = page.locator('#build-background');
        await expect(bgSection).toBeAttached({ timeout: 10_000 });

        const bgSearch = bgSection.locator('#backgroundSearchInput');
        await expect(bgSearch).toBeAttached({ timeout: 5_000 });

        const infoPanel = bgSection.locator('#backgroundInfoPanel');
        const infoPanelText = await infoPanel.textContent();
        expect(infoPanelText.length).toBeGreaterThan(0);
    });

    test('6.5 — Ability scores section displays current scores', async () => {
        const abilitySection = page.locator('#build-ability-scores');
        await expect(abilitySection).toBeAttached({ timeout: 10_000 });

        // Should show all 6 ability score boxes
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];

        for (const ability of abilities) {
            const box = abilitySection.locator(
                `.ability-score-box[data-ability="${ability}"]`,
            );
            await expect(box).toBeAttached({ timeout: 5_000 });

            // Each box should have a score displayed
            const score = await box.locator('.score').textContent();
            const numericScore = parseInt(score, 10);
            expect(numericScore).toBeGreaterThanOrEqual(1);
            expect(numericScore).toBeLessThanOrEqual(30);
        }
    });

    test('6.6 — Proficiencies section lists granted proficiencies', async () => {
        const profSection = page.locator('#build-proficiencies');
        await expect(profSection).toBeAttached({ timeout: 10_000 });

        // Should contain the proficiencies accordion
        const accordion = profSection.locator('#proficienciesAccordion');
        await expect(accordion).toBeAttached({ timeout: 5_000 });
    });
});
