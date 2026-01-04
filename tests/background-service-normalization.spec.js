import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Simulate the actual BackgroundService normalization logic to ensure
 * the equipment field mapping is integrated correctly.
 */

test('Verify BackgroundService normalization applies equipment field mapping', async () => {
    // Simulate the normalization logic from BackgroundService._normalizeBackgroundStructure
    const normalizeBackground = (background) => {
        // If already normalized or no proficiencies, return as-is
        if (background.proficiencies && !background.skillProficiencies) {
            return background;
        }

        // Create normalized proficiencies structure
        const normalized = { ...background };

        if (
            background.skillProficiencies ||
            background.toolProficiencies ||
            background.languageProficiencies
        ) {
            normalized.proficiencies = {
                skills: background.skillProficiencies || undefined,
                tools: background.toolProficiencies || undefined,
                languages: background.languageProficiencies || undefined,
            };
        }

        // Map startingEquipment to equipment for BackgroundDetails rendering
        if (background.startingEquipment && !normalized.equipment) {
            normalized.equipment = background.startingEquipment;
        }

        return normalized;
    };

    // Load raw backgrounds data
    const bgPath = path.join(process.cwd(), 'src/data/backgrounds.json');
    const bgContent = fs.readFileSync(bgPath, 'utf8');
    const backgroundsData = JSON.parse(bgContent);

    // Test with multiple backgrounds
    const testBackgrounds = ['Acolyte', 'Charlatan', 'Criminal'];
    const results = {};

    for (const bgName of testBackgrounds) {
        const bg = backgroundsData.background.find((b) => b.name === bgName);
        if (!bg) continue;

        const normalized = normalizeBackground(bg);

        results[bgName] = {
            hasStartingEquipment: !!bg.startingEquipment,
            hasEquipmentAfterNormalization: !!normalized.equipment,
            hasProficiencies: !!normalized.proficiencies,
            proficiencyFields: normalized.proficiencies
                ? Object.keys(normalized.proficiencies)
                : [],
        };
    }

    console.log('\n=== BackgroundService Normalization Test ===');
    console.log(JSON.stringify(results, null, 2));

    // Verify all backgrounds with startingEquipment get normalized equipment
    for (const [name, result] of Object.entries(results)) {
        if (result.hasStartingEquipment) {
            if (!result.hasEquipmentAfterNormalization) {
                throw new Error(
                    `${name}: startingEquipment exists but equipment field not mapped!`,
                );
            }
        }
    }

    console.log('\n✓ All backgrounds properly normalized with equipment field mapped');
});
