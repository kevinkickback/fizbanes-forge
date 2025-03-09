// Utility functions

// Import the TooltipManager
import { tooltipManager } from './core/managers/TooltipManager.js';

// Initialize app namespace
const app = {
  currentPage: 'home',
  // Track last notification to prevent duplicates
  lastNotification: { message: '', type: '', timestamp: 0 },
  loadPage: (pageName) => {
    console.log('loadPage called with:', pageName);
    // Prevent navigation to character pages if no character is selected
    if (['build', 'equipment', 'details'].includes(pageName) && (!window.currentCharacter || !window.currentCharacter.id)) {
      showNotification('Please select or create a character first', 'warning');
      return;
    }

    const pageContent = document.getElementById('pageContent');
    const template = document.getElementById(`${pageName}Page`);
    console.log('Found template:', template ? 'yes' : 'no');

    if (template) {
      pageContent.innerHTML = '';
      pageContent.appendChild(template.content.cloneNode(true));

      // Update body attribute for page-specific styling
      document.body.setAttribute('data-current-page', pageName);

      // Initialize page-specific functionality
      console.log('Initializing page:', pageName);
      switch (pageName) {
        case 'home':
          console.log('Home page - loadCharacters exists:', !!window.loadCharacters);
          console.log('Home page - initializeCharacterApp exists:', !!window.initializeCharacterApp);
          if (window.loadCharacters) window.loadCharacters();
          // Reattach event listeners for the home page buttons
          if (window.initializeCharacterApp) window.initializeCharacterApp();
          break;
        case 'build':
          if (window.initializeBuildPage) window.initializeBuildPage();
          break;
        case 'equipment':
          // Use existing equipment managers if they exist, only initialize if they don't
          if (window.currentCharacter) {
            if (!window.currentCharacter.equipmentManager) {
              window.currentCharacter.equipmentManager = new EquipmentManager(window.currentCharacter);
            }
            if (!window.currentCharacter.inventoryManager) {
              window.currentCharacter.inventoryManager = new InventoryManager(window.currentCharacter);
            }
            if (!window.currentCharacter.attunementManager) {
              window.currentCharacter.attunementManager = new AttunementManager(window.currentCharacter);
            }

            // Initialize equipment page with existing managers
            if (window.initializeEquipmentPage) {
              window.initializeEquipmentPage(
                window.currentCharacter.equipmentManager,
                window.currentCharacter.inventoryManager,
                window.currentCharacter.attunementManager
              );
            }
          }
          break;
        case 'details':
          console.log('Details page - initializeDetailsPage exists:', !!window.initializeDetailsPage);
          if (window.initializeDetailsPage) window.initializeDetailsPage();
          break;
        case 'preview':
          if (window.initializePreviewPage) window.initializePreviewPage();
          break;
        case 'settings':
          if (window.initializeSettingsPage) window.initializeSettingsPage();
          break;
        case 'tests':
          if (window.tests?.initialize) window.tests.initialize();
          break;
        case 'tooltipTest':
          // Initialize text processing for tooltip test page
          const textProcessor = window.dndTextProcessor;
          const elements = document.querySelectorAll('.tooltip-test-content p');
          for (const element of elements) {
            const originalText = element.innerHTML;
            textProcessor.processText(originalText).then(processedText => {
              element.innerHTML = processedText;
            });
          }
          break;
      }

      // Update current page
      app.currentPage = pageName;
    }
  }
};

// Export app object
window.app = app;

// Add function to update navigation state based on character selection
function updateNavigation() {
  // Check if currentCharacter exists and has an id using optional chaining
  const hasCharacter = window.currentCharacter?.id != null;
  const characterPages = ['build', 'equipment', 'details'];

  // Get all navigation links
  const navButtons = document.querySelectorAll('.nav-link');

  // Update disabled state for character-specific pages
  for (const button of navButtons) {
    const page = button.getAttribute('data-page');
    if (characterPages.includes(page)) {
      if (hasCharacter) {
        button.classList.remove('disabled');
      } else {
        button.classList.add('disabled');
      }
    }
  }

  // Update character actions visibility
  const characterActions = document.getElementById('characterActions');
  if (characterActions) {
    characterActions.style.display = hasCharacter ? 'flex' : 'none';
  }

  // Log the current state for debugging
  console.log('Navigation updated. Has character:', hasCharacter);
}

// Make updateNavigation available globally
window.updateNavigation = updateNavigation;

// Initialize settings page
function initializeSettings() {
  const chooseFolderBtn = document.getElementById('chooseFolderBtn');
  const resetFolderBtn = document.getElementById('resetFolderBtn');
  const currentSaveLocation = document.getElementById('currentSaveLocation');
  let defaultSavePath = '';
  let currentPath = '';

  if (!chooseFolderBtn || !currentSaveLocation || !resetFolderBtn) {
    return; // Required elements not found
  }

  // Remove any existing event listeners to prevent duplicates
  chooseFolderBtn.replaceWith(chooseFolderBtn.cloneNode(true));
  resetFolderBtn.replaceWith(resetFolderBtn.cloneNode(true));

  // Get fresh references after cloning
  const newChooseFolderBtn = document.getElementById('chooseFolderBtn');
  const newResetFolderBtn = document.getElementById('resetFolderBtn');

  // Function to update the save location display
  const updateSaveLocation = async () => {
    try {
      // Get the actual app data path
      const appDataPath = await window.electron.app.getPath("userData");

      // Get the user's preferred save path
      const defaultPath = await window.electron.ipc.invoke('get-default-save-path');
      currentPath = defaultPath; // Store for later use

      if (defaultPath) {
        // User has set a custom path
        currentSaveLocation.textContent = defaultPath;
        defaultSavePath = defaultPath;
        // Cache the path in localStorage for quick access
        localStorage.setItem('characterSavePath', defaultPath);
      } else {
        // Using default path - show the actual path instead of "Application Data Directory"
        currentSaveLocation.textContent = appDataPath;
        defaultSavePath = appDataPath;
        currentPath = appDataPath; // Store for later use
        localStorage.removeItem('characterSavePath');
      }
    } catch (err) {
      console.error('Error getting save paths:', err);
      currentSaveLocation.textContent = 'Error getting save path';
    }
  };

  // Call the function to update the save location display
  updateSaveLocation();

  // Handle folder selection
  newChooseFolderBtn.addEventListener('click', async () => {
    try {
      const result = await window.characterStorage.selectFolder();

      if (result.success) {
        // Update the display with the selected path
        currentSaveLocation.textContent = result.path;

        // Cache the path in localStorage
        localStorage.setItem("characterSavePath", result.path);

        // Update the path in preferences and handle file migration
        const saveResult = await window.characterStorage.setSavePath(result.path);

        // Show notification based on the result
        if (saveResult.warnings) {
          showNotification(saveResult.warnings, "warning");
        }

        if (saveResult.success) {
          let message = "Save location updated.";
          if (saveResult.filesMoved > 0) {
            message += `\n${saveResult.filesMoved} files moved.`;
          }
          showNotification(message, "success");

          // Reload characters to reflect the new save location
          if (window.loadCharacters) {
            window.loadCharacters();
          }
        }

        // Update the current path variable
        currentPath = result.path;
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      showNotification("Failed to select folder", "danger");
    }
  });

  // Handle reset button
  newResetFolderBtn.addEventListener('click', async () => {
    try {
      // Get the default user data path
      const defaultPath = await window.electron.app.getPath("userData");

      // Update the display immediately
      currentSaveLocation.textContent = defaultPath;

      // Reset the path in preferences (null will reset to default)
      const saveResult = await window.characterStorage.setSavePath(null);

      // Clear the cached path
      localStorage.removeItem("characterSavePath");

      // Update the current path variable
      currentPath = defaultPath;

      // Show notification based on the result
      if (saveResult.warnings) {
        showNotification(saveResult.warnings, "warning");
      }

      if (saveResult.success) {
        let message = "Save location reset to default";
        if (saveResult.filesMoved > 0) {
          message += `. ${saveResult.filesMoved} files moved.`;
        }
        showNotification(message, "success");

        // Reload characters to reflect the new save location
        if (window.loadCharacters) {
          window.loadCharacters();
        }
      }
    } catch (error) {
      console.error("Error resetting to default path:", error);
      showNotification("Failed to reset save location", "danger");
    }
  });
}

// Show notification
function showNotification(message, type = 'info') {
  const notificationContainer = document.getElementById('notificationContainer');
  if (!notificationContainer) return;

  // Check if there's already a notification with the same message and type
  const existingNotification = Array.from(notificationContainer.children).find(
    notification => notification.textContent === message && notification.classList.contains(type)
  );

  // If an identical notification exists, don't create a new one
  if (existingNotification) {
    return;
  }

  // Prevent duplicate notifications within 1 second
  const now = Date.now();
  const lastNotif = app.lastNotification;
  if (lastNotif.message === message && lastNotif.type === type && (now - lastNotif.timestamp) < 1000) {
    return; // Skip duplicate notification
  }

  // Update last notification
  app.lastNotification = { message, type, timestamp: now };

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  notificationContainer.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 3000);
}

// Make the function available globally
window.showNotification = showNotification;

// Format ability score modifier
function formatModifier(score) {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : modifier.toString();
}

// Capitalize first letter of each word
function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Deep clone an object
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Validate required fields
function validateRequiredFields(fields) {
  for (const [field, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      showNotification(`${capitalizeWords(field.replace(/([A-Z])/g, ' $1'))} is required`, 'danger');
      return false;
    }
  }
  return true;
}

// Setup form listeners
function setupFormListeners() {
  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.matches('#characterName, #playerName, #height, #weight, #gender, #backstory, #backgroundSelect')) {
      updateCharacterField(e);
    }
  });
}

// Update character field when form changes
function updateCharacterField(event) {
  if (!window.currentCharacter) return;

  const field = event.target.id;
  const value = event.target.value;

  // Update the character object
  if (field === 'characterName') {
    window.currentCharacter.name = value;
    // Update character name in UI if displayed
    const characterNameDisplay = document.querySelector('.character-card.selected .card-title');
    if (characterNameDisplay) {
      characterNameDisplay.textContent = value;
    }
  } else {
    window.currentCharacter[field] = value;
  }

  // Mark changes as unsaved
  markUnsavedChanges();

  // Log the update
  console.log(`Updated ${field} to:`, value);
}

// Track unsaved changes
function markUnsavedChanges() {
  const indicator = document.getElementById('unsavedChangesIndicator');
  if (indicator) {
    indicator.style.display = 'inline-block';
  }
}

function clearUnsavedChanges() {
  const indicator = document.getElementById('unsavedChangesIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// Export to global scope for non-module scripts
window.showNotification = showNotification;
window.formatModifier = formatModifier;
window.capitalizeWords = capitalizeWords;
window.deepClone = deepClone;
window.validateRequiredFields = validateRequiredFields;
window.initializeSettingsPage = initializeSettings;
window.initializeApp = initializeApp;
window.setupFormListeners = setupFormListeners;
window.updateCharacterField = updateCharacterField;
window.markUnsavedChanges = markUnsavedChanges;
window.clearUnsavedChanges = clearUnsavedChanges;

// Export as ES module
export {
  app,
  updateNavigation,
  showNotification,
  formatModifier,
  capitalizeWords,
  deepClone,
  validateRequiredFields,
  initializeSettings,
  initializeApp,
  setupFormListeners,
  updateCharacterField,
  markUnsavedChanges,
  clearUnsavedChanges
};