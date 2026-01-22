import { _electron as electron } from '@playwright/test';
import { test } from './fixtures.js';

// Debug test for ability scores panel overflow issue
// Run with: npx playwright test debug-ability-scores-overflow.spec.js --headed --debug

test('Debug Ability Scores Panel Overflow', async () => {
    test.setTimeout(120000);

    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });

    // Get main renderer window (exclude DevTools)
    let page = electronApp.windows().find((win) => !win.url().startsWith('devtools://'));
    if (!page) {
        page = await electronApp.waitForEvent('window', (win) => !win.url().startsWith('devtools://'));
    }

    // Set up console capturing
    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        console.log(`[CONSOLE ${type}] ${msg.text()}`);
    });

    // Wait for app to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#pageContent', { timeout: 60000 });

    console.log('\n=== APP LOADED ===\n');

    // Wait for character list to load
    await page.waitForSelector('.character-card', { timeout: 10000 });

    // Find and click "Test Char"
    const testChar = page.locator('.character-card', { hasText: 'Test Char' });
    const charExists = await testChar.count() > 0;

    if (!charExists) {
        console.log('❌ "Test Char" not found in character list');
        await electronApp.close();
        return;
    }

    console.log('✅ Found "Test Char", clicking to select...');
    await testChar.click();

    // Wait for character to load and navigate to build page
    await page.waitForTimeout(1000);

    // Click on Build tab
    const buildNav = page.locator('[data-page="build"]');
    await buildNav.click();

    // Wait for build page to load
    await page.waitForSelector('#build-race', { timeout: 10000 });
    console.log('✅ Build page loaded');

    // Navigate to Ability Scores section by scrolling to it
    const abilityScoresSection = page.locator('#build-ability-scores');
    await abilityScoresSection.scrollIntoViewIfNeeded();

    // Wait for ability scores section to be visible
    await page.waitForSelector('.ability-score-card-body', { timeout: 5000 });
    console.log('✅ Ability Scores section visible');

    // Resize the Electron window to a smaller height to trigger potential overflow
    const electronWindow = await electronApp.firstWindow();
    await electronWindow.evaluate(() => {
        window.resizeTo(1200, 700);
    });
    console.log('✅ Resized window to 1200x700 to test overflow');

    // Give time for the UI to re-render and scroll the ability scores section into view
    await page.waitForTimeout(500);
    await abilityScoresSection.scrollIntoViewIfNeeded();

    // Debug: Get computed styles of key elements
    const debugInfo = await page.evaluate(() => {
        const results = {};

        // Get the ability score card body
        const cardBody = document.querySelector('.ability-score-card-body');
        if (cardBody) {
            const cardStyles = window.getComputedStyle(cardBody);
            const rect = cardBody.getBoundingClientRect();
            results.cardBody = {
                height: cardStyles.height,
                maxHeight: cardStyles.maxHeight,
                overflow: cardStyles.overflow,
                overflowY: cardStyles.overflowY,
                display: cardStyles.display,
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height }
            };
        }

        // Get the choices panel
        const choicesPanel = document.querySelector('.ability-score-card-body .choices-panel');
        if (choicesPanel) {
            const choicesStyles = window.getComputedStyle(choicesPanel);
            const rect = choicesPanel.getBoundingClientRect();
            results.choicesPanel = {
                height: choicesStyles.height,
                maxHeight: choicesStyles.maxHeight,
                overflow: choicesStyles.overflow,
                overflowY: choicesStyles.overflowY,
                display: choicesStyles.display,
                flexDirection: choicesStyles.flexDirection,
                scrollHeight: choicesPanel.scrollHeight,
                clientHeight: choicesPanel.clientHeight,
                offsetHeight: choicesPanel.offsetHeight,
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height }
            };
        }

        // Get the ability score container (scrollable area)
        const abilityScoreContainer = document.querySelector('.ability-score-card-body .ability-score-container');
        if (abilityScoreContainer) {
            const containerStyles = window.getComputedStyle(abilityScoreContainer);
            const rect = abilityScoreContainer.getBoundingClientRect();
            results.abilityScoreContainer = {
                height: containerStyles.height,
                overflow: containerStyles.overflow,
                overflowY: containerStyles.overflowY,
                scrollHeight: abilityScoreContainer.scrollHeight,
                clientHeight: abilityScoreContainer.clientHeight,
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height }
            };
        }

        // Get the ability bonuses container
        const bonusesContainer = document.querySelector('#abilityBonusesNotes');
        if (bonusesContainer) {
            const bonusStyles = window.getComputedStyle(bonusesContainer);
            const rect = bonusesContainer.getBoundingClientRect();
            results.bonusesContainer = {
                display: bonusStyles.display,
                visibility: bonusStyles.visibility,
                position: bonusStyles.position,
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height },
                innerHTML: bonusesContainer.innerHTML.substring(0, 500),
            };
        }

        // Get the ability score grid
        const abilityGrid = document.querySelector('.ability-score-grid');
        if (abilityGrid) {
            const rect = abilityGrid.getBoundingClientRect();
            results.abilityGrid = {
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height },
            };
        }

        // Get the ability choices container (dropdown choices for race bonuses)
        const abilityChoices = document.querySelector('.ability-choices-container');
        if (abilityChoices) {
            const rect = abilityChoices.getBoundingClientRect();
            results.abilityChoices = {
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height },
                innerHTML: abilityChoices.innerHTML.substring(0, 500),
            };
        }

        // Get the method tabs
        const methodTabs = document.querySelector('.ability-method-tabs');
        if (methodTabs) {
            const rect = methodTabs.getBoundingClientRect();
            results.methodTabs = {
                boundingRect: { top: rect.top, bottom: rect.bottom, height: rect.height },
            };
        }

        // Calculate total content height needed
        if (results.methodTabs && results.abilityGrid && results.bonusesContainer) {
            results.totalContentHeight =
                (results.methodTabs.boundingRect.height || 0) +
                (results.abilityGrid.boundingRect.height || 0) +
                (results.bonusesContainer.boundingRect.height || 0) +
                32; // gaps
        }

        // Get window/viewport info
        results.viewport = {
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
        };

        return results;
    });

    console.log('\n=== DEBUG INFO ===\n');
    console.log('Card Body:', JSON.stringify(debugInfo.cardBody, null, 2));
    console.log('\nChoices Panel:', JSON.stringify(debugInfo.choicesPanel, null, 2));
    console.log('\nAbility Score Container (scrollable):', JSON.stringify(debugInfo.abilityScoreContainer, null, 2));
    console.log('\nMethod Tabs:', JSON.stringify(debugInfo.methodTabs, null, 2));
    console.log('\nAbility Grid:', JSON.stringify(debugInfo.abilityGrid, null, 2));
    console.log('\nAbility Choices (dropdowns):', JSON.stringify(debugInfo.abilityChoices, null, 2));
    console.log('\nBonuses Container:', JSON.stringify(debugInfo.bonusesContainer, null, 2));
    console.log('\nTotal Content Height Needed:', debugInfo.totalContentHeight);
    console.log('\nViewport:', JSON.stringify(debugInfo.viewport, null, 2));

    // Check if scrolling is possible on ability-score-container
    if (debugInfo.abilityScoreContainer) {
        const canScroll = debugInfo.abilityScoreContainer.scrollHeight > debugInfo.abilityScoreContainer.clientHeight;
        console.log(`\nCan scroll ability-score-container: ${canScroll}`);
        console.log(`  scrollHeight: ${debugInfo.abilityScoreContainer.scrollHeight}`);
        console.log(`  clientHeight: ${debugInfo.abilityScoreContainer.clientHeight}`);
        console.log(`  overflowY: ${debugInfo.abilityScoreContainer.overflowY}`);
    }
    const choicesBottom = debugInfo.abilityChoices.boundingRect.bottom;
    const panelBottom = debugInfo.choicesPanel.boundingRect.bottom;
    console.log(`\nAbility Choices bottom: ${choicesBottom}, Panel bottom: ${panelBottom}`);
    if (choicesBottom > panelBottom) {
        console.log(`❌ OVERFLOW: Ability choice dropdowns extend ${choicesBottom - panelBottom}px below the panel`);
    } else {
        console.log('✅ Ability choice dropdowns are within panel bounds');
    }
} else if (!debugInfo.abilityChoices) {
    console.log('\n⚠️ No ability choice dropdowns present (character race may not have choices)');
}

if (debugInfo.bonusesContainer && debugInfo.choicesPanel) {
    const bonusBottom = debugInfo.bonusesContainer.boundingRect.bottom;
    const panelBottom = debugInfo.choicesPanel.boundingRect.bottom;
    console.log(`\nBonuses bottom: ${bonusBottom}, Panel bottom: ${panelBottom}`);
    if (bonusBottom > panelBottom) {
        console.log(`❌ OVERFLOW: Bonuses container extends ${bonusBottom - panelBottom}px below the panel`);
    } else {
        console.log('✅ Bonuses container is within panel bounds');
    }
}
    }

// Take a screenshot for visual inspection
await page.screenshot({ path: 'test-results/ability-scores-overflow.png', fullPage: false });
console.log('\n✅ Screenshot saved to test-results/ability-scores-overflow.png');

// Pause for manual inspection - resize the window to see the overflow issue
console.log('\n=== PAUSING FOR MANUAL INSPECTION ===');
console.log('Try resizing the Electron window to a smaller height to see the overflow issue');
console.log('Press Play in Playwright Inspector to close');
await page.pause();

await electronApp.close();
});
