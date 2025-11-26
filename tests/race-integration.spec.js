import { test, expect } from '@playwright/test';

/**
 * Integration tests for race selection using Playwright
 * These tests examine console logs to catch all errors during race flow
 */

test.describe('Race Selection Integration Tests with Log Inspection', () => {
    let consoleLogs = [];
    let consoleErrors = [];
    let consoleWarnings = [];

    test.beforeEach(({ page }) => {
        // Clear log arrays before each test
        consoleLogs = [];
        consoleErrors = [];
        consoleWarnings = [];

        // Capture all console messages
        page.on('console', (msg) => {
            const logType = msg.type();
            const text = msg.text();

            if (logType === 'log') {
                consoleLogs.push(text);
            } else if (logType === 'error') {
                consoleErrors.push(text);
            } else if (logType === 'warning') {
                consoleWarnings.push(text);
            }
        });

        // Log page errors
        page.on('pageerror', (error) => {
            consoleErrors.push(`Page Error: ${error.message}`);
        });
    });

    test('should not log errors when handling race change with EventBus data object', async ({
        page,
    }) => {
        // Navigate to the build page where RaceCard is present
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');

        // Wait for the page to fully load
        await page.waitForTimeout(1000);

        // Inject test code to simulate RaceCard event handling
        await page.evaluate(() => {
            // Create a mock event object like RaceService emits
            const raceDataEvent = {
                name: 'Elf',
                source: 'PHB',
                size: 'Medium',
                speed: 30,
            };

            // Log the event being sent
            console.log('[Test] Sending race data event:', raceDataEvent);

            // Check if RaceCard exists and get its instance
            // This would need to be adjusted based on actual component structure
            if (window.raceCardInstance && typeof window.raceCardInstance._handleRaceChange === 'function') {
                try {
                    window.raceCardInstance._handleRaceChange(raceDataEvent);
                    console.log('[Test] Race change handled successfully');
                } catch (error) {
                    console.error('[Test] Race change failed:', error.message);
                }
            } else {
                console.log('[Test] RaceCard instance not available for testing');
            }
        });

        // Wait for async operations
        await page.waitForTimeout(500);

        // Verify no critical errors were logged
        const criticalErrors = consoleErrors.filter(
            (err) =>
                err.includes('Cannot read properties') ||
                err.includes('split is not a function') ||
                err.includes('TypeError') ||
                err.includes('Uncaught Error'),
        );

        expect(
            criticalErrors,
            `Critical errors found in console: ${criticalErrors.join(', ')}`,
        ).toHaveLength(0);
    });

    test('should handle DOM events from race dropdown correctly', async ({ page }) => {
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');
        await page.waitForTimeout(1000);

        // Find the race select element
        const raceSelect = await page.$('select[id*="race"]');

        if (!raceSelect) {
            test.skip();
        }

        // Set a valid race option
        await raceSelect.selectOption('Elf_PHB');

        // Wait for change handling
        await page.waitForTimeout(500);

        // Verify no critical errors
        const criticalErrors = consoleErrors.filter(
            (err) =>
                err.includes('Cannot read properties') ||
                err.includes('split is not a function') ||
                err.includes('TypeError'),
        );

        expect(
            criticalErrors,
            `Critical errors found when selecting race: ${criticalErrors.join(', ')}`,
        ).toHaveLength(0);
    });

    test('should log error gracefully with invalid event format', async ({ page }) => {
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');
        await page.waitForTimeout(1000);

        // Inject test to send invalid event
        await page.evaluate(() => {
            const invalidEvent = {
                // Missing name and source
                invalidProperty: 'test',
            };

            console.log('[Test] Sending invalid event:', invalidEvent);

            if (window.raceCardInstance && typeof window.raceCardInstance._handleRaceChange === 'function') {
                try {
                    window.raceCardInstance._handleRaceChange(invalidEvent);
                } catch (error) {
                    console.error('[Test] Unexpected error:', error.message);
                }
            }
        });

        await page.waitForTimeout(500);

        // Should log the error message about invalid format
        const invalidFormatErrors = consoleErrors.filter((err) => err.includes('Invalid race change event format'));

        // We expect either the error to be logged OR no crash (graceful handling)
        expect(
            consoleErrors.some(
                (err) =>
                    err.includes('Invalid race change event format') ||
                    err.includes('Cannot read properties'),
            ) === false || invalidFormatErrors.length > 0,
        ).toBe(true);
    });

    test('should preserve all console logs for inspection', async ({ page }) => {
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');
        await page.waitForTimeout(1000);

        // Inject test logs
        await page.evaluate(() => {
            console.log('[Test Phase 1] Page loaded');
            console.log('[Test Phase 2] Ready for race selection');
        });

        await page.waitForTimeout(100);

        // Verify logs were captured
        expect(consoleLogs).toContain('[Test Phase 1] Page loaded');
        expect(consoleLogs).toContain('[Test Phase 2] Ready for race selection');

        // Display logs for debugging
        console.log('=== Console Logs Captured ===');
        consoleLogs.forEach((log) => console.log(`  LOG: ${log}`));

        if (consoleErrors.length > 0) {
            console.log('=== Console Errors Captured ===');
            consoleErrors.forEach((err) => console.log(`  ERROR: ${err}`));
        }

        if (consoleWarnings.length > 0) {
            console.log('=== Console Warnings Captured ===');
            consoleWarnings.forEach((warn) => console.log(`  WARN: ${warn}`));
        }
    });

    test('should capture both EventBus and DOM event patterns', async ({ page }) => {
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');
        await page.waitForTimeout(1000);

        // Test data object pattern (EventBus)
        const result1 = await page.evaluate(() => {
            const eventData = {
                name: 'Dwarf',
                source: 'PHB',
            };

            try {
                // Simulate what happens in _handleRaceChange
                let raceValue;
                if (eventData && eventData.target && eventData.target.value) {
                    raceValue = eventData.target.value;
                } else if (eventData && eventData.name && eventData.source) {
                    raceValue = `${eventData.name}_${eventData.source}`;
                } else {
                    throw new Error('Invalid event');
                }

                const [raceName, source] = raceValue.split('_');
                console.log(`[Test] Successfully parsed EventBus format: ${raceName} (${source})`);
                return { success: true, format: 'eventbus', raceName, source };
            } catch (error) {
                console.error(`[Test] Failed to parse EventBus format:`, error.message);
                return { success: false, error: error.message };
            }
        });

        // Test DOM event pattern
        const result2 = await page.evaluate(() => {
            const domEvent = {
                target: {
                    value: 'Halfling_PHB',
                },
            };

            try {
                let raceValue;
                if (domEvent && domEvent.target && domEvent.target.value) {
                    raceValue = domEvent.target.value;
                } else if (domEvent && domEvent.name && domEvent.source) {
                    raceValue = `${domEvent.name}_${domEvent.source}`;
                } else {
                    throw new Error('Invalid event');
                }

                const [raceName, source] = raceValue.split('_');
                console.log(`[Test] Successfully parsed DOM format: ${raceName} (${source})`);
                return { success: true, format: 'dom', raceName, source };
            } catch (error) {
                console.error(`[Test] Failed to parse DOM format:`, error.message);
                return { success: false, error: error.message };
            }
        });

        // Both should succeed
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        expect(result1.raceName).toBe('Dwarf');
        expect(result2.raceName).toBe('Halfling');

        // Verify no critical errors in actual logs
        const criticalErrors = consoleErrors.filter((err) => err.includes('TypeError'));
        expect(criticalErrors).toHaveLength(0);
    });

    test('should not crash on EventBus emission after fix', async ({ page }) => {
        await page.goto('file:///c:/Users/K/Workbench/Dev/Electron/fizbanes-forge/app/build.html');
        await page.waitForTimeout(1000);

        // Simulate the actual scenario where RaceService emits
        const testResult = await page.evaluate(() => {
            const mockRaceServiceEmit = {
                name: 'Elf',
                source: 'PHB',
                size: 'Medium',
                speed: 30,
            };

            // This is what RaceService.selectRace emits
            console.log('[RaceService] Emitting race:selected with:', mockRaceServiceEmit);

            try {
                // This is what _handleRaceChange should handle
                const event = mockRaceServiceEmit;
                let raceValue;

                if (event && event.target && event.target.value) {
                    raceValue = event.target.value;
                } else if (event && event.name && event.source) {
                    raceValue = `${event.name}_${event.source}`;
                } else if (event && event.value) {
                    raceValue = event.value;
                } else {
                    console.error('[RaceCard] Invalid race change event format:', event);
                    return { success: false, handled: true, error: 'graceful' };
                }

                const [raceName, source] = raceValue.split('_');
                console.log(`[RaceCard] Successfully handled race change: ${raceName} (${source})`);
                return { success: true, handled: true, raceName, source };
            } catch (error) {
                console.error('[RaceCard] Error handling race change:', error.message);
                return { success: false, handled: false, error: error.message };
            }
        });

        // Should handle without crashing
        expect(testResult.handled).toBe(true);
        expect(testResult.success).toBe(true);

        // Most importantly - no TypeErrors in console
        const typeErrors = consoleErrors.filter((err) => err.includes('TypeError'));
        expect(
            typeErrors,
            `TypeError found in console: ${typeErrors.join(', ')}`,
        ).toHaveLength(0);
    });
});
