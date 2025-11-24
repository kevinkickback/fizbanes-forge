/**
 * Test to investigate two issues:
 * 1. Floating action bar appearing on home page after character selection
 * 2. Unsaved changes indicator showing on navigation to build page without making changes
 */

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

/**
 * Helper function to get detailed floating bar state
 */
async function getFloatingBarState(page, pageName = 'unknown') {
    return await page.evaluate((pageName) => {
        const floatingBar = document.querySelector('.floating-actions');
        if (!floatingBar) {
            return {
                element: 'not-found',
                page: pageName,
                visible: false
            };
        }

        const styles = window.getComputedStyle(floatingBar);
        return {
            element: 'found',
            page: pageName,
            visible: styles.display !== 'none',
            computedDisplay: styles.display,
            inlineDisplay: floatingBar.style.display,
            className: floatingBar.className,
            dataCurrentPage: document.body.getAttribute('data-current-page'),
            visibility: styles.visibility,
            zIndex: styles.zIndex
        };
    }, pageName);
}

test.describe('Navigation & Unsaved Changes Issues', () => {
    let electronApp;
    let page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: [path.resolve(__dirname, '../../../app/main.js')]
        });

        await electronApp.context().waitForEvent('page');
        await electronApp.context().waitForEvent('page');

        const windows = electronApp.windows();
        page = windows.find(w => !w.url().includes('devtools'));

        if (!page) {
            throw new Error('Could not find main app window!');
        }

        await page.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test.beforeEach(async () => {
        // Add console log listener to see all logs
        page.on('console', msg => {
            console.log(`[${msg.type()}] ${msg.text()}`);
        });

        // Wait for app to be on home page
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'home',
            { timeout: 5000 }
        ).catch(() => {
            // App might already be initialized
        });

        console.log('✓ App ready on home page');
    });

    test('Issue 1: Floating bar should not appear on home page after character selection', async () => {
        // Check initial state
        let dataCurrentPage = await page.evaluate(() => document.body.getAttribute('data-current-page'));
        console.log(`Initial data-current-page: ${dataCurrentPage}`);

        let floatingBarState = await getFloatingBarState(page, 'home-initial');
        console.log('Initial floating bar state:', JSON.stringify(floatingBarState, null, 2));
        expect(floatingBarState.visible).toBe(false);

        // Find and click first character card
        console.log('Looking for character cards...');
        const characterCards = await page.locator('[data-character-id]').count();
        console.log(`Found ${characterCards} character cards`);

        if (characterCards > 0) {
            console.log('Clicking first character card...');
            await page.locator('[data-character-id]').first().click();

            // Wait a bit for character to load
            await page.waitForTimeout(1000);

            // Check state after selection
            dataCurrentPage = await page.evaluate(() => document.body.getAttribute('data-current-page'));
            console.log(`data-current-page after character selection: ${dataCurrentPage}`);

            // Check if floating bar is visible on home page with detailed info
            floatingBarState = await getFloatingBarState(page, 'home-after-select');
            console.log('Floating bar state after character selection:', JSON.stringify(floatingBarState, null, 2));

            // The floating bar should NOT be visible on the home page
            expect(floatingBarState.visible).toBe(false, 'Floating bar should not appear on home page after selection');

            // data-current-page should still be 'home'
            expect(dataCurrentPage).toBe('home', 'Should still be on home page');
        }
    });

    test('Issue 1B: Verify floating bar shows ONLY on build, equipment, details pages', async () => {
        const pages = ['home', 'build', 'equipment', 'details', 'preview', 'settings'];

        for (const testPage of pages) {
            // Navigate to the page using navigation buttons
            const navButton = await page.locator(`[data-page="${testPage}"]`).first();

            // Skip if button doesn't exist (some pages might not be available)
            const exists = await navButton.count() > 0;
            if (!exists) {
                console.log(`Skipping page ${testPage} - navigation button not found`);
                continue;
            }

            await navButton.click();
            await page.waitForTimeout(500);

            // Verify data-current-page is set
            const currentPage = await page.evaluate(() => document.body.getAttribute('data-current-page'));
            console.log(`\nNavigated to page: ${currentPage}`);

            // Get floating bar state
            const floatingBarState = await getFloatingBarState(page, currentPage);
            console.log(`Floating bar state for ${testPage}:`, JSON.stringify(floatingBarState, null, 2));

            // Determine expected visibility
            const shouldBeVisible = ['build', 'equipment', 'details'].includes(testPage);

            if (shouldBeVisible) {
                expect(floatingBarState.visible).toBe(true, `Floating bar SHOULD be visible on ${testPage} page`);
            } else {
                expect(floatingBarState.visible).toBe(false, `Floating bar should NOT be visible on ${testPage} page`);
            }
        }
    });

    test('Issue 2: Unsaved changes indicator should not show on navigation without changes', async () => {
        // Select a character first
        console.log('Selecting first character...');
        const characterCards = await page.locator('[data-character-id]').count();

        if (characterCards > 0) {
            await page.locator('[data-character-id]').first().click();
            await page.waitForTimeout(1000);

            // Check initial unsaved indicator state on home page
            let unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
            console.log(`Unsaved indicator visible on home page: ${unsavedIndicator}`);
            expect(unsavedIndicator).toBe(false);

            // Navigate to build page
            console.log('Navigating to build page...');
            await page.click('[data-page="build"]');

            // Wait for navigation
            await page.waitForFunction(
                () => document.body.getAttribute('data-current-page') === 'build',
                { timeout: 5000 }
            );

            const dataCurrentPage = await page.evaluate(() => document.body.getAttribute('data-current-page'));
            console.log(`Navigated to: ${dataCurrentPage}`);

            // Wait a bit for page to fully load
            await page.waitForTimeout(500);

            // Check unsaved indicator on build page - should NOT be visible without changes
            unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
            console.log(`Unsaved indicator visible on build page (after navigation, no changes): ${unsavedIndicator}`);

            // Check the display style directly
            const indicatorDisplay = await page.evaluate(() => {
                const elem = document.getElementById('unsavedChangesIndicator');
                if (!elem) return 'element-not-found';
                const display = window.getComputedStyle(elem).display;
                const inlineDisplay = elem.style.display;
                return `computed: ${display}, inline: ${inlineDisplay}`;
            });
            console.log(`Unsaved indicator display style: ${indicatorDisplay}`);

            expect(unsavedIndicator).toBe(false, 'Unsaved indicator should not appear without making changes');

            // Now make an actual change and verify indicator shows
            console.log('Making a change to trigger unsaved indicator...');
            const raceCards = await page.locator('[data-race]').count();
            console.log(`Found ${raceCards} race options`);

            if (raceCards > 0) {
                await page.locator('[data-race]').first().click();
                await page.waitForTimeout(500);

                unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
                console.log(`Unsaved indicator visible after making change: ${unsavedIndicator}`);
                expect(unsavedIndicator).toBe(true, 'Unsaved indicator should show after making changes');
            }
        }
    });

    test('Issue 1 & 2: Verify data-current-page attribute controls floating bar visibility', async () => {
        // Log CSS rule
        console.log('Checking CSS rules for floating-actions...');
        const cssRules = await page.evaluate(() => {
            const styleSheets = Array.from(document.styleSheets);
            const rules = [];

            for (const sheet of styleSheets) {
                try {
                    const sheetRules = Array.from(sheet.cssRules || []);
                    for (const rule of sheetRules) {
                        if (rule.selectorText && rule.selectorText.includes('floating-actions')) {
                            rules.push(`${rule.selectorText}: ${rule.style.cssText}`);
                        }
                    }
                } catch (e) {
                    // Skip sheets we can't access
                }
            }
            return rules;
        });
        console.log(`CSS rules for floating-actions: ${JSON.stringify(cssRules, null, 2)}`);

        // Test different page values
        const pages = ['home', 'build', 'equipment', 'details', 'preview', 'settings'];

        for (const testPage of pages) {
            // Set data-current-page
            await page.evaluate((page) => {
                document.body.setAttribute('data-current-page', page);
            }, testPage);

            // Check if floating bar is visible
            const floatingBarState = await getFloatingBarState(page, testPage);

            // Floating bar should only be visible on build, equipment, and details pages
            const shouldBeVisible = ['build', 'equipment', 'details'].includes(testPage);

            console.log(`Page: ${testPage}, Floating bar visible: ${floatingBarState.visible}, Expected: ${shouldBeVisible}`);
            console.log(`  Details: ${JSON.stringify(floatingBarState, null, 2)}`);

            if (shouldBeVisible) {
                expect(floatingBarState.visible).toBe(true, `Floating bar should be visible on ${testPage} page`);
            } else {
                expect(floatingBarState.visible).toBe(false, `Floating bar should NOT be visible on ${testPage} page`);
            }
        }
    });

    test('Details page: Unsaved changes indicator shows when editing form fields', async () => {
        // Create or select a character
        const characterCards = await page.locator('[data-character-id]').count();

        if (characterCards > 0) {
            // Select first character
            await page.locator('[data-character-id]').first().click();
            await page.waitForTimeout(500);

            // Navigate to details page
            console.log('Navigating to details page...');
            await page.click('[data-page="details"]');

            // Wait for details page to load
            await page.waitForFunction(
                () => document.body.getAttribute('data-current-page') === 'details',
                { timeout: 5000 }
            );

            console.log('✓ Navigated to details page');
            await page.waitForTimeout(500);

            // Check initial unsaved indicator state (should be hidden)
            let unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
            console.log(`Initial unsaved indicator visible: ${unsavedIndicator}`);
            expect(unsavedIndicator).toBe(false, 'Unsaved indicator should be hidden on fresh page load');

            // Test editing character name field
            console.log('Testing character name field change...');
            const characterNameInput = await page.locator('#characterName');
            if (await characterNameInput.isVisible()) {
                // Get current value
                const currentValue = await characterNameInput.inputValue();
                console.log(`Current character name: "${currentValue}"`);

                // Clear and type new value
                await characterNameInput.clear();
                await characterNameInput.type('Updated Name');
                await page.waitForTimeout(300); // Wait for input event

                // Check if unsaved indicator appears
                unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
                console.log(`Unsaved indicator after character name change: ${unsavedIndicator}`);
                expect(unsavedIndicator).toBe(true, 'Unsaved indicator should appear after editing character name');

                // Restore original value
                await characterNameInput.clear();
                await characterNameInput.type(currentValue || 'Character');
            }

            // Test editing backstory field
            console.log('Testing backstory field change...');
            const backstoryTextarea = await page.locator('#backstory');
            if (await backstoryTextarea.isVisible()) {
                // Clear unsaved indicator by reloading page or doing action that hides it
                // For now just test the change
                const currentBackstory = await backstoryTextarea.textContent();
                console.log(`Current backstory length: ${currentBackstory?.length || 0}`);

                // Edit backstory
                await backstoryTextarea.clear();
                await backstoryTextarea.type('Test backstory update');
                await page.waitForTimeout(300);

                // Check if unsaved indicator appears
                unsavedIndicator = await page.locator('#unsavedChangesIndicator').isVisible();
                console.log(`Unsaved indicator after backstory change: ${unsavedIndicator}`);
                expect(unsavedIndicator).toBe(true, 'Unsaved indicator should appear after editing backstory');

                // Restore original value
                await backstoryTextarea.clear();
                await backstoryTextarea.type(currentBackstory || '');
            }

            console.log('✓ Details page form field changes trigger unsaved changes indicator');
        }
    });
});
