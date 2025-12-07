import { _electron as electron, expect, test } from '@playwright/test';

async function launchApp() {
    const app = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    let page = app.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await app.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });
    await page.waitForSelector('.character-card', { timeout: 60000 });

    return { app, page };
}

async function openCharacter(page, characterName) {
    const locator = page.locator('.character-card', { hasText: characterName }).first();
    await expect(locator).toBeVisible({ timeout: 15000 });
    await locator.click();

    // Navigate to build page
    await page.waitForSelector('button.nav-link[data-page="build"]', { timeout: 15000 });
    await page.click('button.nav-link[data-page="build"]');
    await page.waitForSelector('[data-current-page="build"]', { timeout: 45000 });
}

async function selectRaceAndChoices(page) {
    const raceSelect = page.locator('#raceSelect');
    await expect(raceSelect).toBeVisible({ timeout: 15000 });
    await raceSelect.selectOption('Half-Elf_PHB');

    // Wait for ability choices to appear
    const abilitySelects = page.locator('.ability-choice-select');
    await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });

    await abilitySelects.nth(0).selectOption('strength');
    await abilitySelects.nth(1).selectOption('dexterity');

    // Capture the displayed bonuses after selection
    const bonusSnapshot = {
        strength: await getBonusText(page, 'strength'),
        dexterity: await getBonusText(page, 'dexterity'),
        charisma: await getBonusText(page, 'charisma'),
    };

    await saveCharacter(page);

    return bonusSnapshot;
}

async function expectBonus(page, ability, expectedText) {
    const bonusLocator = page.locator(`[data-ability="${ability}"] .bonus`);
    await bonusLocator.waitFor({ state: 'visible', timeout: 15000 });
    await expect(bonusLocator).toHaveText(expectedText);
}

async function getBonusText(page, ability) {
    const bonusLocator = page.locator(`[data-ability="${ability}"] .bonus`);
    await bonusLocator.waitFor({ state: 'visible', timeout: 15000 });
    return (await bonusLocator.textContent())?.trim() || '';
}

async function saveCharacter(page) {
    const saveButton = page.locator('#saveCharacter');
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    await saveButton.click();

    // Wait for unsaved indicator to disappear if present
    const unsaved = page.locator('#unsavedChangesIndicator');
    await unsaved.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });

    // Small buffer to allow disk write
    await page.waitForTimeout(500);
}

async function verifyRestoredState(page, expectedBonuses) {
    const raceSelect = page.locator('#raceSelect');
    await expect(raceSelect).toHaveValue('Half-Elf_PHB', { timeout: 15000 });

    const abilitySelects = page.locator('.ability-choice-select');
    await expect(abilitySelects).toHaveCount(2, { timeout: 15000 });
    await expect(abilitySelects.nth(0)).toHaveValue('strength');
    await expect(abilitySelects.nth(1)).toHaveValue('dexterity');

    // Validate that the displayed bonuses match what we saw before closing
    await expectBonus(page, 'strength', expectedBonuses.strength);
    await expectBonus(page, 'dexterity', expectedBonuses.dexterity);
    await expectBonus(page, 'charisma', expectedBonuses.charisma);
}

// End-to-end regression: racial ability choices should persist after reload
// and be re-applied when the character is reopened.
test.describe('Racial Ability Choice Persistence', () => {
    test('persists selections across app restart', async () => {
        test.setTimeout(180000);
        let electronAppOne;
        let electronAppTwo;
        let initialBonuses;

        try {
            // First run: set race + ability choices and let auto-save persist them
            const firstLaunch = await launchApp();
            electronAppOne = firstLaunch.app;
            const { page: firstPage } = firstLaunch;

            const characterName = 'PLZ WRK';
            await openCharacter(firstPage, characterName);
            initialBonuses = await selectRaceAndChoices(firstPage);

            // Give the app a moment to persist changes
            await firstPage.waitForTimeout(1500);
        } finally {
            if (electronAppOne) {
                await electronAppOne.close();
            }
        }

        try {
            // Second run: reopen and verify choices were restored
            const secondLaunch = await launchApp();
            electronAppTwo = secondLaunch.app;
            const { page: secondPage } = secondLaunch;

            const characterName = 'PLZ WRK';
            await openCharacter(secondPage, characterName);
            await verifyRestoredState(secondPage, initialBonuses);
        } finally {
            if (electronAppTwo) {
                await electronAppTwo.close();
            }
        }
    });
});
