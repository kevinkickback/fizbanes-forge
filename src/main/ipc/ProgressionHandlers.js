import { ipcMain } from 'electron';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

export function registerProgressionHandlers() {
    MainLogger.info('ProgressionHandlers', 'Registering progression handlers');

    const notImplemented = (action) => ({
        success: false,
        error: `${action} not implemented`,
    });

    // Increase level
    ipcMain.handle(
        IPC_CHANNELS.PROGRESSION_INCREASE_LEVEL,
        async (_event, characterId) => {
            try {
                MainLogger.info(
                    'ProgressionHandlers',
                    'Increasing level for character:',
                    characterId,
                );

                if (!characterId) {
                    return {
                        success: false,
                        error: 'Character ID is required',
                    };
                }

                return notImplemented('Increase level');
            } catch (error) {
                MainLogger.error(
                    'ProgressionHandlers',
                    'Increase level failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Decrease level
    ipcMain.handle(
        IPC_CHANNELS.PROGRESSION_DECREASE_LEVEL,
        async (_event, characterId) => {
            try {
                MainLogger.info(
                    'ProgressionHandlers',
                    'Decreasing level for character:',
                    characterId,
                );

                if (!characterId) {
                    return {
                        success: false,
                        error: 'Character ID is required',
                    };
                }

                return notImplemented('Decrease level');
            } catch (error) {
                MainLogger.error(
                    'ProgressionHandlers',
                    'Decrease level failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Add class level (multiclass)
    ipcMain.handle(
        IPC_CHANNELS.PROGRESSION_ADD_CLASS_LEVEL,
        async (_event, characterId, className) => {
            try {
                MainLogger.info(
                    'ProgressionHandlers',
                    'Adding class level for character:',
                    characterId,
                    'Class:',
                    className,
                );

                if (!characterId || !className) {
                    return {
                        success: false,
                        error: 'Character ID and class name are required',
                    };
                }

                return notImplemented('Add class level');
            } catch (error) {
                MainLogger.error(
                    'ProgressionHandlers',
                    'Add class level failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Remove class level (multiclass)
    ipcMain.handle(
        IPC_CHANNELS.PROGRESSION_REMOVE_CLASS_LEVEL,
        async (_event, characterId, className) => {
            try {
                MainLogger.info(
                    'ProgressionHandlers',
                    'Removing class level for character:',
                    characterId,
                    'Class:',
                    className,
                );

                if (!characterId || !className) {
                    return {
                        success: false,
                        error: 'Character ID and class name are required',
                    };
                }

                return notImplemented('Remove class level');
            } catch (error) {
                MainLogger.error(
                    'ProgressionHandlers',
                    'Remove class level failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Calculate hit points
    ipcMain.handle(
        IPC_CHANNELS.PROGRESSION_CALCULATE_HP,
        async (_event, characterId, classData) => {
            try {
                MainLogger.info(
                    'ProgressionHandlers',
                    'Calculating HP for character:',
                    characterId,
                );

                if (!classData) {
                    return {
                        success: false,
                        error: 'Class data is required',
                    };
                }

                return notImplemented('Calculate HP');
            } catch (error) {
                MainLogger.error(
                    'ProgressionHandlers',
                    'Calculate HP failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );
}
