/**
 * Debug test to inspect spell card HTML and CSS rendering
 */

import { _electron as electron, test } from '@playwright/test';

test.describe('Spell Card Styling Debug', () => {
    test('should inspect spell card HTML and CSS', async () => {
        test.setTimeout(120000);

        console.log('\n=== Spell Card Styling Debug ===\n');

        const electronApp = await electron.launch({
            args: ['.'],
            env: {
                ...process.env,
                FF_DEBUG: 'true',
                FF_ALLOW_DEFAULT_DATA: 'true',
            },
        });

        try {
            let page = electronApp
                .windows()
                .find((win) => !win.url().startsWith('devtools://'));
            if (!page) {
                page = await electronApp.waitForEvent(
                    'window',
                    (win) => !win.url().startsWith('devtools://'),
                );
            }

            // Wait for app to load
            console.log('1. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForTimeout(2000);

            // Select first character
            console.log('2. Selecting first character...');
            const firstCard = page.locator('.character-card').first();
            const cardExists = await firstCard.isVisible({ timeout: 5000 }).catch(() => false);

            if (cardExists) {
                await firstCard.click();
                await page.waitForTimeout(2000);
            }

            // Navigate to spells page
            console.log('3. Navigating to spells page...');
            await page.locator('button.nav-link[data-page="spells"]').click();
            await page.waitForSelector('[data-current-page="spells"]', { timeout: 15000 });
            await page.waitForTimeout(2000);

            // Open spell selection modal
            console.log('4. Opening spell selection modal...');
            const addSpellBtn = page.locator('#addSpellBtn, button:has-text("Add Spell")').first();
            await addSpellBtn.click();
            await page.waitForSelector('#spellSelectionModal.show', { timeout: 15000 });
            await page.waitForTimeout(2000);

            // Enable ignore class restrictions checkbox
            console.log('4.5. Enabling ignore class restrictions...');
            const ignoreRestrictionsCheckbox = page.locator('#ignoreSpellRestrictionsToggle');
            await ignoreRestrictionsCheckbox.check();
            await page.waitForTimeout(1000);

            // Check current filter state
            console.log('4.6. Checking filter state...');
            const filterState = await page.evaluate(() => {
                const levelFilters = Array.from(document.querySelectorAll('[data-filter-type="level"]:checked'));
                const schoolFilters = Array.from(document.querySelectorAll('[data-filter-type="school"]:checked'));
                return {
                    levelFiltersActive: levelFilters.length,
                    schoolFiltersActive: schoolFilters.length,
                    hasIgnoreRestrictions: document.querySelector('#ignoreSpellRestrictionsToggle')?.checked
                };
            });
            console.log('   Filter state:', filterState);

            // Check if spell cards exist
            console.log('5. Checking spell card HTML structure...');
            const spellCards = page.locator('.spell-card');
            const cardCount = await spellCards.count();
            console.log(`   Found ${cardCount} spell cards`);

            if (cardCount > 0) {
                // Get first spell card
                const firstSpellCard = spellCards.first();

                // Check actual classes
                console.log('\n6. First spell card classes:');
                const classes = await firstSpellCard.getAttribute('class');
                console.log(`   Classes: "${classes}"`);

                // Get HTML structure
                console.log('\n7. First spell card HTML:');
                const html = await firstSpellCard.innerHTML();
                console.log(`${html.substring(0, 500)}...`);

                // Get computed styles
                console.log('\n8. First spell card computed styles:');
                const styles = await firstSpellCard.evaluate((el) => {
                    const computed = window.getComputedStyle(el);
                    return {
                        display: computed.display,
                        border: computed.border,
                        borderRadius: computed.borderRadius,
                        background: computed.background,
                        padding: computed.padding,
                        margin: computed.margin,
                        cursor: computed.cursor,
                        overflow: computed.overflow,
                    };
                });
                console.log(JSON.stringify(styles, null, 2));

                // Check spell-card-header styles
                console.log('\n8. Spell card header computed styles:');
                const header = firstSpellCard.locator('.spell-card-header').first();
                const headerExists = await header.isVisible().catch(() => false);

                if (headerExists) {
                    const headerStyles = await header.evaluate((el) => {
                        const computed = window.getComputedStyle(el);
                        return {
                            display: computed.display,
                            justifyContent: computed.justifyContent,
                            alignItems: computed.alignItems,
                            padding: computed.padding,
                            background: computed.background,
                            borderBottom: computed.borderBottom,
                        };
                    });
                    console.log(JSON.stringify(headerStyles, null, 2));
                } else {
                    console.log('   ❌ No .spell-card-header found!');
                }

                // Check spell-card-body styles
                console.log('\n9. Spell card body computed styles:');
                const body = firstSpellCard.locator('.spell-card-body').first();
                const bodyExists = await body.isVisible().catch(() => false);

                if (bodyExists) {
                    const bodyStyles = await body.evaluate((el) => {
                        const computed = window.getComputedStyle(el);
                        return {
                            padding: computed.padding,
                        };
                    });
                    console.log(JSON.stringify(bodyStyles, null, 2));
                } else {
                    console.log('   ❌ No .spell-card-body found!');
                }

                // Check if CSS file is loaded
                console.log('\n10. Checking if modals.css is loaded...');
                const cssLoaded = await page.evaluate(() => {
                    const styleSheets = Array.from(document.styleSheets);
                    const allSheets = styleSheets.map(sheet => ({
                        href: sheet.href || 'inline',
                        ruleCount: sheet.cssRules?.length || 0
                    }));

                    const modalsCss = styleSheets.find(sheet =>
                        sheet.href?.includes('modals.css')
                    );

                    const mainCss = styleSheets.find(sheet =>
                        sheet.href?.includes('main.css')
                    );

                    let spellCardRules = [];
                    if (modalsCss) {
                        try {
                            const rules = Array.from(modalsCss.cssRules || []);
                            spellCardRules = rules
                                .filter(rule => rule.selectorText?.includes('spell'))
                                .map(rule => ({
                                    selector: rule.selectorText,
                                    text: rule.cssText.substring(0, 150)
                                }));
                        } catch (_e) {
                            // Error accessing rules
                        }
                    }

                    return {
                        allSheets,
                        modalsCssLoaded: !!modalsCss,
                        mainCssLoaded: !!mainCss,
                        spellRelatedRules: spellCardRules.slice(0, 5)
                    };
                });
                console.log(JSON.stringify(cssLoaded, null, 2));

                // Check parent container
                console.log('\n11. Checking spell-list-container styles...');
                const listContainer = page.locator('.spell-list-container').first();
                const containerStyles = await listContainer.evaluate((el) => {
                    const computed = window.getComputedStyle(el);
                    return {
                        display: computed.display,
                        flexDirection: computed.flexDirection,
                        gap: computed.gap,
                        padding: computed.padding,
                    };
                });
                console.log(JSON.stringify(containerStyles, null, 2));

            } else {
                console.log('   ❌ No spell cards found in DOM!');

                // Check what's in the spell list container
                const listContainer = page.locator('.spell-list-container');
                const containerHTML = await listContainer.innerHTML().catch(() => 'Container not found');
                console.log('\n   Spell list container content:');
                console.log(containerHTML.substring(0, 500));
            }

        } finally {
            await electronApp.close();
        }
    });
});
