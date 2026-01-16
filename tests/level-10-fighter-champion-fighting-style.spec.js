/**
 * Test for dynamic Fighting Style feature addition when selecting Champion subclass
 * at level 10 Fighter.
 * 
 * Uses the existing level 10 Fighter character on the home page (adsfasdfasdf)
 * that has no subclass selected.
 */

import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Level 10 Fighter Champion Fighting Style', () => {
    test('should dynamically add Fighting Style choice when selecting Champion subclass', async () => {
        test.setTimeout(120000);

        console.log('\n=== Testing Dynamic Fighting Style Addition for Champion ===\n');

        // Launch app
        console.log('1. Launching app...');
        const electronApp = await electron.launch({
            args: ['.'],
            env: {
                ...process.env,
                FF_DEBUG: 'true',
                FF_ALLOW_DEFAULT_DATA: 'true',
            },
        });

        try {
            // Get main window
            let page = electronApp
                .windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent(
                    'window',
                    (win) => !win.url().startsWith('devtools://'),
                );
            }

            // Capture console messages for debugging
            const consoleLogs = [];
            page.on('console', (msg) => {
                const text = msg.text();
                consoleLogs.push({ type: msg.type(), text });
                console.log(`[${msg.type()}] ${text}`);
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForTimeout(1000);

            // Click the first character card (level 10 fighter)
            console.log('3. Selecting level 10 Fighter character...');
            const firstCard = page.locator('.character-card').first();

            // Verify it's the right character
            const cardText = await firstCard.textContent();
            console.log('   Character card text:', cardText);

            await firstCard.click();
            await page.waitForTimeout(2000);

            // Navigate to Build page
            console.log('4. Navigating to Build page...');
            await page.locator('button.nav-link[data-page="build"]').click();
            await page.waitForSelector('[data-current-page="build"]', { timeout: 15000 });
            await page.waitForTimeout(1000);

            // Open Level Up modal
            console.log('5. Opening Level Up modal...');
            const levelUpBtn = page.locator('#openLevelUpModalBtn');
            await expect(levelUpBtn).toBeEnabled({ timeout: 10000 });
            await levelUpBtn.click();
            await page.waitForSelector('#levelUpModal.show', { timeout: 15000 });
            await page.waitForTimeout(1000);

            // Navigate to step 1 (Class Features)
            console.log('6. Navigating to Class Features step (Step 1)...');
            const nextBtn = page.locator('#levelUpModal button[data-action="next"]:visible');
            await nextBtn.click();
            await page.waitForTimeout(1000);

            // Verify we're on step 1
            const stepContent = page.locator('#levelUpModal .modal-body [data-step-content]');
            await expect(stepContent).toBeVisible();

            // Look for subclass dropdown
            console.log('7. Looking for Fighter subclass dropdown...');
            const subclassSelect = page.locator('select[data-class-name="Fighter"]');
            const selectCount = await subclassSelect.count();
            console.log(`   Found ${selectCount} subclass dropdown(s)`);

            if (selectCount === 0) {
                console.error('   ERROR: No subclass dropdown found!');
                console.log('   Current step content HTML:');
                const html = await stepContent.innerHTML();
                console.log(html.substring(0, 500));

                // Look for any select elements
                const allSelects = await page.locator('select').count();
                console.log(`   Total select elements on page: ${allSelects}`);

                throw new Error('Subclass dropdown not found');
            }

            await expect(subclassSelect).toBeVisible({ timeout: 5000 });

            // Count initial feature cards
            console.log('8. Counting initial feature cards...');
            const initialFeatureCards = await page.locator('[data-feature-card]').count();
            console.log(`   Initial feature cards: ${initialFeatureCards}`);

            // Log all existing feature card IDs
            const existingCards = await page.locator('[data-feature-card]').all();
            console.log('   Existing feature card IDs:');
            for (const card of existingCards) {
                const id = await card.getAttribute('data-feature-card');
                console.log(`     - ${id}`);
            }

            // Select Champion subclass
            console.log('9. Selecting Champion subclass...');
            await subclassSelect.selectOption('Champion');
            console.log('   Champion selected, waiting for dynamic update...');

            // Wait for potential dynamic changes
            await page.waitForTimeout(2000);

            // Count feature cards after selection
            const updatedFeatureCards = await page.locator('[data-feature-card]').count();
            console.log(`10. Feature cards after selection: ${updatedFeatureCards}`);

            // Log all feature cards after selection
            const updatedCards = await page.locator('[data-feature-card]').all();
            console.log('   Updated feature card IDs:');
            for (const card of updatedCards) {
                const id = await card.getAttribute('data-feature-card');
                console.log(`     - ${id}`);
            }

            // Look for Fighting Style feature specifically
            console.log('11. Looking for Fighting Style feature card...');

            // Try multiple possible selectors
            const fightingStyleSelectors = [
                '[data-feature-card*="fighting_style"]',
                '[data-feature-card*="fighting-style"]',
                '[data-feature-type="fighting-style"]',
                'div:has-text("Fighting Style")',
                'div:has-text("Additional Fighting Style")'
            ];

            let fightingStyleFound = false;
            for (const selector of fightingStyleSelectors) {
                const count = await page.locator(selector).count();
                console.log(`   Selector "${selector}": ${count} matches`);
                if (count > 0) {
                    fightingStyleFound = true;
                    const text = await page.locator(selector).first().textContent();
                    console.log(`   Found text: ${text}`);
                }
            }

            // Check console logs for our debug messages
            console.log('\n12. Checking console logs for Step1 debug messages...');
            const step1Logs = consoleLogs.filter(log => log.text.includes('[Step1]'));
            console.log(`   Found ${step1Logs.length} [Step1] log messages:`);
            step1Logs.forEach(log => {
                console.log(`   ${log.text}`);
            });

            // Assertions
            if (fightingStyleFound) {
                console.log('\n✓ SUCCESS: Fighting Style feature was found!');
                expect(updatedFeatureCards).toBeGreaterThan(initialFeatureCards);
            } else {
                console.log('\n✗ FAILURE: Fighting Style feature was NOT found!');
                console.log('\nDebugging info:');
                console.log('Step content HTML:');
                const html = await stepContent.innerHTML();
                console.log(html);

                throw new Error('Fighting Style feature card was not dynamically added');
            }

        } finally {
            console.log('\n13. Closing app...');
            await electronApp.close();
        }
    });
});
