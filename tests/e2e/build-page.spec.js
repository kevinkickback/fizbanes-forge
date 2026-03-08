import { expect, test } from '../fixtures.js';
import { createCharacter, deleteCharacterByName, launchAndWaitForHome } from './helpers.js';

/**
 * 6. Build Page (Character Sheet)
 * Verifies the Build page renders all sections with correct content
 * after character creation.
 */

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
                await deleteCharacterByName(page, 'Build Page Hero');
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
