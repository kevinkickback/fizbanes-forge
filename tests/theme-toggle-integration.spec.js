import { _electron as electron, expect, test } from '@playwright/test';

test.describe('Theme Toggle Integration', () => {
    test('theme toggle button exists in sidebar footer', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(2000);

            // Check that the theme toggle button exists in sidebar
            const sidebarThemeButton = await page.locator('#themeToggle');
            await expect(sidebarThemeButton).toBeVisible();

            // Should have an icon
            const icon = sidebarThemeButton.locator('i');
            await expect(icon).toBeVisible();

            console.log('✓ Theme toggle button found in sidebar footer');
        } finally {
            await electronApp.close();
        }
    });

    test('theme toggle button exists in settings page', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(3000);

            // Navigate to settings
            const settingsBtn = page.locator('[data-page="settings"]');
            await expect(settingsBtn).toBeVisible({ timeout: 10000 });
            await settingsBtn.click();
            await page.waitForTimeout(1000);

            // Check that the theme toggle button exists in settings
            const settingsThemeButton = await page.locator('#appearanceThemeToggle');
            await expect(settingsThemeButton).toBeVisible();

            // Should have text content
            const buttonText = await settingsThemeButton.textContent();
            expect(buttonText).toMatch(/Light|Dark/);

            console.log('✓ Theme toggle button found in settings page');
        } finally {
            await electronApp.close();
        }
    });

    test('clicking sidebar theme toggle switches theme', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(2000);

            // Get initial theme
            const initialTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            // Click the sidebar theme toggle
            await page.click('#themeToggle');
            await page.waitForTimeout(500);

            // Check that theme changed
            const newTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            expect(newTheme).not.toBe(initialTheme);
            console.log(`✓ Theme switched from ${initialTheme} to ${newTheme}`);
        } finally {
            await electronApp.close();
        }
    });

    test('clicking settings theme toggle switches theme', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(3000);

            // Navigate to settings
            const settingsBtn = page.locator('[data-page="settings"]');
            await expect(settingsBtn).toBeVisible({ timeout: 10000 });
            await settingsBtn.click();
            await page.waitForTimeout(1000);

            // Get initial theme
            const initialTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            // Click the settings theme toggle
            const settingsToggle = page.locator('#appearanceThemeToggle');
            await expect(settingsToggle).toBeVisible({ timeout: 10000 });
            await settingsToggle.click();
            await page.waitForTimeout(1000);

            // Check that theme changed
            const newTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            console.log(`✓ Settings: Theme switched from ${initialTheme} to ${newTheme}`);
            expect(newTheme).not.toBe(initialTheme);
        } finally {
            await electronApp.close();
        }
    });

    test('theme preference persists in localStorage', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(2000);

            // Get initial theme
            const initialTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            // Toggle theme
            await page.click('#themeToggle');
            await page.waitForTimeout(500);

            // Check localStorage
            const savedTheme = await page.evaluate(() =>
                localStorage.getItem('theme')
            );

            const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark';
            expect(savedTheme).toBe(expectedTheme);
            console.log(`✓ Theme preference saved to localStorage: ${savedTheme}`);
        } finally {
            await electronApp.close();
        }
    });

    test('theme icon updates when theme changes', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(2000);

            // Get initial icon class
            const initialIcon = await page.evaluate(() => {
                const icon = document.querySelector('#themeToggle i');
                return icon?.className || '';
            });

            // Click theme toggle
            await page.click('#themeToggle');
            await page.waitForTimeout(500);

            // Check that icon changed
            const newIcon = await page.evaluate(() => {
                const icon = document.querySelector('#themeToggle i');
                return icon?.className || '';
            });

            expect(newIcon).not.toBe(initialIcon);
            console.log(`✓ Theme icon updated from ${initialIcon} to ${newIcon}`);
        } finally {
            await electronApp.close();
        }
    });

    test('settings page theme button text updates when theme changes', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(3000);

            // Navigate to settings
            const settingsBtn = page.locator('[data-page="settings"]');
            await expect(settingsBtn).toBeVisible({ timeout: 10000 });
            await settingsBtn.click();
            await page.waitForTimeout(1000);

            // Get initial button text
            const initialText = await page.locator('#appearanceThemeToggle').textContent();
            console.log(`Initial button text: "${initialText}"`);

            // Click theme toggle
            const themeToggle = page.locator('#appearanceThemeToggle');
            await expect(themeToggle).toBeVisible({ timeout: 10000 });
            await themeToggle.click();
            await page.waitForTimeout(1000);

            // Check that button text updated
            const newText = await page.locator('#appearanceThemeToggle').textContent();
            console.log(`New button text: "${newText}"`);
            console.log(`✓ Settings button text updated from "${initialText.trim()}" to "${newText.trim()}"`);

            expect(newText?.trim()).not.toBe(initialText?.trim());
        } finally {
            await electronApp.close();
        }
    });

    test('both toggles switch theme synchronously', async () => {
        test.setTimeout(60000);

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
            await page.waitForTimeout(2000);

            // Get initial theme
            const initialTheme = await page.evaluate(() =>
                document.documentElement.getAttribute('data-theme')
            );

            // Click sidebar toggle
            await page.click('#themeToggle');
            await page.waitForTimeout(500);

            // Navigate to settings
            await page.click('[data-page="settings"]');
            await page.waitForTimeout(500);

            // Verify settings button shows correct theme
            const settingsButtonText = await page.locator('#appearanceThemeToggle').textContent();
            const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark';
            expect(settingsButtonText).toContain(expectedTheme === 'dark' ? 'Dark' : 'Light');

            console.log(`✓ Both toggles synchronized at theme: ${expectedTheme}`);
        } finally {
            await electronApp.close();
        }
    });
});
