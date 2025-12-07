/** IPC handlers for file operations. */

import { dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import { MainLogger } from '../../MainLogger.js';
import { IPC_CHANNELS } from '../channels.js';

export function registerFileHandlers(windowManager) {
	MainLogger.info('FileHandlers', 'Registering file handlers');

	// Select folder
	ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
		try {
			const result = await dialog.showOpenDialog(windowManager.mainWindow, {
				properties: ['openDirectory', 'createDirectory'],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			return { success: true, path: result.filePaths[0] };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Select folder failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Read JSON file
	ipcMain.handle(IPC_CHANNELS.FILE_READ_JSON, async (_event, filePath) => {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Read JSON failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Write JSON file
	ipcMain.handle(
		IPC_CHANNELS.FILE_WRITE_JSON,
		async (_event, filePath, data) => {
			try {
				await fs.writeFile(filePath, JSON.stringify(data, null, 2));
				return { success: true };
			} catch (error) {
				MainLogger.error('FileHandlers', 'Write JSON failed:', error);
				return { success: false, error: error.message };
			}
		},
	);

	// Check if file exists
	ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath) => {
		try {
			await fs.access(filePath);
			return { success: true, exists: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'File exists check failed:', error);
			return { success: true, exists: false };
		}
	});

	// Open file with default application
	ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (_event, filePath) => {
		try {
			await shell.openPath(filePath);
			return { success: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Open file failed:', error);
			return { success: false, error: error.message };
		}
	});

	MainLogger.info('FileHandlers', 'All file handlers registered');
}
