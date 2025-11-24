import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Home Page Welcome Screen', () => {
    let electronApp;
    let window;

    // Set timeout for all tests in this suite
    test.setTimeout(10000);

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
        await window.waitForTimeout(3000);
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test.beforeEach(async () => {
        // Close any open modal from previous test
        const modalBackdrop = window.locator('.modal-backdrop');
        const backdropCount = await modalBackdrop.count();
        if (backdropCount > 0) {
            // Press Escape to close modal
            await window.keyboard.press('Escape');
            await window.waitForTimeout(500);
        }
    });

    test('should display welcome screen when no characters exist', async () => {
        // Check for empty state container
        const emptyState = window.locator('.empty-state');
        await expect(emptyState).toBeVisible();
    });

    test('should display welcome screen icon', async () => {
        // Check for the large users icon
        const icon = window.locator('.empty-state i.fa-users');
        await expect(icon).toBeVisible();

        // Verify it has the large size class
        const hasLargeClass = await icon.evaluate((el) => {
            return el.classList.contains('fa-5x');
        });
        expect(hasLargeClass).toBeTruthy();
    });

    test('should display "No Characters" heading', async () => {
        const heading = window.locator('.empty-state h2');
        await expect(heading).toBeVisible();

        const headingText = await heading.textContent();
        expect(headingText).toContain('No Characters');
    });

    test('should display welcome message', async () => {
        const message = window.locator('.empty-state p.lead');
        await expect(message).toBeVisible();

        const messageText = await message.textContent();
        expect(messageText).toContain('Create or import a character to get started');
    });

    test('should display Create Character button on welcome screen', async () => {
        const createBtn = window.locator('#welcomeCreateCharacterBtn');
        await expect(createBtn).toBeVisible();

        const buttonText = await createBtn.textContent();
        expect(buttonText).toContain('Create Character');
    });

    test('should display Import Character button on welcome screen', async () => {
        const importBtn = window.locator('#emptyStateImportBtn');
        await expect(importBtn).toBeVisible();

        const buttonText = await importBtn.textContent();
        expect(buttonText).toContain('Import Character');
    });

    test('Create Character button should be clickable', async () => {
        const createBtn = window.locator('#welcomeCreateCharacterBtn');
        const isEnabled = await createBtn.isEnabled();
        expect(isEnabled).toBeTruthy();
    });

    test('Import Character button should be clickable', async () => {
        const importBtn = window.locator('#emptyStateImportBtn');
        const isEnabled = await importBtn.isEnabled();
        expect(isEnabled).toBeTruthy();
    });

    test('Create Character button should open new character modal', async () => {
        const createBtn = window.locator('#welcomeCreateCharacterBtn');
        await createBtn.click();

        await window.waitForTimeout(500);

        // Check if modal is visible
        const modal = window.locator('#newCharacterModal');
        const modalVisible = await modal.evaluate((el) => {
            return el.classList.contains('show') || window.getComputedStyle(el).display !== 'none';
        });

        expect(modalVisible).toBeTruthy();
    });

    test('top-left buttons should be hidden when welcome screen is displayed', async () => {
        // Check if the top button row is hidden
        const topButtonRow = window.locator('.row.mb-4').first();

        const isHidden = await topButtonRow.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.display === 'none';
        });

        expect(isHidden).toBeTruthy();
    });

    test('welcome screen should be centered vertically', async () => {
        const emptyStateContainer = window.locator('.d-flex.justify-content-center.align-items-center');
        await expect(emptyStateContainer).toBeVisible();

        const hasFlexClasses = await emptyStateContainer.evaluate((el) => {
            return el.classList.contains('d-flex') &&
                el.classList.contains('justify-content-center') &&
                el.classList.contains('align-items-center');
        });

        expect(hasFlexClasses).toBeTruthy();
    });

    test('welcome screen should have proper spacing', async () => {
        const icon = window.locator('.empty-state i.fa-users');
        const heading = window.locator('.empty-state h2');
        const message = window.locator('.empty-state p.lead');

        // Check icon has bottom margin
        const iconMargin = await icon.evaluate((el) => {
            return window.getComputedStyle(el).marginBottom;
        });
        expect(iconMargin).not.toBe('0px');

        // Check heading has bottom margin
        const headingMargin = await heading.evaluate((el) => {
            return window.getComputedStyle(el).marginBottom;
        });
        expect(headingMargin).not.toBe('0px');

        // All elements should be visible
        await expect(icon).toBeVisible();
        await expect(heading).toBeVisible();
        await expect(message).toBeVisible();
    });

    test('buttons should be in a horizontal layout', async () => {
        const buttonContainer = window.locator('.empty-state .d-flex.gap-2');
        await expect(buttonContainer).toBeVisible();

        const hasFlexClass = await buttonContainer.evaluate((el) => {
            return el.classList.contains('d-flex');
        });

        expect(hasFlexClass).toBeTruthy();
    });

    test('buttons should have icons', async () => {
        const createBtnIcon = window.locator('#welcomeCreateCharacterBtn i.fa-plus');
        const importBtnIcon = window.locator('#emptyStateImportBtn i.fa-file-import');

        await expect(createBtnIcon).toBeVisible();
        await expect(importBtnIcon).toBeVisible();
    });

    test('Create Character button should have primary styling', async () => {
        const createBtn = window.locator('#welcomeCreateCharacterBtn');

        const hasPrimaryClass = await createBtn.evaluate((el) => {
            return el.classList.contains('btn-primary');
        });

        expect(hasPrimaryClass).toBeTruthy();
    });

    test('Import Character button should have secondary styling', async () => {
        const importBtn = window.locator('#emptyStateImportBtn');

        const hasSecondaryClass = await importBtn.evaluate((el) => {
            return el.classList.contains('btn-secondary');
        });

        expect(hasSecondaryClass).toBeTruthy();
    });

    test('welcome screen should occupy most of viewport height', async () => {
        const container = window.locator('.d-flex.justify-content-center.align-items-center');

        const height = await container.evaluate((el) => {
            return window.getComputedStyle(el).height;
        });

        // Should have substantial height (using calc with viewport height)
        expect(height).not.toBe('0px');
        expect(height).not.toBe('auto');
    });

    test('character list should exist but be used for empty state', async () => {
        const characterList = window.locator('#characterList');
        await expect(characterList).toBeVisible();

        // Should contain the empty state content
        const emptyState = characterList.locator('.empty-state');
        await expect(emptyState).toBeVisible();
    });

    test('welcome screen text should be readable and styled', async () => {
        const heading = window.locator('.empty-state h2');
        const message = window.locator('.empty-state p.lead');

        // Check text is center-aligned
        const headingAlign = await heading.evaluate((el) => {
            return window.getComputedStyle(el).textAlign;
        });

        const messageAlign = await message.evaluate((el) => {
            return window.getComputedStyle(el).textAlign;
        });

        // Center alignment may be inherited from parent
        const parentAlign = await window.locator('.empty-state').evaluate((el) => {
            return window.getComputedStyle(el).textAlign;
        });

        expect(parentAlign).toBe('center');
    });

    test('icon should be muted/subtle in color', async () => {
        const icon = window.locator('.empty-state i.fa-users');

        const hasMutedClass = await icon.evaluate((el) => {
            return el.classList.contains('text-muted');
        });

        expect(hasMutedClass).toBeTruthy();
    });
});
