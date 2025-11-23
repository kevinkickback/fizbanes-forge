/**
 * IPC handlers for file operations.
 * 
 * @module electron/ipc/handlers/FileHandlers
 */

const { ipcMain, dialog, shell } = require("electron");
const fs = require("node:fs").promises;
const path = require("node:path");
const { IPC_CHANNELS } = require("../channels");

function registerFileHandlers() {
	console.log("[FileHandlers] Registering file handlers");

	// Select folder
	ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
		try {
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory", "createDirectory"],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			return { success: true, path: result.filePaths[0] };
		} catch (error) {
			console.error("[FileHandlers] Select folder failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Read JSON file
	ipcMain.handle(IPC_CHANNELS.FILE_READ_JSON, async (event, filePath) => {
		try {
			const content = await fs.readFile(filePath, "utf8");
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			console.error("[FileHandlers] Read JSON failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Write JSON file
	ipcMain.handle(IPC_CHANNELS.FILE_WRITE_JSON, async (event, filePath, data) => {
		try {
			await fs.writeFile(filePath, JSON.stringify(data, null, 2));
			return { success: true };
		} catch (error) {
			console.error("[FileHandlers] Write JSON failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Check if file exists
	ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (event, filePath) => {
		try {
			await fs.access(filePath);
			return { success: true, exists: true };
		} catch {
			return { success: true, exists: false };
		}
	});

	// Open file with default application
	ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event, filePath) => {
		try {
			await shell.openPath(filePath);
			return { success: true };
		} catch (error) {
			console.error("[FileHandlers] Open file failed:", error);
			return { success: false, error: error.message };
		}
	});

	console.log("[FileHandlers] All file handlers registered");
}

module.exports = { registerFileHandlers };
