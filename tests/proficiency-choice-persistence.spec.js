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

    // Wait for character list or new character button to load
    await page.waitForTimeout(2000);

    return { app, page };
}

async function createCharacter(page, characterName) {
    // Click "New Character" button
    const newCharacterBtn = page.locator('#newCharacterBtn');
    await expect(newCharacterBtn).toBeVisible({ timeout: 15000 });
    await newCharacterBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('#newCharacterModal.show', { timeout: 15000 });

    // Fill in character name
    const nameInput = page.locator('#newCharacterName');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(characterName);

    // Submit form
    const createButton = page.locator('#createCharacterBtn');
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for modal to close
    await page.waitForSelector('#newCharacterModal.show', { state: 'hidden', timeout: 15000 });

    // Wait for character card to appear
    await page.waitForTimeout(1000);
    const characterCard = page.locator('.character-card', { hasText: characterName }).first();
    await expect(characterCard).toBeVisible({ timeout: 15000 });

    return characterCard;
}

async function openCharacter(page, characterName) {
    const locator = page.locator('.character-card', { hasText: characterName }).first();
    await expect(locator).toBeVisible({ timeout: 15000 });
    await locator.click();

    // Navigate to build page
    await page.waitForSelector('button.nav-link[data-page="build"]', { timeout: 15000 });
    await page.click('button.nav-link[data-page="build"]');
    await page.waitForSelector('[data-current-page="build"]', { timeout: 30000 });

    // Wait for race card to initialize
    await page.waitForTimeout(2000);
}

async function selectRaceAndSkillProficiencies(page) {
    const raceSelect = page.locator('#raceSelect');
    await expect(raceSelect).toBeVisible({ timeout: 15000 });
    
    // Select Human race (commonly offers skill proficiency choices)
    await raceSelect.selectOption({ label: 'Human (PHB)' });
    
    // Wait for skill container to be visible
    await page.waitForSelector('#skillsContainer', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Get skill proficiency checkboxes
    const skillCheckboxes = page.locator('#skillsContainer input[type="checkbox"]');
    const count = await skillCheckboxes.count();

    // Store which skills we selected
    const selectedSkills = [];
    if (count > 0) {
        // Select first 2 available skills (if available)
        const selectLimit = Math.min(2, count);
        for (let i = 0; i < selectLimit; i++) {
            const checkbox = skillCheckboxes.nth(i);
            const isChecked = await checkbox.isChecked();
            if (!isChecked) {
                await checkbox.click();
                // Get the label text to store what we selected
                const checkboxId = await checkbox.getAttribute('id');
                const label = page.locator(`label[for="${checkboxId}"]`);
                const labelText = await label.textContent();
                selectedSkills.push(labelText?.trim() || `skill_${i}`);
            }
        }
    }

    await saveCharacter(page);

    return {
        race: 'Human_PHB',
        selectedSkills,
    };
}

async function selectClassAndSkillProficiencies(page) {
    const classSelect = page.locator('#classSelect');
    await expect(classSelect).toBeVisible({ timeout: 15000 });
    
    // Select Barbarian class (offers skill proficiency choices)
    await classSelect.selectOption({ label: 'Barbarian (PHB)' });
    
    // Wait for skill container to be updated
    await page.waitForSelector('#skillsContainer', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Get skill proficiency checkboxes
    const skillCheckboxes = page.locator('#skillsContainer input[type="checkbox"]');
    const count = await skillCheckboxes.count();

    // Store which skills we selected
    const selectedSkills = [];
    if (count > 0) {
        // Select first 2 available skills (if available)
        const selectLimit = Math.min(2, count);
        for (let i = 0; i < selectLimit; i++) {
            const checkbox = skillCheckboxes.nth(i);
            const isChecked = await checkbox.isChecked();
            if (!isChecked) {
                await checkbox.click();
                // Get the label text to store what we selected
                const checkboxId = await checkbox.getAttribute('id');
                const label = page.locator(`label[for="${checkboxId}"]`);
                const labelText = await label.textContent();
                selectedSkills.push(labelText?.trim() || `skill_${i}`);
            }
        }
    }

    await saveCharacter(page);

    return {
        class: 'Barbarian_PHB',
        selectedSkills,
    };
}

async function selectBackgroundAndSkillProficiencies(page) {
    const backgroundSelect = page.locator('#backgroundSelect');
    await expect(backgroundSelect).toBeVisible({ timeout: 15000 });
    
    // Select Acolyte background (offers skill proficiency choices)
    await backgroundSelect.selectOption({ label: 'Acolyte (PHB)' });
    
    // Wait for skill container to be updated
    await page.waitForSelector('#skillsContainer', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Get skill proficiency checkboxes
    const skillCheckboxes = page.locator('#skillsContainer input[type="checkbox"]');
    const count = await skillCheckboxes.count();

    // Store which skills we selected
    const selectedSkills = [];
    if (count > 0) {
        // Select first 2 available skills (if available)
        const selectLimit = Math.min(2, count);
        for (let i = 0; i < selectLimit; i++) {
            const checkbox = skillCheckboxes.nth(i);
            const isChecked = await checkbox.isChecked();
            if (!isChecked) {
                await checkbox.click();
                // Get the label text to store what we selected
                const checkboxId = await checkbox.getAttribute('id');
                const label = page.locator(`label[for="${checkboxId}"]`);
                const labelText = await label.textContent();
                selectedSkills.push(labelText?.trim() || `skill_${i}`);
            }
        }
    }

    await saveCharacter(page);

    return {
        background: 'Acolyte_PHB',
        selectedSkills,
    };
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

async function verifySkillProficiencies(page, expectedData) {
    // Wait for build page to load
    await page.waitForSelector('#skillsContainer', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify skill proficiencies were preserved
    if (expectedData.selectedSkills && expectedData.selectedSkills.length > 0) {
        for (const skillName of expectedData.selectedSkills) {
            // Find checkbox by associated label
            const label = page.locator(`label:has-text("${skillName}")`).first();
            await expect(label).toBeVisible({ timeout: 15000 });
            
            const checkboxId = await label.getAttribute('for');
            const checkbox = page.locator(`#${checkboxId}`);
            await expect(checkbox).toBeChecked({ timeout: 15000 });
        }
    }
}

// End-to-end regression: skill proficiency choices should persist after reload
// and be re-applied when the character is reopened.
test.describe('Proficiency Choice Persistence', () => {
    test('persists skill selections across app restart after race selection', async () => {
        test.setTimeout(180000);
        let electronAppOne;
        let electronAppTwo;
        let proficiencyData;
        const testCharacterName = `test-race-proficiency-${Date.now()}`;

        try {
            // First run: create character and set race + skill proficiency choices
            const firstLaunch = await launchApp();
            electronAppOne = firstLaunch.app;
            const { page: firstPage } = firstLaunch;

            await createCharacter(firstPage, testCharacterName);
            await openCharacter(firstPage, testCharacterName);
            proficiencyData = await selectRaceAndSkillProficiencies(firstPage);

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

            await openCharacter(secondPage, testCharacterName);
            await verifySkillProficiencies(secondPage, proficiencyData);
        } finally {
            if (electronAppTwo) {
                await electronAppTwo.close();
            }
        }
    });

    test('persists skill selections across app restart after class selection', async () => {
        test.setTimeout(180000);
        let electronAppOne;
        let electronAppTwo;
        let proficiencyData;
        const testCharacterName = `test-class-proficiency-${Date.now()}`;

        try {
            // First run: create character and set class + skill proficiency choices
            const firstLaunch = await launchApp();
            electronAppOne = firstLaunch.app;
            const { page: firstPage } = firstLaunch;

            await createCharacter(firstPage, testCharacterName);
            await openCharacter(firstPage, testCharacterName);
            proficiencyData = await selectClassAndSkillProficiencies(firstPage);

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

            await openCharacter(secondPage, testCharacterName);
            await verifySkillProficiencies(secondPage, proficiencyData);
        } finally {
            if (electronAppTwo) {
                await electronAppTwo.close();
            }
        }
    });

    test('persists skill selections across app restart after background selection', async () => {
        test.setTimeout(180000);
        let electronAppOne;
        let electronAppTwo;
        let proficiencyData;
        const testCharacterName = `test-bg-proficiency-${Date.now()}`;

        try {
            // First run: create character and set background + skill proficiency choices
            const firstLaunch = await launchApp();
            electronAppOne = firstLaunch.app;
            const { page: firstPage } = firstLaunch;

            await createCharacter(firstPage, testCharacterName);
            await openCharacter(firstPage, testCharacterName);
            proficiencyData = await selectBackgroundAndSkillProficiencies(firstPage);

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

            await openCharacter(secondPage, testCharacterName);
            await verifySkillProficiencies(secondPage, proficiencyData);
        } finally {
            if (electronAppTwo) {
                await electronAppTwo.close();
            }
        }
    });
});
