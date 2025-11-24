import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Settings Page Functionality', () => {
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

    test('should navigate to settings page', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const mainContent = window.locator('#pageContent');
        await expect(mainContent).toBeVisible();
    });

    test('should display current save location', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1500);

        const saveLocationDisplay = window.locator('#currentSaveLocation');
        await expect(saveLocationDisplay).toBeVisible();

        const text = await saveLocationDisplay.textContent();
        // Should not be empty or just "Loading..."
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe('Loading...');
    });

    test('should display Change Folder button', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const changeFolderBtn = window.locator('#chooseFolderBtn');
        await expect(changeFolderBtn).toBeVisible();

        const buttonText = await changeFolderBtn.textContent();
        expect(buttonText).toContain('Change Folder');
    });

    test('should display Reset button', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const resetBtn = window.locator('#resetFolderBtn');
        await expect(resetBtn).toBeVisible();
    });

    test('Change Folder button should be clickable', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const changeFolderBtn = window.locator('#chooseFolderBtn');
        const isEnabled = await changeFolderBtn.isEnabled();

        expect(isEnabled).toBeTruthy();
    });

    test('Reset button should be clickable', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const resetBtn = window.locator('#resetFolderBtn');
        const isEnabled = await resetBtn.isEnabled();

        expect(isEnabled).toBeTruthy();
    });

    test('should show path that is not "Loading..."', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(2000); // Give extra time for path to load

        const saveLocationDisplay = window.locator('#currentSaveLocation');
        const text = await saveLocationDisplay.textContent();

        // Path should be loaded and not be the loading placeholder
        expect(text).not.toBe('Loading...');
        // Should contain something meaningful (path or default message)
        expect(text.length).toBeGreaterThan(10);
    });

    test('should initialize settings page after page load', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(2000);

        // Verify settings page was initialized by checking all elements are present
        const saveLocationDisplay = window.locator('#currentSaveLocation');
        const changeFolderBtn = window.locator('#chooseFolderBtn');
        const resetBtn = window.locator('#resetFolderBtn');

        await expect(saveLocationDisplay).toBeVisible();
        await expect(changeFolderBtn).toBeVisible();
        await expect(resetBtn).toBeVisible();
    });

    test('settings controls should be in correct container', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(1000);

        const saveLocationContainer = window.locator('#saveLocationDisplay');
        await expect(saveLocationContainer).toBeVisible();

        const currentLocation = saveLocationContainer.locator('#currentSaveLocation');
        await expect(currentLocation).toBeVisible();
    });

    test('should have settings service initialized', async () => {
        const settingsButton = window.locator('[data-page="settings"]');
        await settingsButton.click();

        await window.waitForTimeout(2000);

        // Verify by checking that the path was loaded
        const hasPath = await window.evaluate(() => {
            const elem = document.getElementById('currentSaveLocation');
            return elem && elem.textContent !== 'Loading...' && elem.textContent.length > 0;
        });

        expect(hasPath).toBeTruthy();
    });
});
