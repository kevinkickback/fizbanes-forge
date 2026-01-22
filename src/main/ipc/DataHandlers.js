import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildDataManifest,
	downloadDataFromUrl,
	validateDataSourceURL,
	validateLocalDataFolder,
} from '../Data.js';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEBUG_MODE = process.env.FF_DEBUG === 'true';
const DEV_DATA_PATH = DEBUG_MODE
	? path.resolve(__dirname, '..', '..', '..', 'src', 'data')
	: null;
/** Register all data-related IPC handlers. */
export function registerDataHandlers(preferencesManager) {
	MainLogger.info('DataHandlers', 'Registering data handlers');

	// Use configured data path when available; no default fallback
	let currentDataPath = null;
	const cacheRoot = path.join(
		preferencesManager.app.getPath('userData'),
		'cached-data',
	);

	// In debug mode, force local src/data without persisting over user settings
	if (DEBUG_MODE) {
		currentDataPath = DEV_DATA_PATH;
		MainLogger.info(
			'DataHandlers',
			`Debug mode enabled; using local data folder (non-persisted): ${DEV_DATA_PATH}`,
		);
	}

	const getCachePathForUrl = (url) => {
		const safeName = Buffer.from(url)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		return path.join(cacheRoot, safeName);
	};

	const syncDataPathFromPreferences = () => {
		if (DEBUG_MODE) {
			currentDataPath = DEV_DATA_PATH;
			return;
		}
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

	const sendDownloadProgress = (event, status, data = {}) => {
		if (event?.sender) {
			event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, {
				status,
				...data,
			});
		}
	};

	const refreshCurrentDataSource = async (event) => {
		MainLogger.debug('DataHandlers', 'refreshCurrentDataSource called');
		try {
			if (DEBUG_MODE) {
				MainLogger.debug(
					'DataHandlers',
					'DEBUG_MODE is true, skipping refresh',
				);
				sendDownloadProgress(event, 'complete', {
					total: 0,
					completed: 0,
					skipped: 0,
					file: null,
					success: true,
					debugBypass: true,
				});
				return {
					success: true,
					downloaded: 0,
					skipped: 0,
					debugBypass: true,
					path: currentDataPath,
				};
			}

			syncDataPathFromPreferences();
			const type = preferencesManager.get('dataSourceType', null);
			const value = preferencesManager.get('dataSourceValue', null);
			MainLogger.debug('DataHandlers', 'Retrieved data source for refresh', {
				type,
				value: value?.substring(0, 50),
			});
			if (!type || !value) {
				return { success: false, error: 'No data source configured' };
			}

			if (type === 'url') {
				MainLogger.debug('DataHandlers', 'Processing URL data source refresh');
				const cachePath = getCachePathForUrl(value);
				let cacheExists = false;
				try {
					const stats = await fs.stat(cachePath);
					cacheExists = stats.isDirectory();
				} catch {
					cacheExists = false;
				}

				MainLogger.debug('DataHandlers', 'Building manifest for URL', {
					url: value,
					cachePath,
					cacheExists,
				});
				const manifest = await buildDataManifest(value);
				MainLogger.debug('DataHandlers', 'Manifest built', {
					url: value,
					files: manifest.length,
					manifestSample: manifest.slice(0, 5),
				});
				if (!manifest.length) {
					return {
						success: false,
						error: 'No files found to use as download manifest',
					};
				}

				// Preflight existing cache to ensure baseline files exist before attempting update
				// If cache is incomplete, log it but proceed with download to fetch missing files
				if (cacheExists) {
					const preCheck = await validateLocalDataFolder(cachePath);
					if (!preCheck.valid) {
						MainLogger.info(
							'DataHandlers',
							'Cache incomplete, will download missing files',
							{
								cachePath,
								missing: preCheck.missing,
							},
						);
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
					(progress) => {
						MainLogger.debug('DataHandlers', 'Download progress', {
							file: progress.file,
							completed: progress.completed,
							total: progress.total,
							success: progress.success,
							skipped: progress.skipped,
						});
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

				MainLogger.debug('DataHandlers', 'Download completed', {
					url: value,
					cachePath,
					downloaded: downloadResult.downloaded,
					skipped: downloadResult.skipped,
					failed: downloadResult.failed?.length || 0,
				});
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

				return {
					success: true,
					downloaded: downloadResult.downloaded,
					skipped: downloadResult.skipped || 0,
				};
			}

			if (type === 'local') {
				MainLogger.debug(
					'DataHandlers',
					'Processing local data source refresh',
				);
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

			MainLogger.warn('DataHandlers', 'Unknown data source type:', type);
			return { success: false, error: 'Invalid data source type' };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Refresh data source failed:', error);
			return { success: false, error: error.message };
		}
	};

	// Initialize path from existing preferences
	syncDataPathFromPreferences();

	const isJsonFile = (fileName) => fileName.toLowerCase().endsWith('.json');

	const resolveSafePath = (basePath, requested) => {
		// Normalize separators and strip legacy prefixes
		let normalized = requested;
		if (
			normalized.startsWith('src/data/') ||
			normalized.startsWith('src/data\\')
		) {
			normalized = normalized.slice(9);
		}

		const candidate = path.resolve(basePath, normalized);
		// Ensure the resolved path stays under the configured data root
		if (!candidate.startsWith(path.resolve(basePath))) {
			return null;
		}
		return candidate;
	};

	ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (_event, fileName) => {
		try {
			if (DEBUG_MODE) {
				if (!isJsonFile(fileName)) {
					return {
						success: false,
						error: 'Only JSON files may be loaded',
					};
				}
				const filePath = resolveSafePath(DEV_DATA_PATH, fileName);
				if (!filePath) {
					return {
						success: false,
						error: 'Invalid path',
					};
				}
				try {
					const content = await fs.readFile(filePath, 'utf8');
					return { success: true, data: JSON.parse(content) };
				} catch (error) {
					MainLogger.error('DataHandlers', 'Load JSON failed (debug bypass):', {
						fileName,
						filePath,
						error: error.message,
					});
					return { success: false, error: error.message };
				}
			}

			if (!currentDataPath) {
				return {
					success: false,
					error: 'No data source configured. Please configure a data folder.',
				};
			}

			if (!isJsonFile(fileName)) {
				return { success: false, error: 'Only JSON files may be loaded' };
			}

			const filePath = resolveSafePath(currentDataPath, fileName);
			if (!filePath) {
				return { success: false, error: 'Invalid path' };
			}

			MainLogger.debug('DataHandlers', 'Loading JSON:', {
				fileName,
				filePath,
				currentDataPath,
			});

			let content;
			try {
				content = await fs.readFile(filePath, 'utf8');
			} catch (readError) {
				if (readError.code === 'ENOENT') {
					MainLogger.error('DataHandlers', 'File does not exist:', {
						filePath,
						error: readError.message,
					});
					return { success: false, error: `File not found: ${filePath}` };
				}
				throw readError;
			}

			// Validate it looks like JSON before parsing
			const trimmed = content.trim();
			if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
				MainLogger.error('DataHandlers', 'Content is not JSON:', {
					filePath,
					contentPreview: trimmed.substring(0, 200),
				});
				return {
					success: false,
					error: `File content is not valid JSON: ${filePath}`,
				};
			}

			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('DataHandlers', 'Load JSON failed:', {
				fileName,
				error: error.message,
				stack: error.stack,
			});
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.DATA_FILE_EXISTS, async (_event, fileName) => {
		try {
			// Determine the data path (debug mode or configured)
			const dataPath = DEBUG_MODE ? DEV_DATA_PATH : currentDataPath;
			if (!dataPath) {
				return false;
			}

			const filePath = resolveSafePath(dataPath, fileName);
			if (!filePath) {
				return false;
			}

			try {
				await fs.stat(filePath);
				return true;
			} catch {
				return false;
			}
		} catch {
			return false;
		}
	});

	ipcMain.handle(IPC_CHANNELS.DATA_CHECK_DEFAULT, async () => {
		return { success: true, hasDefaultData: false };
	});

	ipcMain.handle(IPC_CHANNELS.DATA_GET_SOURCE, async () => {
		try {
			if (DEBUG_MODE) {
				return {
					success: true,
					type: 'local',
					value: DEV_DATA_PATH,
					debugBypass: true,
				};
			}
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

	ipcMain.handle(IPC_CHANNELS.DATA_REFRESH_SOURCE, async (event) => {
		return refreshCurrentDataSource(event);
	});

	ipcMain.handle(IPC_CHANNELS.DATA_VALIDATE_SOURCE, async (event, source) => {
		if (DEBUG_MODE) {
			return {
				success: true,
				type: 'local',
				value: DEV_DATA_PATH,
				debugBypass: true,
			};
		}

		try {
			const { type, value } = source;

			if (type === 'local') {
				// Validate local folder
				const result = await validateLocalDataFolder(value);
				if (!result.valid) {
					MainLogger.debug('DataHandlers', 'Missing files:', result.missing);
					return {
						success: false,
						error: `Folder is missing ${result.missing.length} required data files`,
					};
				}

				// Warn about missing indexed files if any were noted separately
				if (result.missingIndexed && result.missingIndexed.length > 0) {
					MainLogger.info(
						'DataHandlers',
						'Local data source missing files referenced in indexes:',
						result.missingIndexed,
					);
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
				// Show verification phase
				sendDownloadProgress(event, 'verifying', {
					total: 0,
					completed: 0,
					file: null,
					success: true,
				});

				// Validate URL format and accessibility
				const urlValidation = await validateDataSourceURL(value);
				if (!urlValidation.valid) {
					sendDownloadProgress(event, 'error', {
						total: 0,
						completed: 0,
						file: null,
						success: false,
						error: urlValidation.error,
					});
					return { success: false, error: urlValidation.error };
				}

				// Show manifest building phase
				sendDownloadProgress(event, 'building-manifest', {
					total: 0,
					completed: 0,
					file: null,
					success: true,
				});

				// Build manifest dynamically using remote indexes only (no bundled fallback)
				const manifest = await buildDataManifest(value);
				if (!manifest.length) {
					sendDownloadProgress(event, 'error', {
						total: 0,
						completed: 0,
						file: null,
						success: false,
						error: 'No files found to use as download manifest',
					});
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
					(progress) => {
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
					MainLogger.info(
						'DataHandlers',
						'Download partially succeeded',
						downloadResult,
					);
				}
				// Sanity check cached folder has core required files
				const cacheValidation = await validateLocalDataFolder(cachePath);
				if (!cacheValidation.valid) {
					// Cache is missing core files - fail
					MainLogger.debug(
						'DataHandlers',
						'Missing files after download:',
						cacheValidation.missing,
					);
					sendDownloadProgress(event, 'error', {
						total: manifest.length,
						completed: downloadResult.downloaded,
						file: null,
						success: false,
						failed: cacheValidation.missing,
						error: `Download incomplete: ${cacheValidation.missing.length} required files missing`,
					});
					return {
						success: false,
						error: `Download incomplete: ${cacheValidation.missing.length} required files missing`,
					};
				}

				preferencesManager.set('dataSourceType', 'url');
				preferencesManager.set('dataSourceValue', value);
				preferencesManager.set('dataSourceCachePath', cachePath);
				currentDataPath = cachePath;
				MainLogger.info(
					'DataHandlers',
					'URL data source downloaded and cached',
					{
						cachePath,
						downloaded: downloadResult.downloaded,
						skipped: downloadResult.skipped || 0,
					},
				);

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
