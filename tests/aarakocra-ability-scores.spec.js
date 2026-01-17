/**
 * Test: Aarakocra ability scores in character creation
 * 
 * Verify that non-PHB races (Aarakocra EEPC) show correct ability score bonuses
 */

import { _electron as electron, expect, test } from '@playwright/test';

test('Aarakocra EEPC should show DEX +2 and WIS +1 in ability scores step', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    try {
        let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
        }

        page.on('console', (msg) => {
            const text = msg.text();
            console.log(`[${msg.type()}] ${text}`);
        });

        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // Click New Character button
        const newCharBtn = page.locator('button:has-text("New Character")');
        await newCharBtn.waitFor({ state: 'visible', timeout: 10000 });
        await newCharBtn.click();

        const modal = page.locator('#newCharacterModal');
        await modal.waitFor({ state: 'visible', timeout: 10000 });

        // Step 0: Enter name
        const nameInput = page.locator('#characterName');
        await nameInput.fill('Test Aarakocra');

        const nextBtn = page.locator('#wizardNextBtn');
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 1: Enable EEPC source
        await page.waitForTimeout(500);
        const eepcToggle = page.locator('.source-toggle[data-source="eepc"], .source-toggle[data-source="EEPC"]').first();
        await eepcToggle.waitFor({ state: 'visible', timeout: 5000 });
        await eepcToggle.click();
        await page.waitForTimeout(300);
        console.log('Clicked EEPC source toggle');

        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 2: Select Aarakocra EEPC
        const raceSelect = page.locator('#modalRaceSelect');
        await raceSelect.waitFor({ state: 'visible', timeout: 5000 });

        const options = await raceSelect.locator('option').allTextContents();
        console.log('Available races:', options.filter(o => o.includes('Aarakocra')));

        const aarakocraOption = options.find(opt => opt.includes('Aarakocra') && opt.includes('EEPC'));
        expect(aarakocraOption).toBeDefined();
        console.log('Found Aarakocra option:', aarakocraOption);

        await raceSelect.selectOption({ label: aarakocraOption });
        await page.waitForTimeout(500);

        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 3: Select any class
        const classSelect = page.locator('#modalClassSelect');
        await classSelect.waitFor({ state: 'visible', timeout: 5000 });
        await classSelect.selectOption({ index: 1 }); // Select first real option
        await page.waitForTimeout(500);

        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 4: Select any background
        const backgroundSelect = page.locator('#modalBackgroundSelect');
        await backgroundSelect.waitFor({ state: 'visible', timeout: 5000 });
        await backgroundSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        await nextBtn.click();
        await page.waitForTimeout(1000);

        // Step 5: Check ability scores
        console.log('Now on ability scores step');

        // Check DEX box for +2 bonus
        const dexBox = page.locator('.ability-score-box[data-ability="dexterity"]');
        await dexBox.waitFor({ state: 'visible', timeout: 5000 });

        const dexBonus = await dexBox.locator('.bonus').textContent();
        console.log('DEX bonus displayed:', dexBonus);
        expect(dexBonus.trim()).toBe('+2');

        // Check WIS box for +1 bonus
        const wisBox = page.locator('.ability-score-box[data-ability="wisdom"]');
        const wisBonus = await wisBox.locator('.bonus').textContent();
        console.log('WIS bonus displayed:', wisBonus);
        expect(wisBonus.trim()).toBe('+1');

        // Check that other abilities have no bonus
        const strBox = page.locator('.ability-score-box[data-ability="strength"]');
        const strBonusVisible = await strBox.locator('.bonus').isVisible();
        console.log('STR bonus visible:', strBonusVisible);
        expect(strBonusVisible).toBe(false);

        console.log('✅ Aarakocra EEPC ability bonuses are correct!');

    } finally {
        await electronApp.close();
    }
});
