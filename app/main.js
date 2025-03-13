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
    console.log("Loaded user preferences:", userPreferences);
  }
} catch (error) {
  console.error("Error loading user preferences:", error);
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    resizable: true,
    icon: path.resolve(__dirname, 'img', 'icon.ico'),
    webPreferences: {
      sandbox: false,
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      devTools: true,
      preload: path.join(__dirname, 'js', 'preload.js')
    }
  });

  // Enable DevTools
  mainWindow.webContents.openDevTools();

  // Add keyboard shortcut to toggle DevTools (Ctrl+Shift+I or Cmd+Option+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Show and focus mainWindow after loading
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load HTML file
  mainWindow.loadFile(path.join(__dirname, 'test.html'));

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
    console.log("Saved user preferences:", userPreferences);
  } catch (error) {
    console.error("Error saving user preferences:", error);
  }
}

// Move character files from one location to another
async function moveCharacterFiles(oldPath, newPath) {
  try {
    if (!oldPath || !newPath || oldPath === newPath) {
      return { success: false, message: "Invalid paths provided" };
    }

    // Check if source directory exists
    if (!fs.existsSync(oldPath)) {
      return { success: false, message: "Source directory does not exist" };
    }

    // Check if destination directory exists, create if not
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }

    // Find all .ffp files in the old directory
    const files = fs.readdirSync(oldPath).filter(file => file.endsWith('.ffp'));

    if (files.length === 0) {
      return { success: true, message: "No character files found to move", fileCount: 0 };
    }

    console.log(`Found ${files.length} .ffp files in ${oldPath}`);

    // Copy all .ffp files to the new location
    let filesCopied = 0;
    let filesMoved = 0;
    const results = [];

    for (const file of files) {
      try {
        const oldFilePath = path.join(oldPath, file);
        const newFilePath = path.join(newPath, file);

        // Read the file content
        const fileContent = fs.readFileSync(oldFilePath, 'utf8');

        // Write to the new location
        fs.writeFileSync(newFilePath, fileContent);
        filesCopied++;
        console.log(`Successfully copied file to: ${newFilePath}`);

        // Verify the file was copied correctly
        if (fs.existsSync(newFilePath)) {
          // Try to delete the original file
          try {
            fs.unlinkSync(oldFilePath);
            filesMoved++;
            console.log(`Deleted original file: ${oldFilePath}`);
          } catch (deleteErr) {
            console.warn(`Could not delete original file ${oldFilePath}: ${deleteErr.message}`);
            results.push(`Copied but could not delete: ${file}`);
          }
        } else {
          results.push(`Failed to verify copy: ${file}`);
        }
      } catch (copyErr) {
        console.error(`Error copying file ${file}: ${copyErr.message}`);
        results.push(`Failed to copy: ${file}`);
      }
    }

    return {
      success: true,
      message: `Moved ${filesMoved} files, copied ${filesCopied} files`,
      fileCount: files.length,
      filesMoved,
      filesCopied,
      details: results.length > 0 ? results : undefined
    };
  } catch (error) {
    console.error("Error moving character files:", error);
    return { success: false, message: `Error: ${error.message}`, fileCount: 0 };
  }
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

// Save character data
ipcMain.handle("saveCharacter", async (event, character) => {
  try {
    console.log('Received character for saving:', character);
    console.log('Character ID:', character.id);
    console.log('Character name:', character.name);

    // Validate character data
    if (!character || !character.id) {
      throw new Error('Invalid character data: missing ID');
    }

    // Get the save path
    const savePath = getCharactersFilePath();
    console.log('Save path:', savePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }

    // First, try to find an existing file for this character ID
    let existingFilePath = null;
    const files = fs.readdirSync(savePath).filter(file => file.endsWith('.ffp'));
    for (const file of files) {
      try {
        const filePath = path.join(savePath, file);
        const data = fs.readFileSync(filePath, "utf8");
        const existingCharacter = JSON.parse(data);
        if (existingCharacter?.id === character.id) {
          existingFilePath = filePath;
          break;
        }
      } catch (err) {
        console.error(`Error checking file ${file}:`, err);
      }
    }

    // Generate the base filename
    const sanitizedName = sanitizeFilename(character.name || 'character');
    let targetFilePath;

    if (existingFilePath) {
      // Use the existing file path to maintain consistency
      targetFilePath = existingFilePath;
    } else {
      // Check if a file with this name exists but has a different character ID
      const baseFilePath = path.join(savePath, `${sanitizedName}.ffp`);
      if (fs.existsSync(baseFilePath)) {
        try {
          const data = fs.readFileSync(baseFilePath, "utf8");
          const existingCharacter = JSON.parse(data);
          if (existingCharacter?.id !== character.id) {
            // File exists but belongs to a different character, generate unique name
            const uniqueName = getUniqueFilename(savePath, `${sanitizedName}.ffp`);
            targetFilePath = path.join(savePath, uniqueName);
          } else {
            targetFilePath = baseFilePath;
          }
        } catch (err) {
          // If we can't read the file, treat it as a different character's file
          const uniqueName = getUniqueFilename(savePath, `${sanitizedName}.ffp`);
          targetFilePath = path.join(savePath, uniqueName);
        }
      } else {
        // No file exists with this name, use it
        targetFilePath = baseFilePath;
      }
    }

    // Save the character
    const characterData = JSON.stringify(character, null, 2);
    fs.writeFileSync(targetFilePath, characterData);
    console.log(`Character saved successfully to: ${targetFilePath}`);

    return { success: true, message: "Character saved successfully" };
  } catch (error) {
    console.error("Error saving character:", error);
    return { success: false, message: `Failed to save character: ${error.message}` };
  }
});

// Load characters
ipcMain.handle("loadCharacters", async () => {
  try {
    // Get the save path
    const savePath = getCharactersFilePath();

    // Create directory if it doesn't exist
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
      return []; // No characters yet
    }

    // Read all files in the directory
    const files = fs.readdirSync(savePath);

    // Filter for .ffp files and load each character
    const characters = [];
    const characterFiles = files.filter(file => file.endsWith('.ffp'));

    for (const file of characterFiles) {
      try {
        const filePath = path.join(savePath, file);
        const data = fs.readFileSync(filePath, "utf8");
        const character = JSON.parse(data);

        if (character?.id) {
          characters.push(character);
        }
      } catch (err) {
        console.error(`Error reading character file ${file}:`, err);
      }
    }

    return characters;
  } catch (error) {
    console.error("Error loading characters:", error);
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
      return { success: false, message: "No files selected" };
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
        failedImports: failedImports.length > 0 ? failedImports : undefined
      };
    }

    if (failedImports.length > 0) {
      return {
        success: false,
        message: "All imports failed",
        failedImports
      };
    }

    return { success: false, message: "No characters were imported" };
  } catch (error) {
    console.error("Error importing characters:", error);
    return { success: false, message: "Error importing characters" };
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