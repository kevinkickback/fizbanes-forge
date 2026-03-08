import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/Notifications.js', () => ({
    showNotification: vi.fn(),
}));

const mockSettings = {
    getAll: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
};

// Provide window.app.settings mock
vi.stubGlobal('window', {
    app: { settings: mockSettings },
});

import { SettingsService } from '../../src/services/SettingsService.js';

describe('SettingsService', () => {
    let service;

    beforeEach(() => {
        service = new SettingsService();
        vi.clearAllMocks();
        mockSettings.getAll.mockResolvedValue({ autoUpdateData: false });
        mockSettings.get.mockResolvedValue(null);
        mockSettings.set.mockResolvedValue(undefined);
    });

    describe('initialize', () => {
        it('should load settings from main process', async () => {
            mockSettings.getAll.mockResolvedValue({ autoUpdateData: true });
            await service.initialize();
            expect(service._initialized).toBe(true);
            expect(service.getAutoUpdateData()).toBe(true);
        });

        it('should default autoUpdateData to false when missing', async () => {
            mockSettings.getAll.mockResolvedValue({});
            await service.initialize();
            expect(service.getAutoUpdateData()).toBe(false);
        });

        it('should not reinitialize if already initialized', async () => {
            await service.initialize();
            await service.initialize();
            expect(mockSettings.getAll).toHaveBeenCalledTimes(1);
        });

        it('should throw on initialization failure', async () => {
            mockSettings.getAll.mockRejectedValue(new Error('IPC error'));
            await expect(service.initialize()).rejects.toThrow('IPC error');
        });
    });

    describe('getAutoUpdateData / setAutoUpdateData', () => {
        it('should return current autoUpdateData value', () => {
            expect(service.getAutoUpdateData()).toBe(false);
        });

        it('should set and persist autoUpdateData', async () => {
            const result = await service.setAutoUpdateData(true);
            expect(result).toBe(true);
            expect(service.getAutoUpdateData()).toBe(true);
            expect(mockSettings.set).toHaveBeenCalledWith('autoUpdateData', true);
        });

        it('should coerce truthy values to boolean', async () => {
            await service.setAutoUpdateData(1);
            expect(service.getAutoUpdateData()).toBe(true);
        });
    });

    describe('getAllSettings', () => {
        it('should delegate to IPC bridge', async () => {
            const expected = { autoUpdateData: true, theme: 'dark' };
            mockSettings.getAll.mockResolvedValue(expected);
            const result = await service.getAllSettings();
            expect(result).toEqual(expected);
        });
    });

    describe('getSetting / setSetting', () => {
        it('should get a specific setting', async () => {
            mockSettings.get.mockResolvedValue('dark');
            const result = await service.getSetting('theme');
            expect(result).toBe('dark');
            expect(mockSettings.get).toHaveBeenCalledWith('theme');
        });

        it('should set a specific setting', async () => {
            await service.setSetting('theme', 'dark');
            expect(mockSettings.set).toHaveBeenCalledWith('theme', 'dark');
        });
    });
});
