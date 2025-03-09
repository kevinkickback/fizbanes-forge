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

// Export settings initialization function
window.initializeSettingsPage = initializeSettings;

// Setup ability scores
function setupAbilityScores() {
  // Get ability score inputs
  const abilityScores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

  abilityScores.forEach(ability => {
    const input = document.getElementById(`${ability}Score`);
    if (input) {
      // Remove any existing listeners
      const newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);

      // Add new listener
      newInput.addEventListener('change', (e) => {
        if (window.currentCharacter) {
          window.currentCharacter.abilityScores = window.currentCharacter.abilityScores || {};
          window.currentCharacter.abilityScores[ability] = parseInt(e.target.value) || 0;
          markUnsavedChanges();
        }
      });

      // Set initial value if character exists
      if (window.currentCharacter?.abilityScores?.[ability]) {
        newInput.value = window.currentCharacter.abilityScores[ability];
      }
    }
  });
}

// Setup proficiencies
function setupProficiencies() {
  // Get proficiency checkboxes
  const proficiencyTypes = ['skills', 'tools', 'weapons', 'armor'];

  proficiencyTypes.forEach(type => {
    const container = document.getElementById(`${type}Container`);
    if (container) {
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        // Remove any existing listeners
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);

        // Add new listener
        newCheckbox.addEventListener('change', (e) => {
          if (window.currentCharacter) {
            const proficiencyId = e.target.getAttribute('data-proficiency-id');
            if (e.target.checked) {
              window.currentCharacter.addProficiency(type, proficiencyId, 'Character');
            } else {
              window.currentCharacter.removeProficiency(type, proficiencyId, 'Character');
            }
            markUnsavedChanges();
          }
        });

        // Set initial state if character exists
        if (window.currentCharacter?.proficiencies?.[type]) {
          const proficiencyId = newCheckbox.getAttribute('data-proficiency-id');
          newCheckbox.checked = window.currentCharacter.proficiencies[type].includes(proficiencyId);
        }
      });
    }
  });
}

// Setup optional proficiencies
function setupOptionalProficiencies() {
  const optionalContainer = document.getElementById('optionalProficienciesContainer');
  if (optionalContainer) {
    const selects = optionalContainer.querySelectorAll('select');
    selects.forEach(select => {
      // Remove any existing listeners
      const newSelect = select.cloneNode(true);
      select.parentNode.replaceChild(newSelect, select);

      // Add new listener
      newSelect.addEventListener('change', (e) => {
        if (window.currentCharacter) {
          const type = e.target.getAttribute('data-proficiency-type');
          const source = e.target.getAttribute('data-source');
          const oldValue = e.target.getAttribute('data-current-value');
          const newValue = e.target.value;

          if (oldValue) {
            window.currentCharacter.removeProficiency(type, oldValue, source);
          }
          if (newValue) {
            window.currentCharacter.addProficiency(type, newValue, source);
            e.target.setAttribute('data-current-value', newValue);
          }
          markUnsavedChanges();
        }
      });

      // Set initial value if character exists
      if (window.currentCharacter?.optionalProficiencies) {
        const type = newSelect.getAttribute('data-proficiency-type');
        const source = newSelect.getAttribute('data-source');
        const currentValue = window.currentCharacter.optionalProficiencies[`${type}-${source}`];
        if (currentValue) {
          newSelect.value = currentValue;
          newSelect.setAttribute('data-current-value', currentValue);
        }
      }
    });
  }
}

// Make functions available globally
window.setupAbilityScores = setupAbilityScores;
window.setupProficiencies = setupProficiencies;
window.setupOptionalProficiencies = setupOptionalProficiencies;

// Initialize the application
function initializeApp() {
  console.log('initializeApp called');
  // Check if all required scripts are loaded
  if (!window.DataLoader) {
    console.error('DataLoader not loaded');
    return;
  }

  // Initialize floating action buttons
  const saveBtn = document.getElementById('saveCharacter');
  const previewBtn = document.getElementById('previewCharacter');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (window.currentCharacter) {
        try {
          // Helper functions to safely convert Maps and Sets
          const mapToObject = (map) => {
            if (!map) return {};
            if (map instanceof Map) return Object.fromEntries(map);
            if (typeof map === 'object') return map;
            return {};
          };

          const setToArray = (set) => {
            if (!set) return [];
            if (set instanceof Set) return Array.from(set);
            if (Array.isArray(set)) return set;
            return [];
          };

          // Create a serializable version of the character
          const serializableCharacter = {
            id: window.currentCharacter.id,
            name: window.currentCharacter.name,
            playerName: window.currentCharacter.playerName,
            level: window.currentCharacter.level,
            abilityScores: { ...window.currentCharacter.abilityScores },
            abilityBonuses: { ...window.currentCharacter.abilityBonuses },
            size: window.currentCharacter.size,
            speed: { ...window.currentCharacter.speed },
            features: {
              darkvision: window.currentCharacter.features.darkvision,
              resistances: setToArray(window.currentCharacter.features.resistances),
              traits: mapToObject(window.currentCharacter.features.traits)
            },
            proficiencies: {
              armor: setToArray(window.currentCharacter.proficiencies.armor),
              weapons: setToArray(window.currentCharacter.proficiencies.weapons),
              tools: setToArray(window.currentCharacter.proficiencies.tools),
              skills: setToArray(window.currentCharacter.proficiencies.skills),
              languages: setToArray(window.currentCharacter.proficiencies.languages)
            },
            proficiencySources: {
              armor: mapToObject(window.currentCharacter.proficiencySources.armor),
              weapons: mapToObject(window.currentCharacter.proficiencySources.weapons),
              tools: mapToObject(window.currentCharacter.proficiencySources.tools),
              skills: mapToObject(window.currentCharacter.proficiencySources.skills),
              languages: mapToObject(window.currentCharacter.proficiencySources.languages)
            },
            equipment: {
              inventory: mapToObject(window.currentCharacter.equipment.inventoryManager?.inventory),
              equipped: setToArray(window.currentCharacter.equipment.equipped),
              attuned: setToArray(window.currentCharacter.equipment.attunementManager?.attuned)
            },
            characteristics: {
              personalityTrait: window.currentCharacter.characteristics.characteristics.personalityTrait,
              ideal: window.currentCharacter.characteristics.characteristics.ideal,
              bond: window.currentCharacter.characteristics.characteristics.bond,
              flaw: window.currentCharacter.characteristics.characteristics.flaw
            },
            race: window.currentCharacter.race.selectedRace,
            class: window.currentCharacter.class.selectedClass,
            background: window.currentCharacter.background.selectedBackground,
            spells: {
              knownSpells: mapToObject(window.currentCharacter.spells.knownSpells),
              preparedSpells: setToArray(window.currentCharacter.spells.preparedSpells),
              spellSlots: { ...window.currentCharacter.spells.spellSlots },
              slotsUsed: { ...window.currentCharacter.spells.slotsUsed },
              cantripCount: window.currentCharacter.spells.cantripCount
            },
            feats: {
              feats: mapToObject(window.currentCharacter.feats.feats),
              optionalFeatures: mapToObject(window.currentCharacter.feats.optionalFeatures),
              maxFeats: window.currentCharacter.feats.maxFeats
            },
            optionalFeatures: mapToObject(window.currentCharacter.optionalFeatures.features),
            height: window.currentCharacter.height,
            weight: window.currentCharacter.weight,
            gender: window.currentCharacter.gender,
            backstory: window.currentCharacter.backstory,
            lastModified: new Date().toISOString()
          };

          const result = await window.characterStorage.saveCharacter(serializableCharacter);
          if (result.success) {
            window.showNotification('Character saved successfully', 'success');
            // Clear unsaved changes indicator
            if (window.clearUnsavedChanges) window.clearUnsavedChanges();
          } else {
            window.showNotification(result.message || 'Failed to save character', 'danger');
          }
        } catch (error) {
          console.error('Error saving character:', error);
          window.showNotification('Error saving character: ' + error.message, 'danger');
        }
      } else {
        window.showNotification('No character selected', 'warning');
      }
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (window.generateCharacterSheet) window.generateCharacterSheet();
    });
  }

  // Call updateNavigation initially
  updateNavigation();

  // Initialize navigation
  const navButtons = document.querySelectorAll('.nav-link');
  for (const button of navButtons) {
    button.addEventListener('click', (e) => {
      // Check if the button is disabled
      if (button.classList.contains('disabled')) {
        e.preventDefault();
        e.stopPropagation();
        showNotification('Please select or create a character first', 'warning');
        return; // Exit early without applying active class or loading page
      }

      // Only proceed with navigation if the button is not disabled
      // Remove active class from all buttons
      for (const btn of navButtons) {
        btn.classList.remove('active');
      }
      // Add active class to clicked button
      button.classList.add('active');
      // Load the page content
      const page = button.getAttribute('data-page');
      app.loadPage(page);
    });
  }

  // Load initial page
  app.loadPage('home');
}

// Export initialization function
window.initializeApp = initializeApp;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded event fired');

  // Initialize core components
  await Promise.all([
    // Initialize tooltips first
    import('./core/managers/TooltipManager.js').then(module => {
      window.tooltipManager = module.tooltipManager;
      window.tooltipManager.initialize();
    }),
    // Initialize data loader
    import('./core/utils/DataLoader.js').then(module => {
      window.dndDataLoader = module.DataLoader.initialize();
    })
  ]);

  // Wait for a longer time to ensure all modules are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if required modules are loaded
  console.log('Checking for required modules...');
  const requiredModules = {
    tooltipManager: !!window.tooltipManager,
    dataLoader: !!window.dndDataLoader,
    loadCharacters: !!window.loadCharacters,
    initializeCharacterApp: !!window.initializeCharacterApp,
    RaceManager: !!window.RaceManager,
    ClassManager: !!window.ClassManager
  };

  console.log('Module status:', requiredModules);

  // Check if all required modules are loaded
  const allModulesLoaded = Object.values(requiredModules).every(Boolean);

  if (allModulesLoaded) {
    console.log('All required modules loaded, initializing app...');
    window.initializeApp();
    app.loadPage('home');
  } else {
    console.error('Some required modules not loaded:', requiredModules);
    // Try again after another delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (window.tooltipManager && window.dndDataLoader && window.loadCharacters && window.initializeCharacterApp) {
      console.log('Modules loaded after second attempt, initializing app...');
      window.initializeApp();
      app.loadPage('home');
    } else {
      console.error('Failed to load required modules after second attempt');
      showNotification('Error loading application modules', 'danger');
    }
  }
});

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