import { _electron as electron, test } from '@playwright/test';

test('Race card layout in fullscreen/maximized window', async () => {
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

        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        console.log('\n=== Testing Race Card Layout (MAXIMIZED) ===\n');

        console.log('1. Waiting for app to load...');
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        await page.waitForTimeout(2000);

        // Maximize the window
        console.log('2. Maximizing window...');
        await electronApp.evaluate(({ BrowserWindow }) => {
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                windows[0].maximize();
            }
        });
        await page.waitForTimeout(500);

        console.log('3. Loading first character...');
        const firstCard = await page.locator('.character-card').first();
        await firstCard.waitFor({ state: 'visible', timeout: 10000 });
        await firstCard.click();
        await page.waitForTimeout(1000);

        console.log('4. Navigating to build page...');
        await page.waitForSelector('button[data-page="build"]', { timeout: 10000 });
        await page.click('button[data-page="build"]');
        await page.waitForSelector('#build-race', { timeout: 10000 });
        await page.waitForTimeout(1000);

        console.log('5. Inspecting race card layout...\n');

        // Get dimensions
        const raceCard = await page.locator('#build-race .card').boundingBox();
        const raceCardBody = await page.locator('#build-race .card-body').boundingBox();
        const splitCardBody = await page.locator('#build-race .split-card-body').boundingBox();
        const choicesPanel = await page.locator('#raceChoicesPanel').boundingBox();
        const raceList = await page.locator('#raceList').boundingBox();
        const infoPanel = await page.locator('#raceInfoPanel').boundingBox();

        console.log('=== Race Card Dimensions (MAXIMIZED) ===');
        console.log('Race Card:', raceCard);
        console.log('Race Card Body:', raceCardBody);
        console.log('Split Card Body:', splitCardBody);
        console.log('Choices Panel:', choicesPanel);
        console.log('Race List:', raceList);
        console.log('Info Panel:', infoPanel);

        // Get computed styles
        const cardStyles = await page.locator('#build-race .card').evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
                display: styles.display,
                flexDirection: styles.flexDirection,
                minHeight: styles.minHeight,
                height: styles.height,
            };
        });

        const raceListStyles = await page.locator('#raceList').evaluate((el) => {
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

        console.log('\n=== Computed Styles ===');
        console.log('Card:', cardStyles);
        console.log('Race List:', raceListStyles);

        // Check scroll info
        const scrollInfo = await page.locator('#raceList').evaluate((el) => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            offsetHeight: el.offsetHeight,
            isScrollable: el.scrollHeight > el.clientHeight,
            scrollTop: el.scrollTop,
        }));

        console.log('\n=== Scroll Info ===');
        console.log('Race List:', scrollInfo);

        // Count items
        const itemCount = await page.locator('#raceList .race-item').count();
        console.log('\n=== Content ===');
        console.log('Race items count:', itemCount);

        // Get viewport size
        const viewportSize = await page.viewportSize();
        console.log('\n=== Window Info ===');
        console.log('Viewport:', viewportSize);

        // Verify the list fills the space
        const heightDiff = raceCard.height - raceList.height;
        console.log('\n=== Verification ===');
        console.log(`Card height: ${raceCard.height}px`);
        console.log(`Race list height: ${raceList.height}px`);
        console.log(`Height difference: ${heightDiff}px`);

        if (heightDiff > 200) {
            console.log('⚠ WARNING: Race list is NOT filling available space');
            console.log('   Race list should be taller to fill the card');
        } else {
            console.log('✓ Race list is filling available space correctly');
        }

        console.log('\n=== Test Complete ===\n');

        // Keep window open for visual inspection
        await page.waitForTimeout(5000);

    } finally {
        await electronApp.close();
    }
});
