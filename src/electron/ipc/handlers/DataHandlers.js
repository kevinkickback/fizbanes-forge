/**
 * IPC handlers for data source configuration and JSON loading.
 *
 * ARCHITECTURE:
 * - Manages D&D data file sources (local folders or remote URLs)
 * - Maintains current data path in memory, synced from PreferencesManager
 * - Handles download/caching for URL sources
 * - Provides streaming JSON data to renderer services
 *
 * DATA SOURCE TYPES:
 * - local: Absolute path to local data folder
 * - url: Remote repository URL (downloads and caches to userData/cached-data/)
 *
 * FLOW:
 * 1. Renderer calls data:validateSource with type and value
 * 2. Validation occurs (structure check for local, HTTP HEAD for URL)
 * 3. On success, configuration saved to PreferencesManager
 * 4. Renderer calls data:refreshSource on startup to prep current source
 * 5. Services call data:loadJson to fetch individual files
 *
 * @module src/electron/ipc/handlers/DataHandlers
 */

import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
	buildDataManifest,
	downloadDataFromUrl,
	validateDataSourceURL,
	validateLocalDataFolder,
} from '../../DataFolderManager.js';
import { MainLogger } from '../../MainLogger.js';
import { IPC_CHANNELS } from '../channels.js';

/**
 * Register all data-related IPC handlers.
 *
 * @param {PreferencesManager} preferencesManager - Preferences instance for storing config
 *
 * HANDLERS REGISTERED:
 * - data:loadJson - Load JSON file content from configured source
 * - data:getSource - Retrieve currently configured data source
 * - data:validateSource - Validate and configure a new data source
 * - data:refreshSource - Refresh/sync current configured source
 * - data:checkDefault - Check if default bundled data exists (legacy, always returns false)
 *
 * @private
 */
export function registerDataHandlers(preferencesManager) {
	MainLogger.info('DataHandlers', 'Registering data handlers');

	// Use configured data path when available; no default fallback
	let currentDataPath = null;
	const cacheRoot = path.join(
		preferencesManager.app.getPath('userData'),
		'cached-data',
	);

	/**
	 * Generate a cache directory name from a URL using base64 encoding.
	 * Ensures unique directory per URL and safe filesystem naming.
	 *
	 * @param {string} url - URL to encode
	 * @returns {string} Safe directory path for cache
	 *
	 * @private
	 */
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

	/**
	 * Send download progress update to renderer via IPC.
	 *
	 * @param {IpcMainInvokeEvent} [event] - Event for sending updates
	 * @param {string} status - 'start' | 'progress' | 'complete' | 'error'
	 * @param {Object} data - Progress data
	 *
	 * @private
	 */
	const sendDownloadProgress = (event, status, data = {}) => {
		if (event?.sender) {
			event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
				status,
				...data,
			});
		}
	};

	/**
	 * Refresh current data source by reading from preferences and syncing state.
	 * For URL sources: downloads new/changed files to cache.
	 * For local sources: validates that required files still exist.
	 *
	 * @param {IpcMainInvokeEvent} [event] - Optional event for sending progress updates
	 * @returns {Promise<{success: boolean, error?: string, downloaded?: number, skipped?: number}>}
	 *
	 * @private
	 */
	const refreshCurrentDataSource = async (event) => {
		try {
			syncDataPathFromPreferences();
			const type = preferencesManager.get('dataSourceType', null);
			const value = preferencesManager.get('dataSourceValue', null);
			if (!type || !value) {
				return { success: false, error: 'No data source configured' };
			}

			if (type === 'url') {
				const cachePath = getCachePathForUrl(value);
				let cacheExists = false;
				try {
					const stats = await fs.stat(cachePath);
					cacheExists = stats.isDirectory();
				} catch {
					cacheExists = false;
				}

				const manifest = await buildDataManifest(value);
				if (!manifest.length) {
					return {
						success: false,
						error: 'No files found to use as download manifest',
					};
				}

				// Preflight existing cache to ensure baseline files exist before attempting update
				if (cacheExists) {
					const preCheck = await validateLocalDataFolder(cachePath);
					if (!preCheck.valid) {
						return {
							success: false,
							error: `Cached data invalid or incomplete: ${preCheck.missing.join(', ')}`,
						};
					}
				}

				sendDownloadProgress(event, 'start', {
					total: manifest.length,
					completed: 0,
					file: null,
					success: true,
				});

				const downloadResult = await downloadDataFromUrl(
					value,
					cachePath,
					manifest,
					progress => {
						sendDownloadProgress(event, 'progress', {
							total: progress.total,
							completed: progress.completed,
							file: progress.file,
							success: progress.success,
							skipped: progress.skipped,
							error: progress.error,
						});
					},
				);

				const cacheValidation = await validateLocalDataFolder(cachePath);
				if (!cacheValidation.valid) {
					return {
						success: false,
						error: `Downloaded data is missing files: ${cacheValidation.missing.join(', ')}`,
					};
				}

				preferencesManager.set('dataSourceType', 'url');
				preferencesManager.set('dataSourceValue', value);
				preferencesManager.set('dataSourceCachePath', cachePath);
				currentDataPath = cachePath;

				sendDownloadProgress(event, 'complete', {
					total: manifest.length,
					completed: downloadResult.downloaded,
					skipped: downloadResult.skipped || 0,
					file: null,
					success: true,
				});

				return { success: true, downloaded: downloadResult.downloaded, skipped: downloadResult.skipped || 0 };
			}

			if (type === 'local') {
				const validation = await validateLocalDataFolder(value);
				if (!validation.valid) {
					return {
						success: false,
						error: `Local data missing files: ${validation.missing.join(', ')}`,
					};
				}
				currentDataPath = value;
				return { success: true, downloaded: 0, skipped: 0 };
			}

			return { success: false, error: 'Invalid data source type' };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Refresh data source failed:', error);
			return { success: false, error: error.message };
		}
	};

	// Initialize path from existing preferences
	syncDataPathFromPreferences();

	/**
	 * HANDLER: data:loadJson
	 * Load a JSON file from the configured data source (local or cached remote).
	 * Normalizes legacy file paths (removes src/data/ prefix if present).
	 *
	 * @param {IpcMainInvokeEvent} _event
	 * @param {string} fileName - File path relative to data root (e.g., 'races.json' or 'class/artificer.json')
	 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
	 */
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

	/**
	 * HANDLER: data:checkDefault
	 * Check if default bundled data exists (legacy, currently unused).
	 * Always returns false as app now requires user-configured data source.
	 *
	 * @param {IpcMainInvokeEvent} _event
	 * @returns {Promise<{success: boolean, hasDefaultData: boolean}>}
	 */
	ipcMain.handle(IPC_CHANNELS.DATA_CHECK_DEFAULT, async () => {
		return { success: true, hasDefaultData: false };
	});

	/**
	 * HANDLER: data:getSource
	 * Retrieve the currently configured data source (type and value).
	 * Used during app startup to check if user has already configured a source.
	 *
	 * @param {IpcMainInvokeEvent} _event
	 * @returns {Promise<{success: boolean, type?: 'local'|'url', value?: string}>}
	 */
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

	/**
	 * HANDLER: data:refreshSource
	 * Refresh/sync the currently configured data source.
	 * For URL sources: downloads/updates files if new versions exist.
	 * For local sources: validates that all required files are still present.
	 * Called on app startup to ensure data is current before services load.
	 *
	 * @param {IpcMainInvokeEvent} event - Event object with sender for progress updates
	 * @returns {Promise<{success: boolean, error?: string, downloaded?: number, skipped?: number}>}
	 */
	ipcMain.handle(IPC_CHANNELS.DATA_REFRESH_SOURCE, async (event) => {
		return refreshCurrentDataSource(event);
	});

	/**
	 * HANDLER: data:validateSource
	 * Validate and configure a new data source (local folder or remote URL).
	 * For local: validates folder structure and required files.
	 * For URL: validates accessibility and structure, then downloads/caches all files.
	 * On success: saves configuration to PreferencesManager and emits progress updates.
	 *
	 * @param {IpcMainInvokeEvent} event - Event object with sender for download progress
	 * @param {{type: 'local'|'url', value: string}} source - Data source details
	 * @returns {Promise<{success: boolean, error?: string}>}
	 */
	ipcMain.handle(IPC_CHANNELS.DATA_VALIDATE_SOURCE, async (event, source) => {
		try {
			const { type, value } = source;

			if (type === 'local') {
				// Validate local folder
				const result = await validateLocalDataFolder(value);
				if (!result.valid) {
					return {
						success: false,
						error: `Missing required files: ${result.missing.join(', ')}`,
					};
				}

				// Warn about missing indexed files if any were noted separately
				if (result.missingIndexed && result.missingIndexed.length > 0) {
					MainLogger.info('DataHandlers', 'Local data source missing files referenced in indexes:', result.missingIndexed);
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

				// Build manifest dynamically using remote indexes only (no bundled fallback)
				const manifest = await buildDataManifest(value);
				if (!manifest.length) {
					return {
						success: false,
						error: 'No files found to use as download manifest',
					};
				}
				const cachePath = getCachePathForUrl(value);

				// Check if this is same URL as current config (incremental update)
				MainLogger.info('DataHandlers', 'Downloading remote data source', {
					url: value,
					cachePath,
					files: manifest.length,
				});

				sendDownloadProgress(event, 'start', {
					total: manifest.length,
					completed: 0,
					file: null,
					success: true,
				});

				const downloadResult = await downloadDataFromUrl(
					value,
					cachePath,
					manifest,
					progress => {
						sendDownloadProgress(event, 'progress', {
							total: progress.total,
							completed: progress.completed,
							file: progress.file,
							success: progress.success,
							skipped: progress.skipped,
							error: progress.error,
						});
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
					sendDownloadProgress(event, 'error', {
						total: manifest.length,
						completed: downloadResult.downloaded,
						file: null,
						success: false,
						failed: cacheValidation.missing,
						error: `Downloaded data is missing required files: ${cacheValidation.missing.join(', ')}`,
					});
					return {
						success: false,
						error: `Downloaded data is missing required files: ${cacheValidation.missing.join(', ')}`,
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
				});

				sendDownloadProgress(event, 'complete', {
					total: manifest.length,
					completed: downloadResult.downloaded,
					skipped: downloadResult.skipped || 0,
					file: null,
					success: true,
				});

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
