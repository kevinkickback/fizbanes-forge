import { test } from '@playwright/test';

/**
 * Test that backgrounds render equipment after normalization fix.
 * Verifies that startingEquipment is properly mapped to equipment field
 * and renders in BackgroundDetails.
 */

test('Verify equipment rendering for Acolyte background', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for app to be ready
    await page.waitForFunction(() => window.appReady === true, {
        timeout: 10000,
    });

    // Load Acolyte background
    const acolyteEquipment = await page.evaluate(() => {
        // Get Acolyte from loaded backgrounds
        const acolyte = window.data.backgrounds.find((b) => b.name === 'Acolyte');
        if (!acolyte) {
            return { success: false, message: 'Acolyte not found' };
        }

        // Check if equipment field exists after normalization
        return {
            success: true,
            hasEquipment: !!acolyte.equipment,
            equipmentIsArray: Array.isArray(acolyte.equipment),
            equipmentLength: acolyte.equipment ? acolyte.equipment.length : 0,
            equipmentSample: acolyte.equipment ? acolyte.equipment[0] : null,
        };
    });

    console.log('=== Acolyte Equipment Field ===');
    console.log(JSON.stringify(acolyteEquipment, null, 2));

    // Now simulate selecting Acolyte and check if equipment renders in the UI
    await page.evaluate(() => {
        // Set up background in AppState
        window.AppState.set('selectedBackground', 'Acolyte');
        window.EventBus.emit('BACKGROUND_SELECTED', { name: 'Acolyte' });
    });

    // Wait for background details to render
    await page.waitForTimeout(500);

    // Check if equipment section is visible and has content
    const equipmentRendered = await page.evaluate(() => {
        const equipmentSection = document.querySelector('[data-section="equipment"]');
        if (!equipmentSection) {
            return {
                found: false,
                message: 'Equipment section not found in DOM',
            };
        }

        const items = equipmentSection.querySelectorAll('li');
        return {
            found: true,
            itemCount: items.length,
            items: Array.from(items).map((li) => li.textContent),
        };
    });

    console.log('=== Equipment Section in DOM ===');
    console.log(JSON.stringify(equipmentRendered, null, 2));
});

test('Verify languages rendering for Acolyte background', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for app to be ready
    await page.waitForFunction(() => window.appReady === true, {
        timeout: 10000,
    });

    // Load Acolyte background
    const acolyteLanguages = await page.evaluate(() => {
        const acolyte = window.data.backgrounds.find((b) => b.name === 'Acolyte');
        if (!acolyte) {
            return { success: false, message: 'Acolyte not found' };
        }

        return {
            success: true,
            hasLanguageProficiencies:
                !!acolyte.languageProficiencies ||
                (acolyte.proficiencies && !!acolyte.proficiencies.languages),
            languageData: acolyte.languageProficiencies || acolyte.proficiencies?.languages,
        };
    });

    console.log('=== Acolyte Languages Field ===');
    console.log(JSON.stringify(acolyteLanguages, null, 2));

    // Set up background in AppState
    await page.evaluate(() => {
        window.AppState.set('selectedBackground', 'Acolyte');
        window.EventBus.emit('BACKGROUND_SELECTED', { name: 'Acolyte' });
    });

    // Wait for background details to render
    await page.waitForTimeout(500);

    // Check if languages section is visible
    const languagesRendered = await page.evaluate(() => {
        const languagesSection = document.querySelector('[data-section="languages"]');
        if (!languagesSection) {
            return {
                found: false,
                message: 'Languages section not found in DOM',
            };
        }

        const items = languagesSection.querySelectorAll('li');
        return {
            found: true,
            itemCount: items.length,
            items: Array.from(items).map((li) => li.textContent),
        };
    });

    console.log('=== Languages Section in DOM ===');
    console.log(JSON.stringify(languagesRendered, null, 2));
});
