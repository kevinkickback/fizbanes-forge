import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Race Card Layout Debug Test
 * Inspects the race card layout on build page to debug sizing issues
 */

test.describe('Race Card Layout Debug', () => {
    test('should select first character and inspect race card layout', async () => {
        test.setTimeout(120000);

        console.log('\n=== Testing Race Card Layout ===\n');

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

            // Capture console output
            page.on('console', (msg) => {
                const text = msg.text();
                console.log(`[${msg.type()}] ${text}`);
            });

            // Wait for app to load
            console.log('2. Waiting for app to load...');
            await page.waitForLoadState('domcontentloaded');
            await page.waitForSelector('#pageContent', { timeout: 60000 });
            await page.waitForSelector('[data-current-page="home"]', {
                timeout: 30000,
            });
            await page.waitForTimeout(2000);

            // Click first character card
            console.log('3. Looking for first character card...');
            const firstCard = page.locator('.character-card').first();
            await expect(firstCard).toBeVisible({ timeout: 10000 });
            console.log('   First character card found, clicking...');
            await firstCard.click();
            await page.waitForTimeout(1000);

            // Navigate to build page
            console.log('4. Navigating to build page...');
            const buildNavBtn = page.locator('button[data-page="build"]');
            await expect(buildNavBtn).toBeVisible({ timeout: 10000 });
            await buildNavBtn.click();
            await page.waitForTimeout(1000);

            // Wait for build page to load
            await page.waitForSelector('#build-race', { timeout: 15000 });
            console.log('   Build page loaded');
            await page.waitForTimeout(2000);

            // Inspect race card layout
            console.log('5. Inspecting race card layout...');

            const raceCard = page.locator('#build-race .card');
            const raceCardBody = page.locator('#build-race .card-body');
            const splitCardBody = page.locator('#build-race .split-card-body');
            const choicesPanel = page.locator('#build-race .choices-panel');
            const raceList = page.locator('#build-race .race-list');
            const infoPanel = page.locator('#build-race .info-panel');

            // Get dimensions
            const raceCardBox = await raceCard.boundingBox();
            const raceCardBodyBox = await raceCardBody.boundingBox();
            const splitCardBodyBox = await splitCardBody.boundingBox();
            const choicesPanelBox = await choicesPanel.boundingBox();
            const raceListBox = await raceList.boundingBox();
            const infoPanelBox = await infoPanel.boundingBox();

            console.log('\n=== Race Card Dimensions ===');
            console.log('Race Card:', raceCardBox);
            console.log('Race Card Body:', raceCardBodyBox);
            console.log('Split Card Body:', splitCardBodyBox);
            console.log('Choices Panel:', choicesPanelBox);
            console.log('Race List:', raceListBox);
            console.log('Info Panel:', infoPanelBox);

            // Get computed styles
            console.log('\n=== Computed Styles ===');

            const cardStyles = await raceCard.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    display: styles.display,
                    flexDirection: styles.flexDirection,
                    minHeight: styles.minHeight,
                    height: styles.height,
                };
            });
            console.log('Card:', cardStyles);

            const cardBodyStyles = await raceCardBody.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    display: styles.display,
                    flexDirection: styles.flexDirection,
                    flex: styles.flex,
                    minHeight: styles.minHeight,
                    height: styles.height,
                    overflow: styles.overflow,
                };
            });
            console.log('Card Body:', cardBodyStyles);

            const splitCardBodyStyles = await splitCardBody.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    display: styles.display,
                    flexDirection: styles.flexDirection,
                    flex: styles.flex,
                    minHeight: styles.minHeight,
                    height: styles.height,
                };
            });
            console.log('Split Card Body:', splitCardBodyStyles);

            const choicesPanelStyles = await choicesPanel.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    display: styles.display,
                    flexDirection: styles.flexDirection,
                    flex: styles.flex,
                    minHeight: styles.minHeight,
                    height: styles.height,
                    overflow: styles.overflow,
                };
            });
            console.log('Choices Panel:', choicesPanelStyles);

            const raceListStyles = await raceList.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    display: styles.display,
                    flexDirection: styles.flexDirection,
                    flex: styles.flex,
                    minHeight: styles.minHeight,
                    maxHeight: styles.maxHeight,
                    height: styles.height,
                    overflow: styles.overflow,
                    overflowY: styles.overflowY,
                };
            });
            console.log('Race List:', raceListStyles);

            const infoPanelStyles = await infoPanel.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    width: styles.width,
                    minWidth: styles.minWidth,
                    maxHeight: styles.maxHeight,
                    height: styles.height,
                    overflow: styles.overflow,
                    overflowY: styles.overflowY,
                };
            });
            console.log('Info Panel:', infoPanelStyles);

            // Count race items and check if scrollable
            const raceItems = await raceList.locator('.race-item').count();
            console.log('\n=== Content ===');
            console.log('Race items count:', raceItems);

            // Check scroll state
            const scrollInfo = await raceList.evaluate((el) => {
                return {
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    isScrollable: el.scrollHeight > el.clientHeight,
                    scrollTop: el.scrollTop,
                };
            });
            console.log('Race List Scroll Info:', scrollInfo);

            // Verify expectations
            console.log('\n=== Verification ===');
            expect(raceCardBox.height).toBeGreaterThan(500);
            console.log('✓ Race card is tall enough');

            expect(choicesPanelStyles.flex).toBe('1 1 0%');
            console.log('✓ Choices panel has flex: 1');

            expect(raceListStyles.flex).toBe('1 1 0%');
            console.log('✓ Race list has flex: 1');

            if (scrollInfo.isScrollable) {
                console.log('✓ Race list is scrollable (as expected with many items)');
            } else {
                console.log('⚠ Race list is NOT scrollable - may indicate layout issue');
            }

            console.log('\n=== Test Complete ===\n');

        } finally {
            await electronApp.close();
        }
    });
});
