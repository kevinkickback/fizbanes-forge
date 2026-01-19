import { _electron as electron, test } from '@playwright/test';

test('Debug ability score split pane layout', async () => {
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
        let page = electronApp
            .windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent(
                'window',
                (win) => !win.url().startsWith('devtools://'),
            );
        }

        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        // Wait for app to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForSelector('.character-card', { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Click first available character card
        console.log('Clicking first character card...');
        const firstCard = page.locator('.character-card').first();
        await firstCard.click();
        await page.waitForTimeout(2000);

        // Navigate to Build page
        console.log('Navigating to Build page...');
        await page.locator('button.nav-link[data-page="build"]').click();
        await page.waitForSelector('[data-current-page="build"]', {
            timeout: 15000,
        });
        await page.waitForTimeout(1000);

        // Compare Race card structure (working) to Ability Score card structure
        console.log('\n=== RACE CARD (WORKING) ===');
        const raceCard = await page.locator('#build-race .card-body').first();
        const raceHTML = await raceCard.innerHTML();
        console.log('Race card HTML structure:', raceHTML.substring(0, 500));

        const raceCardClasses = await raceCard.getAttribute('class');
        console.log('Race card-body classes:', raceCardClasses);

        const raceStyles = await page.evaluate(() => {
            const card = document.querySelector('#build-race .card-body');
            const computed = window.getComputedStyle(card);
            return {
                display: computed.display,
                flexDirection: computed.flexDirection,
                gap: computed.gap,
                padding: computed.padding,
            };
        });
        console.log('Race card computed styles:', raceStyles);

        const raceChoicesPanel = await page.evaluate(() => {
            const panel = document.querySelector('#build-race .choices-panel');
            const computed = window.getComputedStyle(panel);
            return {
                flex: computed.flex,
                minWidth: computed.minWidth,
                display: computed.display,
            };
        });
        console.log('Race choices-panel computed styles:', raceChoicesPanel);

        const raceInfoPanel = await page.evaluate(() => {
            const panel = document.querySelector('#build-race .info-panel');
            const computed = window.getComputedStyle(panel);
            return {
                width: computed.width,
                minWidth: computed.minWidth,
                maxWidth: computed.maxWidth,
                position: computed.position,
            };
        });
        console.log('Race info-panel computed styles:', raceInfoPanel);

        console.log('\n=== ABILITY SCORE CARD (BROKEN) ===');
        const abilityCard = await page.locator('#build-ability-scores .card-body').first();
        const abilityHTML = await abilityCard.innerHTML();
        console.log('Ability card HTML structure:', abilityHTML.substring(0, 500));

        const abilityCardClasses = await abilityCard.getAttribute('class');
        console.log('Ability card-body classes:', abilityCardClasses);

        const abilityStyles = await page.evaluate(() => {
            const card = document.querySelector('#build-ability-scores .card-body');
            const computed = window.getComputedStyle(card);
            return {
                display: computed.display,
                flexDirection: computed.flexDirection,
                gap: computed.gap,
                padding: computed.padding,
            };
        });
        console.log('Ability card computed styles:', abilityStyles);

        const abilityChoicesPanel = await page.evaluate(() => {
            const panel = document.querySelector('#build-ability-scores .choices-panel');
            const computed = window.getComputedStyle(panel);
            return {
                flex: computed.flex,
                minWidth: computed.minWidth,
                display: computed.display,
                flexDirection: computed.flexDirection,
            };
        });
        console.log('Ability choices-panel computed styles:', abilityChoicesPanel);

        const abilityInfoPanel = await page.evaluate(() => {
            const panel = document.querySelector('#build-ability-scores .info-panel');
            const computed = window.getComputedStyle(panel);
            return {
                width: computed.width,
                minWidth: computed.minWidth,
                maxWidth: computed.maxWidth,
                position: computed.position,
                opacity: computed.opacity,
                transform: computed.transform,
            };
        });
        console.log('Ability info-panel computed styles:', abilityInfoPanel);

        // Check for CSS rules that apply to these elements
        const cssRules = await page.evaluate(() => {
            const results = {
                abilityCardRules: [],
                splitCardBodyRules: [],
                abilityMethodTabsRules: [],
            };

            // Get all stylesheets
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText?.includes('ability-score-card-body')) {
                            results.abilityCardRules.push({
                                selector: rule.selectorText,
                                display: rule.style.display,
                                flexDirection: rule.style.flexDirection,
                            });
                        }
                        if (rule.selectorText?.includes('.split-card-body')) {
                            results.splitCardBodyRules.push({
                                selector: rule.selectorText,
                                display: rule.style.display,
                                flexDirection: rule.style.flexDirection,
                            });
                        }
                        if (rule.selectorText?.includes('ability-method-tabs')) {
                            results.abilityMethodTabsRules.push({
                                selector: rule.selectorText,
                                styles: rule.cssText,
                            });
                        }
                    }
                } catch {
                    // Skip stylesheets we can't access
                }
            }
            return results;
        });
        console.log('\n=== CSS RULES ===');
        console.log('Ability card CSS rules:', JSON.stringify(cssRules.abilityCardRules, null, 2));
        console.log('Split card body rules:', JSON.stringify(cssRules.splitCardBodyRules, null, 2));
        console.log('Ability method tabs rules:', JSON.stringify(cssRules.abilityMethodTabsRules.slice(0, 3), null, 2));

        // Take a screenshot for visual debugging
        await page.screenshot({ path: 'test-results/ability-score-split-pane.png', fullPage: true });

        console.log('\n=== COMPARISON ===');
        console.log('Race card display:', raceStyles.display, 'vs Ability card display:', abilityStyles.display);
        console.log('Race card flexDirection:', raceStyles.flexDirection, 'vs Ability card flexDirection:', abilityStyles.flexDirection);

    } finally {
        await electronApp.close();
    }
});
