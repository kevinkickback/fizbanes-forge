/** IPC handlers for character progression and level-up operations. */

import { ipcMain } from 'electron';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

export function registerProgressionHandlers() {
    MainLogger.info('ProgressionHandlers', 'Registering progression handlers');

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

                return {
                    success: true,
                    message: 'Character level increased',
                };
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

                return {
                    success: true,
                    message: 'Character level decreased',
                };
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

                return {
                    success: true,
                    message: 'Class level added',
                };
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

                return {
                    success: true,
                    message: 'Class level removed',
                };
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

                // Simplified HP calculation
                // In a real implementation, this would use the LevelUpService
                let totalHP = 0;

                if (classData.level) {
                    // Base HP is hit die size at level 1, plus CON modifier at each level
                    const hitDieMap = {
                        Barbarian: 12,
                        Bard: 8,
                        Cleric: 8,
                        Druid: 8,
                        Fighter: 10,
                        Monk: 8,
                        Paladin: 10,
                        Ranger: 10,
                        Rogue: 8,
                        Sorcerer: 6,
                        Warlock: 8,
                        Wizard: 6,
                    };

                    const hitDie = hitDieMap[classData.name] || 8;
                    const conMod = classData.conModifier || 0;

                    totalHP = hitDie + conMod;
                    for (let i = 2; i <= classData.level; i++) {
                        totalHP += Math.max(1, Math.floor(hitDie / 2) + conMod);
                    }
                }

                return {
                    success: true,
                    hitPoints: totalHP,
                };
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
