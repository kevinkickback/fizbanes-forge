import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Home Page Character Management', () => {
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

    test('should navigate to home page', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });

    test('should display character list container', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        const characterList = window.locator('#characterList');
        // Container should exist in DOM (may be hidden if empty)
        const exists = await characterList.count() > 0;
        expect(exists).toBeTruthy();
    });

    test('should hide top New Character button when welcome screen is shown', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        // Top button should be hidden when no characters exist (welcome screen shown)
        const newCharButton = window.locator('#newCharacterBtn');
        await expect(newCharButton).toBeHidden();
    });

    test('should hide top Import Character button when welcome screen is shown', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        // Top button should be hidden when no characters exist (welcome screen shown)
        const importButton = window.locator('#importCharacterBtn');
        await expect(importButton).toBeHidden();
    });

    test('should populate character list content', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(2000); // Extra time for character list to load

        // Verify PageHandler ran by checking that list has content
        const listContent = await window.evaluate(() => {
            const list = document.getElementById('characterList');
            return list ? list.innerHTML.trim() : '';
        });

        // PageHandler should have populated the list with either cards or a message
        // Even if empty, it should have been initialized (not just empty string)
        expect(listContent.length).toBeGreaterThan(0);
    });

    test('New Character button should be clickable', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        const newCharButton = window.locator('#newCharacterBtn');
        const isEnabled = await newCharButton.isEnabled();

        expect(isEnabled).toBeTruthy();
    });

    test('Import Character button should be clickable', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1000);

        const importButton = window.locator('#importCharacterBtn');
        const isEnabled = await importButton.isEnabled();

        expect(isEnabled).toBeTruthy();
    });

    test('character cards should have Load buttons', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1500);

        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount > 0) {
            // Check first character card has a Load button
            const firstCard = characterCards.first();
            const loadButton = firstCard.locator('button:has-text("Load")');
            await expect(loadButton).toBeVisible();
        }
    });

    test('character cards should have Delete buttons', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(1500);

        const characterCards = window.locator('.character-card');
        const cardCount = await characterCards.count();

        if (cardCount > 0) {
            // Check first character card has a Delete button
            const firstCard = characterCards.first();
            const deleteButton = firstCard.locator('button.btn-danger');
            await expect(deleteButton).toBeVisible();
        }
    });

    test('should load character list after page load', async () => {
        const homeButton = window.locator('[data-page="home"]');
        await homeButton.click();

        await window.waitForTimeout(2000);

        // Verify character list was loaded (either cards or empty message appears)
        const characterList = window.locator('#characterList');
        const content = await characterList.innerHTML();

        expect(content.length).toBeGreaterThan(0);
    });
});
