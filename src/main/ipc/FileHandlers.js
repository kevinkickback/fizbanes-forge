import { dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

export function registerFileHandlers(preferencesManager, windowManager) {
	MainLogger.debug('FileHandlers', 'Registering file handlers');

	const getAllowedRoots = () => {
		const characterRoot = path.resolve(preferencesManager.getCharacterSavePath());
		const portraitsRoot = path.resolve(
			path.join(path.dirname(characterRoot), 'portraits'),
		);
		return {
			characterRoot,
			portraitsRoot,
			allowed: [characterRoot, portraitsRoot, path.dirname(characterRoot)],
		};
	};

	const resolveUnderAllowedRoots = (requestedPath) => {
		const { allowed } = getAllowedRoots();
		const candidate = path.resolve(requestedPath);
		return allowed.some((root) => candidate.startsWith(root))
			? candidate
			: null;
	};

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

	ipcMain.handle(IPC_CHANNELS.FILE_READ_JSON, async (_event, filePath) => {
		try {
			const safePath = resolveUnderAllowedRoots(filePath);
			if (!safePath) {
				return {
					success: false,
					error: 'Access to the requested path is denied',
				};
			}
			const content = await fs.readFile(safePath, 'utf8');
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Read JSON failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.FILE_WRITE_JSON,
		async (_event, filePath, data) => {
			try {
				const safePath = resolveUnderAllowedRoots(filePath);
				if (!safePath) {
					return {
						success: false,
						error: 'Access to the requested path is denied',
					};
				}
				await fs.writeFile(safePath, JSON.stringify(data, null, 2));
				return { success: true };
			} catch (error) {
				MainLogger.error('FileHandlers', 'Write JSON failed:', error);
				return { success: false, error: error.message };
			}
		},
	);

	ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath) => {
		try {
			const safePath = resolveUnderAllowedRoots(filePath);
			if (!safePath) {
				return { success: true, exists: false };
			}
			await fs.access(safePath);
			return { success: true, exists: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'File exists check failed:', error);
			return { success: true, exists: false };
		}
	});

	ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (_event, filePath) => {
		try {
			const safePath = resolveUnderAllowedRoots(filePath);
			if (!safePath) {
				return {
					success: false,
					error: 'Access to the requested path is denied',
				};
			}
			await shell.openPath(safePath);
			return { success: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Open file failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.FILE_OPEN_EXTERNAL, async (_event, url) => {
		try {
			if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
				return { success: false, error: 'Invalid URL' };
			}
			await shell.openExternal(url);
			return { success: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Open external URL failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.PORTRAITS_LIST, async (_event, dirPath) => {
		try {
			if (!dirPath || typeof dirPath !== 'string') {
				return { success: false, error: 'Invalid directory path' };
			}

			const { portraitsRoot } = getAllowedRoots();
			const safeDir = path.resolve(dirPath);
			if (!safeDir.startsWith(portraitsRoot)) {
				return {
					success: false,
					error: 'Access to the requested path is denied',
				};
			}

			const entries = await fs.readdir(safeDir, { withFileTypes: true });
			const allowed = new Set(['.webp', '.png', '.jpg', '.jpeg']);
			const files = entries
				.filter((d) => d.isFile())
				.map((d) => path.join(safeDir, d.name))
				.filter((p) => allowed.has(path.extname(p).toLowerCase()));

			return { success: true, files };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Portraits list failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.PORTRAITS_SAVE,
		async (_event, portraitsDir, imageData, fileName) => {
			try {
				if (!portraitsDir || !imageData || !fileName) {
					return {
						success: false,
						error: 'Missing required parameters',
					};
				}

				const { portraitsRoot } = getAllowedRoots();
				const safeDir = path.resolve(portraitsDir);
				if (!safeDir.startsWith(portraitsRoot)) {
					return {
						success: false,
						error: 'Access to the requested path is denied',
					};
				}

				await fs.mkdir(safeDir, { recursive: true });

				let extension = path.extname(fileName).toLowerCase();
				if (!extension) {
					extension = '.png';
				}

				const baseName = path
					.basename(fileName, extension)
					.replace(/[^a-z0-9_-]/gi, '_');
				const finalFileName = `${baseName}${extension}`;
				const filePath = path.join(safeDir, finalFileName);
				if (!filePath.startsWith(portraitsRoot)) {
					return {
						success: false,
						error: 'Access to the requested path is denied',
					};
				}

				let buffer;
				if (typeof imageData === 'string' && imageData.startsWith('data:')) {
					const base64Data = imageData.split(',')[1];
					if (!base64Data) {
						return {
							success: false,
							error: 'Invalid image data URL',
						};
					}
					buffer = Buffer.from(base64Data, 'base64');
				} else if (typeof imageData === 'string') {
					buffer = Buffer.from(imageData, 'base64');
				} else if (Buffer.isBuffer(imageData)) {
					buffer = imageData;
				} else {
					return {
						success: false,
						error: 'Invalid image data format',
					};
				}

				await fs.writeFile(filePath, buffer);
				MainLogger.debug('FileHandlers', 'Portrait saved:', filePath);

				return {
					success: true,
					filePath,
					fileName: finalFileName,
				};
			} catch (error) {
				MainLogger.error('FileHandlers', 'Save portrait failed:', error);
				return { success: false, error: error.message };
			}
		},
	);

	MainLogger.debug('FileHandlers', 'All file handlers registered');
}
