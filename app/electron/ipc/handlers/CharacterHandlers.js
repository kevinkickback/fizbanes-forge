/**
 * IPC handlers for character operations.
 * 
 * @module electron/ipc/handlers/CharacterHandlers
 */

const { ipcMain, dialog } = require("electron");
const fs = require("node:fs").promises;
const fssync = require("node:fs");
const path = require("node:path");
const { v4: uuidv4 } = require("uuid");
const { IPC_CHANNELS } = require("../channels");

function registerCharacterHandlers(preferencesManager, windowManager) {
	console.log("[CharacterHandlers] Registering character handlers");

	// Save character
	ipcMain.handle(
		IPC_CHANNELS.CHARACTER_SAVE,
		async (event, characterData) => {
			try {
				// Handle both serialized string and object
				const character = typeof characterData === "string" 
					? JSON.parse(characterData)
					: characterData;

				console.log(
					"[CharacterHandlers] Saving character:",
					character.id,
				);

				const savePath = preferencesManager.getCharacterSavePath();
				const filePath = path.join(savePath, `${character.id}.ffp`);

				await fs.writeFile(
					filePath,
					JSON.stringify(character, null, 2),
				);

				console.log("[CharacterHandlers] Character saved:", filePath);
				return { success: true, path: filePath };
			} catch (error) {
				console.error("[CharacterHandlers] Save failed:", error);
				return { success: false, error: error.message };
			}
		},
	);

	// Load all characters
	ipcMain.handle(IPC_CHANNELS.CHARACTER_LIST, async () => {
		try {
			const savePath = preferencesManager.getCharacterSavePath();
			console.log("[CharacterHandlers] Loading characters from:", savePath);

			const files = await fs.readdir(savePath);
			const ffpFiles = files.filter((file) => file.endsWith(".ffp"));

			const characters = [];
			for (const file of ffpFiles) {
				try {
					const filePath = path.join(savePath, file);
					const content = await fs.readFile(filePath, "utf8");
					const character = JSON.parse(content);
					characters.push(character);
				} catch (error) {
					console.error(`[CharacterHandlers] Error loading ${file}:`, error);
				}
			}

			console.log("[CharacterHandlers] Loaded characters:", characters.length);
			return { success: true, characters };
		} catch (error) {
			console.error("[CharacterHandlers] Load failed:", error);
			return { success: false, error: error.message, characters: [] };
		}
	});

	// Delete character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_DELETE, async (event, id) => {
		try {
			console.log("[CharacterHandlers] Deleting character:", id);

			const savePath = preferencesManager.getCharacterSavePath();
			const filePath = path.join(savePath, `${id}.ffp`);

			await fs.unlink(filePath);

			console.log("[CharacterHandlers] Character deleted:", filePath);
			return { success: true };
		} catch (error) {
			console.error("[CharacterHandlers] Delete failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Export character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_EXPORT, async (event, id) => {
		try {
			console.log("[CharacterHandlers] Exporting character:", id);

			const savePath = preferencesManager.getCharacterSavePath();
			const sourceFilePath = path.join(savePath, `${id}.ffp`);

			const result = await dialog.showSaveDialog({
				title: "Export Character",
				defaultPath: `character-${id}.ffp`,
				filters: [{ name: "Fizbane Character", extensions: ["ffp"] }],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			await fs.copyFile(sourceFilePath, result.filePath);

			console.log("[CharacterHandlers] Character exported to:", result.filePath);
			return { success: true, path: result.filePath };
		} catch (error) {
			console.error("[CharacterHandlers] Export failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Import character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_IMPORT, async () => {
		try {
			console.log("[CharacterHandlers] Importing character");

			const result = await dialog.showOpenDialog({
				title: "Import Character",
				filters: [{ name: "Fizbane Character", extensions: ["ffp"] }],
				properties: ["openFile"],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			const sourceFilePath = result.filePaths[0];
			const content = await fs.readFile(sourceFilePath, "utf8");
			const character = JSON.parse(content);

			// Generate new ID for imported character
			character.id = uuidv4();

			const savePath = preferencesManager.getCharacterSavePath();
			const targetFilePath = path.join(savePath, `${character.id}.ffp`);

			await fs.writeFile(targetFilePath, JSON.stringify(character, null, 2));

			console.log("[CharacterHandlers] Character imported:", character.id);
			return { success: true, character };
		} catch (error) {
			console.error("[CharacterHandlers] Import failed:", error);
			return { success: false, error: error.message };
		}
	});

	// Generate UUID
	ipcMain.handle(IPC_CHANNELS.CHARACTER_GENERATE_UUID, () => {
		return uuidv4();
	});

	console.log("[CharacterHandlers] All character handlers registered");
}

module.exports = { registerCharacterHandlers };
