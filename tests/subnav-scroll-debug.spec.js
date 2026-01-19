import { _electron as electron, expect, test } from '@playwright/test';

test('debug sub-navigation scroll behavior', async () => {
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

        // Capture console logs
        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

        await page.waitForSelector('#pageContent', { timeout: 60000 });

        // Select the first available character to unlock build page navigation
        const firstCharacterCard = page.locator('.character-card').first();
        await expect(firstCharacterCard).toBeVisible();
        await firstCharacterCard.click();

        // Wait for character to load then navigate to build page
        await page.waitForTimeout(500);
        const buildNavButton = page.locator('[data-page="build"]');
        await expect(buildNavButton).toBeEnabled();
        await buildNavButton.click();
        await page.waitForSelector('#build-race', { timeout: 10000 });

        // Wait for page to fully load
        await page.waitForTimeout(1000);

        // Get initial scroll position from the correct scroll container
        const initialScroll = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            return container ? container.scrollTop : window.scrollY;
        });
        console.log('Initial scroll position:', initialScroll);

        // Check if sections exist
        const sections = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            return ['build-race', 'build-class', 'build-background', 'build-ability-scores', 'build-proficiencies'].map(id => {
                const el = document.getElementById(id);
                if (!el) return { id, exists: false };

                const card = el.querySelector('.card');
                const rect = el.getBoundingClientRect();
                const cardRect = card ? card.getBoundingClientRect() : null;
                const containerRect = container.getBoundingClientRect();

                return {
                    id,
                    exists: true,
                    hasCard: !!card,
                    sectionTop: rect.top - containerRect.top + container.scrollTop,
                    sectionHeight: rect.height,
                    cardTop: cardRect ? cardRect.top - containerRect.top + container.scrollTop : null,
                    cardHeight: cardRect ? cardRect.height : null,
                };
            });
        });

        console.log('Sections found:', JSON.stringify(sections, null, 2));

        // Click on the Class sub-nav link
        const classButton = page.locator('[data-section="build-class"]');
        await expect(classButton).toBeVisible();

        console.log('Clicking Class sub-nav link...');
        await classButton.click();

        // Wait for smooth scroll animation to complete
        await page.waitForTimeout(1500);

        // Get scroll position after click from the correct container
        const afterScroll = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            return container ? container.scrollTop : window.scrollY;
        });
        console.log('Scroll position after clicking Class:', afterScroll);

        // Check if scrollToSection was called
        const scrollDebug = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            const target = document.getElementById('build-class');
            if (!target || !container) return { error: 'Target or container not found' };

            const card = target.querySelector('.card');
            if (!card) return { error: 'Card not found' };

            const cardRect = card.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const cardHeight = cardRect.height;
            const viewportHeight = containerRect.height;
            const cardTop = cardRect.top - containerRect.top + container.scrollTop;
            const expectedScrollTo = cardTop - (viewportHeight / 2) + (cardHeight / 2);

            return {
                currentScroll: container.scrollTop,
                cardTop,
                cardHeight,
                viewportHeight,
                expectedScrollTo,
                difference: Math.abs(container.scrollTop - expectedScrollTo),
            };
        });

        console.log('Scroll calculation:', JSON.stringify(scrollDebug, null, 2));

        // Try clicking Background link
        console.log('\nClicking Background sub-nav link...');
        const backgroundButton = page.locator('[data-section="build-background"]');
        await backgroundButton.click();
        await page.waitForTimeout(1500);

        const afterBackgroundScroll = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            return container ? container.scrollTop : window.scrollY;
        });
        console.log('Scroll position after clicking Background:', afterBackgroundScroll);

        // Try clicking Ability Scores link
        console.log('\nClicking Ability Scores sub-nav link...');
        const abilityButton = page.locator('[data-section="build-ability-scores"]');
        await abilityButton.click();
        await page.waitForTimeout(1500);

        const afterAbilityScroll = await page.evaluate(() => {
            const container = document.querySelector('.main-content');
            return container ? container.scrollTop : window.scrollY;
        });
        console.log('Scroll position after clicking Ability Scores:', afterAbilityScroll);

        // Verify that scroll position changed
        expect(afterAbilityScroll).not.toBe(initialScroll);

    } finally {
        await electronApp.close();
    }
});
