/**
 * IPC handlers for data operations (D&D data files).
 *
 * @module electron/ipc/handlers/DataHandlers
 */

import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MainLogger } from '../../MainLogger.js';
import { IPC_CHANNELS } from '../channels.js';

export function registerDataHandlers(dataPath) {
	MainLogger.info('DataHandlers', 'Registering data handlers');

	ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (_event, fileName) => {
		try {
			// Remove leading "data/" or "data\" if present (services may still use old paths)
			let normalizedFileName = fileName;
			if (normalizedFileName.startsWith('data/') || normalizedFileName.startsWith('data\\')) {
				normalizedFileName = normalizedFileName.slice(5); // Remove "data/" or "data\"
			}

			// Join with dataPath which is now the data/ folder itself
			const filePath = path.join(dataPath, normalizedFileName);

			MainLogger.info('DataHandlers', 'Loading JSON:', filePath);
			const content = await fs.readFile(filePath, 'utf8');
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Load JSON failed:', error);
			return { success: false, error: error.message };
		}
	});

	MainLogger.info('DataHandlers', 'All data handlers registered');
}
