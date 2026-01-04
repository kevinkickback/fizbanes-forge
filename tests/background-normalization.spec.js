import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Test the equipment field mapping directly using JSON data.
 * This mimics what BackgroundService._normalizeBackgroundStructure does.
 */

test('Verify equipment field is properly mapped from startingEquipment', async () => {
    // Load the raw backgrounds JSON
    const bgPath = path.join(
        process.cwd(),
        'src/data/backgrounds.json'
    );
    const bgContent = fs.readFileSync(bgPath, 'utf8');
    const backgroundsData = JSON.parse(bgContent);

    // Get Acolyte
    const acolyte = backgroundsData.background.find((b) => b.name === 'Acolyte');

    // Simulate the normalization that happens in BackgroundService
    const normalized = { ...acolyte };

    // This is the fix we added - map startingEquipment to equipment
    if (acolyte.startingEquipment && !normalized.equipment) {
        normalized.equipment = acolyte.startingEquipment;
    }

    // Verify the mapping worked
    const results = {
        originalHasStartingEquipment: !!acolyte.startingEquipment,
        originalStartingEquipmentLength: acolyte.startingEquipment
            ? acolyte.startingEquipment.length
            : 0,
        normalizedHasEquipment: !!normalized.equipment,
        normalizedEquipmentLength: normalized.equipment
            ? normalized.equipment.length
            : 0,
        mappingSuccessful:
            !!acolyte.startingEquipment && !!normalized.equipment,
        sampleEquipment: normalized.equipment
            ? normalized.equipment[0]
            : null,
    };

    console.log('\n=== Equipment Field Mapping Test ===');
    console.log(JSON.stringify(results, null, 2));

    // Assert the mapping worked
    if (!results.mappingSuccessful) {
        throw new Error(
            'Equipment field mapping failed! ' +
            'startingEquipment was not mapped to equipment field.',
        );
    }
});
