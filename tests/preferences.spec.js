import { _electron as electron, expect, test } from '@playwright/test';

/**
 * Preferences validation tests
 */

test('Preferences: validated set and get', async () => {
    const electronApp = await electron.launch({ args: ['.'] });
    const window = await electronApp.firstWindow();

    // Access exposed preload API domain via window.app or settings IPC
    const result = await window.evaluate(async () => {
        // Use window.app.settings to get/set via IPC if exposed
        const getAll = await window.app.settings.getAll();
        // Try setting invalid values
        await window.app.settings.set('autoSaveInterval', -5);
        await window.app.settings.set('theme', 'invalid-theme');
        await window.app.settings.set('logLevel', 'NOPE');
        await window.app.settings.set('windowBounds', { width: '1000', height: 'abc' });

        const after = await window.app.settings.getAll();
        return { before: getAll, after };
    });

    // Assertions: invalid values should be coerced to defaults
    expect(result.after.autoSaveInterval).toBeGreaterThan(0);
    expect(['auto', 'light', 'dark']).toContain(result.after.theme);
    expect(['DEBUG', 'INFO', 'WARN', 'ERROR']).toContain(result.after.logLevel);
    expect(typeof result.after.windowBounds.width).toBe('number');
    expect(typeof result.after.windowBounds.height).toBe('number');

    await electronApp.close();
});
