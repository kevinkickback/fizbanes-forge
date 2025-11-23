/**
 * Main process entry point for Fizbane''s Forge.
 * 
 * REFACTORED: Phase 2 - Main process split into modular components
 * 
 * This file now serves as the application entry point only, delegating
 * responsibilities to specialized managers and handlers.
 */

const { app } = require("electron");
const path = require("node:path");
const { WindowManager } = require("./electron/WindowManager");
const { PreferencesManager } = require("./electron/PreferencesManager");
const { IPCRegistry } = require("./electron/ipc/IPCRegistry");

let windowManager;
let preferencesManager;
let ipcRegistry;

app.whenReady().then(() => {
console.log("[App] Application ready");

// Initialize managers
preferencesManager = new PreferencesManager(app);
windowManager = new WindowManager(preferencesManager, __dirname);
ipcRegistry = new IPCRegistry(preferencesManager, windowManager, __dirname);

// Register all IPC handlers
ipcRegistry.registerAll();

// Create main window
windowManager.createMainWindow();

console.log("[App] Application initialized");
});

app.on("window-all-closed", () => {
console.log("[App] All windows closed");
if (process.platform !== "darwin") {
app.quit();
}
});

app.on("activate", () => {
console.log("[App] Application activated");
if (!windowManager.hasWindow()) {
windowManager.createMainWindow();
}
});

app.on("before-quit", () => {
console.log("[App] Application quitting");
});
