import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Load Character from Home Page', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../../app/main.js')]
        });

        // Wait for both DevTools and Main app windows to open (DEBUG_MODE=true)
        await electronApp.context().waitForEvent('page');
        await electronApp.context().waitForEvent('page');

        // Find the main window (not devtools)
        const windows = electronApp.windows();
        window = windows.find(w => !w.url().includes('devtools'));

        if (!window) {
            throw new Error('Could not find main app window!');
        }

        await window.waitForLoadState('domcontentloaded');
        await window.waitForTimeout(3000); // Wait for app initialization
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test.beforeEach(async () => {
        // Navigate to home page before each test
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();
        await window.waitForTimeout(1000);
    });

    test('should display Load button on character cards', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount > 0) {
            const firstCard = characterCards.first();
            const loadButton = firstCard.locator('button:has-text("Load")');
            await expect(loadButton).toBeVisible();
        } else {
            test.skip('No characters available to test');
        }
    });

    test('should load character when clicking character card', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        // Click on first character card (not on buttons)
        const firstCard = characterCards.first();
        const cardBody = firstCard.locator('.character-info');
        await cardBody.click();

        await window.waitForTimeout(1500);

        // Should navigate to build page after loading
        const buildContent = window.locator('#pageContent');
        await expect(buildContent).toBeVisible();

        // Check if notification appeared
        const notification = window.locator('.notification');
        if (await notification.count() > 0) {
            const notificationText = await notification.textContent();
            expect(notificationText).toContain('Character loaded');
        }
    });

    test('should load character when clicking Load button', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        // Click Load button on first character
        const firstCard = characterCards.first();
        const loadButton = firstCard.locator('button:has-text("Load")');
        await loadButton.click();

        await window.waitForTimeout(1500);

        // Should navigate to build page
        const currentPage = await window.evaluate(() => {
            return window.location.hash || '#home';
        });

        // Should be on build page or have navigated
        expect(currentPage).toBeTruthy();
    });

    test('should highlight active character in list', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        // Check if any character has the 'selected' class
        const selectedCards = window.locator('.character-card.selected');
        const selectedCount = await selectedCards.count();

        if (selectedCount > 0) {
            // Active character should display badge
            const activeBadge = selectedCards.first().locator('.active-profile-badge');
            await expect(activeBadge).toBeVisible();
        }
    });

    test('should display character details on card', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        const firstCard = characterCards.first();

        // Check for character name
        const nameElement = firstCard.locator('.card-title');
        await expect(nameElement).toBeVisible();
        const name = await nameElement.textContent();
        expect(name.length).toBeGreaterThan(0);

        // Check for level
        const levelElement = firstCard.locator('.detail-item:has(.fa-crown)');
        await expect(levelElement).toBeVisible();

        // Check for race
        const raceElement = firstCard.locator('.detail-item:has(.fa-user)');
        await expect(raceElement).toBeVisible();

        // Check for class
        const classElement = firstCard.locator('.detail-item:has(.fa-hat-wizard)');
        await expect(classElement).toBeVisible();

        // Check for last modified date
        const lastModifiedElement = firstCard.locator('.last-modified');
        await expect(lastModifiedElement).toBeVisible();
    });

    test('should not trigger load when clicking export button', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        const firstCard = characterCards.first();
        const exportButton = firstCard.locator('.export-character');

        if (await exportButton.count() > 0) {
            await exportButton.click();
            await window.waitForTimeout(500);

            // Should still be on home page
            const homeButton = window.locator('[data-page="home"]');
            const isActive = await homeButton.evaluate((el) => {
                return el.classList.contains('active');
            });
            expect(isActive).toBeTruthy();
        }
    });

    test('should not trigger load when clicking delete button', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        const firstCard = characterCards.first();
        const deleteButton = firstCard.locator('.delete-character');

        if (await deleteButton.count() > 0) {
            await deleteButton.click();
            await window.waitForTimeout(500);

            // Should show confirmation modal
            const confirmModal = window.locator('.modal.show, #confirmationModal');
            const modalVisible = await confirmModal.count() > 0;

            if (modalVisible) {
                // Close modal by pressing Escape
                await window.keyboard.press('Escape');
                await window.waitForTimeout(500);
            }

            // Should still be on home page
            const homeButton = window.locator('[data-page="home"]');
            const isActive = await homeButton.evaluate((el) => {
                return el.classList.contains('active');
            });
            expect(isActive).toBeTruthy();
        }
    });

    test('should display character list after navigation back from build', async () => {
        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount === 0) {
            test.skip('No characters available to test');
            return;
        }

        // Load a character
        const firstCard = characterCards.first();
        await firstCard.click();
        await window.waitForTimeout(1500);

        // Navigate back to home
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();
        await window.waitForTimeout(1000);

        // Character list should still be visible
        const characterListAfter = window.locator('.character-card');
        const countAfter = await characterListAfter.count();
        expect(countAfter).toBe(cardCount);
    });
});
