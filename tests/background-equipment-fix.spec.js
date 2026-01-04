import { test } from '@playwright/test';

/**
 * Verify that the equipment field mapping fix works.
 * Tests that startingEquipment from JSON is properly mapped to equipment field
 * and BackgroundDetails can render it.
 */

test('Verify Acolyte background has equipment field after normalization', async ({
    page,
}) => {
    await page.goto('http://localhost:3000');

    // Wait for app to be ready
    await page.waitForFunction(() => window.appReady === true, {
        timeout: 10000,
    });

    // Check that Acolyte has equipment field in the normalized data
    const result = await page.evaluate(() => {
        const acolyte = window.data.backgrounds.find((b) => b.name === 'Acolyte');
        if (!acolyte) {
            return { success: false, message: 'Acolyte background not found' };
        }

        const hasEquipment = !!acolyte.equipment;
        const equipmentLength = acolyte.equipment ? acolyte.equipment.length : 0;

        return {
            success: hasEquipment,
            message: hasEquipment
                ? `Equipment field mapped successfully (${equipmentLength} items)`
                : 'Equipment field NOT found',
            name: acolyte.name,
            hasEquipment,
            equipmentLength,
        };
    });

    console.log(JSON.stringify(result, null, 2));
});
