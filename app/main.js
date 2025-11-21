const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { PDFDocument } = require("pdf-lib");
const { v4: uuidv4 } = require('uuid');
const { dialog } = require("electron");

// Store for user preferences
let userPreferences = {
  characterSavePath: null
};

// Load user preferences from file if available
try {
  const userPreferencesPath = path.join(app.getPath("userData"), "preferences.json");
  if (fs.existsSync(userPreferencesPath)) {
    const loadedPreferences = JSON.parse(fs.readFileSync(userPreferencesPath, "utf8"));
    userPreferences = { ...userPreferences, ...loadedPreferences };
  }
} catch (error) {
  console.error("[App] Error loading user preferences:", error);
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    resizable: true,
    icon: path.resolve(__dirname, 'img', 'icon.ico'),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Enable DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();

    // Add keyboard shortcut to toggle DevTools (Ctrl+Shift+I or Cmd+Option+I)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  // Show and focus mainWindow after loading
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load HTML file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false);

  return mainWindow;
}

// Get the characters file path
function getCharactersFilePath() {
  // Use the user preference if set, otherwise use the default path
  return userPreferences.characterSavePath || app.getPath("userData");
}

// Save user preferences
function saveUserPreferences() {
  try {
    const userPreferencesPath = path.join(app.getPath("userData"), "preferences.json");
    fs.writeFileSync(userPreferencesPath, JSON.stringify(userPreferences, null, 2));
  } catch (error) {
    console.error("[App] Error saving user preferences:", error);
  }
}

// Move character files from one location to another
async function moveCharacterFiles(oldPath, newPath) {
  try {
    const files = await fs.readdir(oldPath);
    const ffpFiles = files.filter(file => file.endsWith('.ffp'));

    console.log("[FileMigration] Moving files from ${oldPath} to ${newPath} (${ffpFiles.length} files)");

    for (const file of ffpFiles) {
      const oldFilePath = path.join(oldPath, file);
      const newFilePath = path.join(newPath, file);

      try {
        await fs.copyFile(oldFilePath, newFilePath);
        await fs.unlink(oldFilePath);
      } catch (err) {
        console.error("[FileMigration] Error for ${file}:", err.message);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[FileMigration] Error moving character files:", error);
    return { success: false, error: error.message };
  }
}

// Save character data
ipcMain.handle("saveCharacter", async (event, serializedCharacter) => {
  try {
    // Parse the pre-serialized character data
    const character = JSON.parse(serializedCharacter);

    console.log('[CharacterStorage] Starting character save:', {
      id: character.id,
      name: character.name,
      allowedSources: character.allowedSources
    });

    if (!character || !character.id) {
      throw new Error('Invalid character data: missing ID');
    }

    const savePath = getCharactersFilePath();
    console.log('[CharacterStorage] Save path:', savePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
      console.log('[CharacterStorage] Created save directory');
    }

    // Find existing file or generate new path
    const targetFilePath = await findOrCreateCharacterPath(savePath, character);
    console.log('[CharacterStorage] Target file path:', targetFilePath);

    // Process allowedSources for proper serialization
    // If allowedSources is a Set or has a 'has' method, convert it to an array
    if (character.allowedSources && (
      character.allowedSources instanceof Set ||
      typeof character.allowedSources.has === 'function'
    )) {
      character.allowedSources = Array.from(character.allowedSources);
      console.log('[CharacterStorage] Converted allowedSources to array:', character.allowedSources);
    }

    // Ensure lastModified date is set to current time
    character.lastModified = new Date().toISOString();
    console.log('[CharacterStorage] Updated lastModified date:', character.lastModified);

    // Save the character with the updated lastModified date
    const characterData = JSON.stringify(character, null, 2);
    fs.writeFileSync(targetFilePath, characterData);
    console.log('[CharacterStorage] Character saved successfully');
    return { success: true, path: targetFilePath };
  } catch (error) {
    console.error("[CharacterStorage] Error saving character:", error);
    return { success: false, error: error.message };
  }
});

// Find existing character file or create new path
async function findOrCreateCharacterPath(savePath, character) {
  console.log('[CharacterStorage] Finding/creating character path for:', character.name);
  const files = fs.readdirSync(savePath).filter(file => file.endsWith('.ffp'));

  // Try to find existing file
  for (const file of files) {
    try {
      const filePath = path.join(savePath, file);
      const data = fs.readFileSync(filePath, "utf8");
      const existingCharacter = JSON.parse(data);
      if (existingCharacter?.id === character.id) {
        console.log('[CharacterStorage] Found existing character file:', filePath);
        return filePath;
      }
    } catch (err) {
      console.error(`[CharacterStorage] Error checking file ${file}:`, err);
    }
  }

  // Generate new path
  const sanitizedName = sanitizeFilename(character.name || 'character');
  const baseFilePath = path.join(savePath, `${sanitizedName}.ffp`);

  if (fs.existsSync(baseFilePath)) {
    try {
      const data = fs.readFileSync(baseFilePath, "utf8");
      const existingCharacter = JSON.parse(data);
      if (existingCharacter?.id !== character.id) {
        const uniqueName = getUniqueFilename(savePath, `${sanitizedName}.ffp`);
        console.log('[CharacterStorage] Generated unique filename:', uniqueName);
        return path.join(savePath, uniqueName);
      }
    } catch (err) {
      const uniqueName = getUniqueFilename(savePath, `${sanitizedName}.ffp`);
      console.log('[CharacterStorage] Generated unique filename after error:', uniqueName);
      return path.join(savePath, uniqueName);
    }
  }

  console.log('[CharacterStorage] Using base file path:', baseFilePath);
  return baseFilePath;
}

// Helper function to sanitize filenames
function sanitizeFilename(name) {
  // Replace invalid characters with underscores
  return name
    .replace(/[\\/:*?"<>|]/g, '_') // Replace Windows invalid characters
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/[^\w\-\.]/g, '')     // Remove any other non-alphanumeric characters
    .trim();
}

// Helper function to get a user-friendly filename for a character
function getCharacterFilename(character) {
  if (!character || !character.name) {
    return `character_${character.id}.ffp`;
  }

  const sanitizedName = sanitizeFilename(character.name);
  return `${sanitizedName}.ffp`;
}

// Helper function to ensure unique filenames in a directory
function getUniqueFilename(directory, baseFilename) {
  if (!fs.existsSync(path.join(directory, baseFilename))) {
    return baseFilename; // File doesn't exist, so name is unique
  }

  // File exists, add a number suffix
  const fileExt = path.extname(baseFilename);
  const baseName = path.basename(baseFilename, fileExt);
  let counter = 1;
  let uniqueFilename = `${baseName}_${counter}${fileExt}`;

  while (fs.existsSync(path.join(directory, uniqueFilename))) {
    counter++;
    uniqueFilename = `${baseName}_${counter}${fileExt}`;
  }

  return uniqueFilename;
}

// Load characters
ipcMain.handle("loadCharacters", async () => {
  try {
    console.log('[CharacterStorage] Starting character load');
    // Get the save path
    const savePath = getCharactersFilePath();
    console.log('[CharacterStorage] Load path:', savePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
      console.log('[CharacterStorage] Created load directory');
      return []; // No characters yet
    }

    // Read all files in the directory
    const files = fs.readdirSync(savePath);
    console.log('[CharacterStorage] Found files:', files.length);

    // Filter for .ffp files and load each character
    const characters = [];
    const characterFiles = files.filter(file => file.endsWith('.ffp'));
    console.log('[CharacterStorage] Character files:', characterFiles.length);

    for (const file of characterFiles) {
      try {
        const filePath = path.join(savePath, file);
        const data = fs.readFileSync(filePath, "utf8");
        const character = JSON.parse(data);

        if (character?.id) {
          // Ensure allowedSources is an array
          if (character.allowedSources) {
            // If it's an empty object, convert to an array with default PHB
            if (Object.keys(character.allowedSources).length === 0) {
              character.allowedSources = ['PHB'];
              console.log('[CharacterStorage] Fixed empty allowedSources object:', character.allowedSources);
            }
            // If it's not already an array, convert it
            else if (!Array.isArray(character.allowedSources)) {
              character.allowedSources = Array.from(Object.keys(character.allowedSources));
              console.log('[CharacterStorage] Converted allowedSources to array:', character.allowedSources);
            }
          } else {
            // Default to PHB if missing
            character.allowedSources = ['PHB'];
            console.log('[CharacterStorage] Added default allowedSources:', character.allowedSources);
          }

          // Ensure lastModified is a valid date string
          if (!character.lastModified || Number.isNaN(new Date(character.lastModified).getTime())) {
            character.lastModified = new Date().toISOString();
            console.log('[CharacterStorage] Fixed invalid lastModified date:', character.lastModified);
          }

          console.log('[CharacterStorage] Loaded character:', {
            id: character.id,
            name: character.name,
            lastModified: character.lastModified,
            allowedSources: character.allowedSources
          });
          characters.push(character);
        }
      } catch (err) {
        console.error(`[CharacterStorage] Error reading character file ${file}:`, err);
      }
    }

    console.log('[CharacterStorage] Successfully loaded characters:', characters.length);
    return characters;
  } catch (error) {
    console.error("[CharacterStorage] Error loading characters:", error);
    return [];
  }
});

// Delete a character
ipcMain.handle("deleteCharacter", async (event, id) => {
  try {
    // Get the save path
    const savePath = getCharactersFilePath();

    // Find all .ffp files in the directory
    const files = fs.readdirSync(savePath).filter(file => file.endsWith('.ffp'));

    // Find the file that contains the character with the given ID
    for (const file of files) {
      try {
        const filePath = path.join(savePath, file);
        const data = fs.readFileSync(filePath, "utf8");
        const character = JSON.parse(data);

        if (character?.id === id) {
          // Delete the file
          fs.unlinkSync(filePath);
          console.log(`Deleted character file: ${filePath}`);
          return { success: true };
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err);
      }
    }

    return { success: false, error: "Character file not found" };
  } catch (error) {
    console.error("Error deleting character:", error);
    return { success: false, error: error.message };
  }
});

// Generate PDF from character data
ipcMain.handle("generatePDF", async (event, characterData) => {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter size
    const { width, height } = page.getSize();

    // Get the font
    const font = await pdfDoc.embedFont(PDFDocument.Helvetica);
    const fontSize = 12;

    // Helper function to write text
    const writeText = (text, x, y) => {
      page.drawText(text, {
        x,
        y: height - y, // Flip y-coordinate
        size: fontSize,
        font
      });
    };

    // Write character information
    writeText('D&D CHARACTER SHEET', 50, 50);
    writeText(`Character Name: ${characterData.name || 'N/A'}`, 50, 80);
    writeText(`Player Name: ${characterData.playerName || 'N/A'}`, 50, 100);
    writeText(`Race: ${characterData.race || 'N/A'}`, 50, 120);
    writeText(`Class: ${characterData.class || 'N/A'}`, 50, 140);
    writeText(`Level: ${characterData.level || 1}`, 50, 160);

    // Write ability scores
    writeText('ABILITY SCORES', 50, 190);
    const abilities = {
      'Strength': characterData.abilityScores.strength,
      'Dexterity': characterData.abilityScores.dexterity,
      'Constitution': characterData.abilityScores.constitution,
      'Intelligence': characterData.abilityScores.intelligence,
      'Wisdom': characterData.abilityScores.wisdom,
      'Charisma': characterData.abilityScores.charisma
    };

    let yPos = 210;
    for (const [ability, score] of Object.entries(abilities)) {
      const modifier = Math.floor((score - 10) / 2);
      writeText(`${ability}: ${score} (${modifier >= 0 ? '+' : ''}${modifier})`, 50, yPos);
      yPos += 20;
    }

    // Write background information
    writeText('BACKGROUND', 50, yPos + 20);
    writeText(`Background: ${characterData.background || 'N/A'}`, 50, yPos + 40);
    writeText(`Gender: ${characterData.gender || 'N/A'}`, 50, yPos + 60);
    writeText(`Height: ${characterData.height || 'N/A'}`, 50, yPos + 80);
    writeText(`Weight: ${characterData.weight || 'N/A'}`, 50, yPos + 100);

    // Write backstory
    if (characterData.backstory) {
      writeText('BACKSTORY', 50, yPos + 130);
      const words = characterData.backstory.split(' ');
      let line = '';
      let currentY = yPos + 150;

      for (const word of words) {
        const testLine = `${line + word} `;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > width - 100) {
          writeText(line, 50, currentY);
          line = `${word} `;
          currentY += 20;
        } else {
          line = testLine;
        }
      }
      if (line) {
        writeText(line, 50, currentY);
      }
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(app.getPath('temp'), `${characterData.name || 'character'}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    return { success: true, filePath: outputPath };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return { success: false, error: error.message };
  }
});

// Add UUID generation handler
ipcMain.handle("generateUUID", () => {
  return uuidv4();
});

// Add handler for opening files
ipcMain.handle("openFile", async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error("Error opening file:", error);
    return { success: false, error: error.message };
  }
});

// Export a character to a file
ipcMain.handle("exportCharacter", async (event, id) => {
  try {
    // Get the save path
    const savePath = userPreferences.characterSavePath || app.getPath("userData");

    // Find the character file
    const files = fs.readdirSync(savePath).filter(file => file.endsWith('.ffp'));
    let characterFilePath = null;
    let character = null;

    // Find the file that contains the character with the given ID
    for (const file of files) {
      try {
        const filePath = path.join(savePath, file);
        const data = fs.readFileSync(filePath, "utf8");
        const loadedCharacter = JSON.parse(data);

        if (loadedCharacter?.id === id) {
          characterFilePath = filePath;
          character = loadedCharacter;
          break;
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err);
      }
    }

    if (!characterFilePath || !character) {
      return { success: false, message: "Character file not found" };
    }

    // Read the character data
    const characterData = fs.readFileSync(characterFilePath, "utf8");

    // Generate a user-friendly filename for export
    const exportFilename = getCharacterFilename(character);

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: "Export Character",
      defaultPath: exportFilename,
      filters: [
        { name: "Character Files", extensions: ["ffp"] }
      ]
    });

    if (result.canceled) {
      return { success: false, message: "Export canceled" };
    }

    // Write the character data to the selected file
    fs.writeFileSync(result.filePath, characterData);

    return { success: true, message: "Character exported successfully" };
  } catch (error) {
    console.error("Error exporting character:", error);
    return { success: false, message: "Error exporting character" };
  }
});

// Import a character from a file
ipcMain.handle("importCharacter", async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Character Files", extensions: ["ffp", "json"] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "No files selected", type: 'warning' };
    }

    const savePath = getCharactersFilePath();

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    const importedCharacters = [];
    const failedImports = [];

    // Process each selected file
    for (const filePath of result.filePaths) {
      try {
        const fileData = fs.readFileSync(filePath, "utf8");
        let character;

        try {
          character = JSON.parse(fileData);
        } catch (parseError) {
          failedImports.push({ file: path.basename(filePath), reason: "Invalid JSON format" });
          continue;
        }

        // Validate the character data
        if (!character || !character.id || !character.name) {
          failedImports.push({ file: path.basename(filePath), reason: "Missing required character data" });
          continue;
        }

        // Add lastModified if it doesn't exist
        if (!character.lastModified) {
          character.lastModified = new Date().toISOString();
        }

        // Generate a user-friendly filename
        const baseFilename = getCharacterFilename(character);
        const uniqueFilename = getUniqueFilename(savePath, baseFilename);
        const characterFilePath = path.join(savePath, uniqueFilename);

        // Save the character to its own .ffp file
        fs.writeFileSync(characterFilePath, JSON.stringify(character, null, 2));

        // Add to successful imports
        importedCharacters.push(character);
        console.log(`Imported character: ${character.name} (${uniqueFilename})`);
      } catch (fileError) {
        failedImports.push({ file: path.basename(filePath), reason: fileError.message });
      }
    }

    // Return results
    if (importedCharacters.length > 0) {
      return {
        success: true,
        characters: importedCharacters,
        importCount: importedCharacters.length,
        failedCount: failedImports.length,
        failedImports: failedImports.length > 0 ? failedImports : undefined,
        type: failedImports.length > 0 ? 'warning' : 'success'
      };
    }

    if (failedImports.length > 0) {
      return {
        success: false,
        message: "All imports failed",
        failedImports,
        type: 'danger'
      };
    }

    return { success: false, message: "No characters were imported", type: 'warning' };
  } catch (error) {
    console.error("Error importing characters:", error);
    return { success: false, message: "Error importing characters", type: 'danger' };
  }
});

// Handle selecting a folder for character save location
ipcMain.handle("select-folder", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, message: "No folder selected" };
  } catch (error) {
    console.error("Error selecting folder:", error);
    return { success: false, message: "Error selecting folder" };
  }
});

// Get the default save path
ipcMain.handle('get-default-save-path', () => {
  // If user has set a custom path, return it
  if (userPreferences.characterSavePath) {
    return userPreferences.characterSavePath;
  }

  // Otherwise return the actual app data path
  return app.getPath("userData");
});

// Get the app data path
ipcMain.handle('get-app-data-path', () => {
  return app.getPath("userData");
});

// Set the character save path
ipcMain.handle("set-save-path", async (event, pathToSet) => {
  try {
    const oldPath = userPreferences.characterSavePath || app.getPath("userData");

    // Determine the new path (use default if null)
    const newPath = pathToSet || app.getPath("userData");

    // Don't do anything if the path hasn't changed
    if (oldPath === newPath) {
      return { success: true, message: "Save path unchanged" };
    }

    // Move character files from old path to new path
    const moveResult = await moveCharacterFiles(oldPath, newPath);

    // Update the user preferences with the new path
    userPreferences.characterSavePath = newPath;
    saveUserPreferences();

    // Return success with information about moved files
    if (moveResult.success) {
      if (moveResult.fileCount > 0) {
        return {
          success: true,
          message: `Save path updated and ${moveResult.filesMoved} files moved successfully`,
          filesMoved: moveResult.filesMoved,
          filesCopied: moveResult.filesCopied,
          fileCount: moveResult.fileCount
        };
      }

      return { success: true, message: "Save path updated successfully" };
    }

    // Even if file moving failed, we still updated the path
    return {
      success: true,
      message: `Save path updated but file migration failed: ${moveResult.message}`,
      warning: true
    };
  } catch (error) {
    console.error("Error setting save path:", error);
    return { success: false, message: `Error: ${error.message}` };
  }
});

// Read JSON file from app directory
ipcMain.handle('read-json-file', async (event, filePath) => {
  try {
    console.log(`Reading JSON file: ${filePath}`);

    // Ensure the path is relative to the app directory
    const fullPath = path.join(__dirname, filePath);
    console.log(`Full path: ${fullPath}`);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      throw new Error(`File not found: ${filePath}`);
    }

    // Read and parse the file
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    console.log(`Successfully read JSON file: ${filePath}`);

    return jsonData;
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    throw error;
  }
});

// Load JSON file for DataUtil (handles data/ directory paths)
ipcMain.handle('loadJSON', async (event, filePath) => {
  try {
    // The filePath comes as "data/..." from DataUtil
    // We need to resolve it relative to the app directory
    const fullPath = path.join(__dirname, filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`JSON file not found: ${fullPath}`);
      throw new Error(`File not found: ${filePath}`);
    }

    // Read and parse the file
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    return jsonData;
  } catch (error) {
    console.error(`Error loading JSON file ${filePath}:`, error);
    throw error;
  }
});

// Create the main window and handle app activation when ready
app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});