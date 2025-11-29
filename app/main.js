/**
 * Main process entry point for Fizbane''s Forge.
 * 
 * REFACTORED: Phase 2 - Main process split into modular components
 * 
 * This file now serves as the application entry point only, delegating
 * responsibilities to specialized managers and handlers.
 */

const { app } = require("electron");
const { WindowManager } = require("./electron/WindowManager");
const { PreferencesManager } = require("./electron/PreferencesManager");
const { IPCRegistry } = require("./electron/ipc/IPCRegistry");
const { MainLogger } = require("./electron/MainLogger");

// Debug mode - controlled via environment variable `FF_DEBUG`
const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;

let windowManager;
let preferencesManager;
let ipcRegistry;

app.whenReady().then(() => {
  MainLogger.info('App', 'Application ready');

  // Initialize managers
  preferencesManager = new PreferencesManager(app);
  windowManager = new WindowManager(preferencesManager, __dirname, DEBUG_MODE);
  ipcRegistry = new IPCRegistry(preferencesManager, windowManager, __dirname);

  // Register all IPC handlers
  ipcRegistry.registerAll();

  // Create main window
  windowManager.createMainWindow();

  MainLogger.info('App', 'Application initialized');
});

app.on("window-all-closed", () => {
  MainLogger.info('App', 'All windows closed');
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  MainLogger.info('App', 'Application activated');
  if (!windowManager.hasWindow()) {
    windowManager.createMainWindow();
  }
});

app.on("before-quit", () => {
  MainLogger.info('App', 'Application quitting');
});
