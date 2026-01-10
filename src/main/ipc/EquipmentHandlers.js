/** IPC handlers for equipment and inventory operations. */

import { ipcMain } from 'electron';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

export function registerEquipmentHandlers() {
    MainLogger.info('EquipmentHandlers', 'Registering equipment handlers');

    // Add item to inventory
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_ADD_ITEM,
        async (_event, characterId, itemData) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Adding item to character:',
                    characterId,
                    'Item:',
                    itemData?.name,
                );

                if (!itemData || !itemData.name) {
                    return {
                        success: false,
                        error: 'Invalid item data: name is required',
                    };
                }

                return { success: true, message: 'Item addition initiated' };
            } catch (error) {
                MainLogger.error('EquipmentHandlers', 'Add item failed:', error);
                return { success: false, error: error.message };
            }
        },
    );

    // Remove item from inventory
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_REMOVE_ITEM,
        async (_event, characterId, itemInstanceId) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Removing item from character:',
                    characterId,
                    'Item instance:',
                    itemInstanceId,
                );

                if (!itemInstanceId) {
                    return {
                        success: false,
                        error: 'Invalid item instance ID',
                    };
                }

                return { success: true, message: 'Item removal initiated' };
            } catch (error) {
                MainLogger.error(
                    'EquipmentHandlers',
                    'Remove item failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Equip item
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_EQUIP_ITEM,
        async (_event, characterId, itemInstanceId, slot) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Equipping item for character:',
                    characterId,
                    'Slot:',
                    slot,
                );

                if (!itemInstanceId || !slot) {
                    return {
                        success: false,
                        error: 'Item instance ID and slot are required',
                    };
                }

                return { success: true, message: 'Item equipped' };
            } catch (error) {
                MainLogger.error('EquipmentHandlers', 'Equip failed:', error);
                return { success: false, error: error.message };
            }
        },
    );

    // Unequip item
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_UNEQUIP_ITEM,
        async (_event, characterId, slot) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Unequipping item for character:',
                    characterId,
                    'Slot:',
                    slot,
                );

                if (!slot) {
                    return {
                        success: false,
                        error: 'Slot is required',
                    };
                }

                return { success: true, message: 'Item unequipped' };
            } catch (error) {
                MainLogger.error('EquipmentHandlers', 'Unequip failed:', error);
                return { success: false, error: error.message };
            }
        },
    );

    // Attune item
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_ATTUNE_ITEM,
        async (_event, characterId, itemInstanceId) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Attuning item for character:',
                    characterId,
                );

                if (!itemInstanceId) {
                    return {
                        success: false,
                        error: 'Item instance ID is required',
                    };
                }

                return { success: true, message: 'Item attuned' };
            } catch (error) {
                MainLogger.error('EquipmentHandlers', 'Attune failed:', error);
                return { success: false, error: error.message };
            }
        },
    );

    // Unattune item
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_UNATTUNE_ITEM,
        async (_event, characterId, itemInstanceId) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Unattuing item for character:',
                    characterId,
                );

                if (!itemInstanceId) {
                    return {
                        success: false,
                        error: 'Item instance ID is required',
                    };
                }

                return { success: true, message: 'Item unattued' };
            } catch (error) {
                MainLogger.error(
                    'EquipmentHandlers',
                    'Unattune failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Calculate total weight
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_CALCULATE_WEIGHT,
        async (_event, inventory) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Calculating inventory weight',
                );

                if (!inventory || !Array.isArray(inventory)) {
                    return {
                        success: false,
                        error: 'Invalid inventory data',
                    };
                }

                let totalWeight = 0;
                for (const item of inventory) {
                    const itemWeight = item.weight || 0;
                    const quantity = item.quantity || 1;
                    totalWeight += itemWeight * quantity;
                }

                return {
                    success: true,
                    weight: totalWeight,
                };
            } catch (error) {
                MainLogger.error(
                    'EquipmentHandlers',
                    'Calculate weight failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );

    // Check encumbrance
    ipcMain.handle(
        IPC_CHANNELS.EQUIPMENT_CHECK_ENCUMBRANCE,
        async (_event, totalWeight, strength) => {
            try {
                MainLogger.info(
                    'EquipmentHandlers',
                    'Checking encumbrance. Weight:',
                    totalWeight,
                    'STR:',
                    strength,
                );

                if (
                    typeof totalWeight !== 'number' ||
                    typeof strength !== 'number'
                ) {
                    return {
                        success: false,
                        error: 'Weight and strength must be numbers',
                    };
                }

                const carryCapacity = strength * 15;
                const lightlyEncumbered = carryCapacity;
                const heavilyEncumbered = carryCapacity * (2 / 3);

                let status = 'normal';
                if (totalWeight > carryCapacity) {
                    status = 'encumbered';
                } else if (totalWeight > heavilyEncumbered) {
                    status = 'lightly-encumbered';
                }

                return {
                    success: true,
                    status,
                    carryCapacity,
                    lightlyEncumbered,
                    heavilyEncumbered,
                };
            } catch (error) {
                MainLogger.error(
                    'EquipmentHandlers',
                    'Check encumbrance failed:',
                    error,
                );
                return { success: false, error: error.message };
            }
        },
    );
}
