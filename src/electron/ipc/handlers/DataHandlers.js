/**
 * IPC handlers for data operations (D&D data files).
 *
 * @module src/electron/ipc/handlers/DataHandlers
 */

import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
	collectDataManifest,
	downloadDataFromUrl,
	validateDataSourceURL,
	validateLocalDataFolder,
} from '../../DataFolderManager.js';
import { MainLogger } from '../../MainLogger.js';
import { IPC_CHANNELS } from '../channels.js';

export function registerDataHandlers(dataPath, preferencesManager) {
	MainLogger.info('DataHandlers', 'Registering data handlers');

	// Use configured data path when available; no default fallback
	let currentDataPath = null;
	const cacheRoot = path.join(
		preferencesManager.app.getPath('userData'),
		'cached-data',
	);

	const getCachePathForUrl = (url) => {
		const safeName = Buffer.from(url)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		return path.join(cacheRoot, safeName);
	};

	const syncDataPathFromPreferences = () => {
		const type = preferencesManager.get('dataSourceType', null);
		const value = preferencesManager.get('dataSourceValue', null);
		const cachePath = preferencesManager.get('dataSourceCachePath', null);
		if (type === 'local' && value) {
			currentDataPath = value;
			return;
		}
		if (type === 'url' && cachePath) {
			currentDataPath = cachePath;
			return;
		}
		currentDataPath = null;
	};

	// Initialize path from existing preferences
	syncDataPathFromPreferences();

	ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (_event, fileName) => {
		try {
			if (!currentDataPath) {
				return {
					success: false,
					error: 'No data source configured. Please configure a data folder.',
				};
			}

			// Remove leading "src/data/" or "src/data\\" if present (services may still use old paths)
			let normalizedFileName = fileName;
			if (
				normalizedFileName.startsWith('src/data/') ||
				normalizedFileName.startsWith('src/data\\')
			) {
				normalizedFileName = normalizedFileName.slice(9); // Remove "src/data/" or "src/data\\"
			}

			// Join with dataPath which is now the data/ folder itself
			const filePath = path.join(currentDataPath, normalizedFileName);

			MainLogger.info('DataHandlers', 'Loading JSON:', filePath);
			const content = await fs.readFile(filePath, 'utf8');
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Load JSON failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Check if default data folder exists
	ipcMain.handle(IPC_CHANNELS.DATA_CHECK_DEFAULT, async () => {
		return { success: true, hasDefaultData: false };
	});

	// Get saved data source configuration
	ipcMain.handle(IPC_CHANNELS.DATA_GET_SOURCE, async () => {
		try {
			const type = preferencesManager.get('dataSourceType', null);
			const value = preferencesManager.get('dataSourceValue', null);

			MainLogger.info('DataHandlers', 'Retrieved data source config:', {
				type,
				value,
			});

			return { success: true, type, value };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Failed to get data source:', error);
			return { success: false, type: null, value: null };
		}
	});

	// Validate and configure data source (URL or local folder)
	ipcMain.handle(IPC_CHANNELS.DATA_VALIDATE_SOURCE, async (event, source) => {
		try {
			const { type, value } = source;

			if (type === 'local') {
				// Validate local folder
				const result = await validateLocalDataFolder(value);
				if (!result.valid) {
					return {
						success: false,
						error: `Missing core files: ${result.missing.join(', ')}`,
					};
				}

				// Warn about missing optional files
				if (result.missingOptional && result.missingOptional.length > 0) {
					MainLogger.info('DataHandlers', 'Local data source has missing optional files:', result.missingOptional);
				}

				// Save configuration and update active data path
				preferencesManager.set('dataSourceType', 'local');
				preferencesManager.set('dataSourceValue', value);
				preferencesManager.set('dataSourceCachePath', null);
				currentDataPath = value;
				MainLogger.info('DataHandlers', 'Local data source configured:', value);

				return { success: true };
			}
			if (type === 'url') {
				// Validate URL format and accessibility
				const urlValidation = await validateDataSourceURL(value);
				if (!urlValidation.valid) {
					return { success: false, error: urlValidation.error };
				}

				// Build manifest from bundled data folder (authoritative file list)
				const manifest = await collectDataManifest(dataPath);
				if (!manifest.length) {
					return {
						success: false,
						error: 'No files found in bundled data to use as download manifest',
					};
				}
				const cachePath = getCachePathForUrl(value);

				// Check if this is same URL as current config (incremental update)
				const currentUrl = preferencesManager.get('dataSourceValue', null);
				const isIncremental = currentUrl === value;

				MainLogger.info('DataHandlers', isIncremental ? 'Updating remote data source (incremental)' : 'Downloading remote data source (full)', {
					url: value,
					cachePath,
					files: manifest.length,
				});

				// Inform renderer that download is starting
				if (event?.sender) {
					event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
						status: 'start',
						total: manifest.length,
						completed: 0,
						file: null,
						success: true,
					});
				}

				const downloadResult = await downloadDataFromUrl(
					value,
					cachePath,
					manifest,
					progress => {
						if (event?.sender) {
							event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
								status: 'progress',
								total: progress.total,
								completed: progress.completed,
								file: progress.file,
								success: progress.success,
								skipped: progress.skipped,
								error: progress.error,
							});
						}
					},
				);

				// Download succeeded with what's available (some files may be missing upstream)
				if (downloadResult.warning) {
					MainLogger.info('DataHandlers', 'Download partially succeeded', downloadResult);
				}
				// Sanity check cached folder has core required files
				const cacheValidation = await validateLocalDataFolder(cachePath);
				if (!cacheValidation.valid) {
					// Cache is missing core files - fail
					if (event?.sender) {
						event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
							status: 'error',
							total: manifest.length,
							completed: downloadResult.downloaded,
							file: null,
							success: false,
							failed: cacheValidation.missing,
							error: `Downloaded data is missing core files: ${cacheValidation.missing.join(', ')}`,
						});
					}
					return {
						success: false,
						error: `Downloaded data is missing core files: ${cacheValidation.missing.join(', ')}`,
					};
				}

				preferencesManager.set('dataSourceType', 'url');
				preferencesManager.set('dataSourceValue', value);
				preferencesManager.set('dataSourceCachePath', cachePath);
				currentDataPath = cachePath;
				MainLogger.info('DataHandlers', 'URL data source downloaded and cached', {
					cachePath,
					downloaded: downloadResult.downloaded,
					skipped: downloadResult.skipped || 0,
					isIncremental,
				});

				if (event?.sender) {
					event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
						status: 'complete',
						total: manifest.length,
						completed: downloadResult.downloaded,
						skipped: downloadResult.skipped || 0,
						file: null,
						success: true,
					});
				}

				return { success: true };
			}

			return { success: false, error: 'Invalid source type' };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Data source validation failed:', error);
			return { success: false, error: error.message };
		}
	});

	MainLogger.info('DataHandlers', 'All data handlers registered');
}
