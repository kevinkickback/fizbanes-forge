/**
 * Manages Electron BrowserWindow lifecycle.
 * 
 * ARCHITECTURE: Main Process - Window Management
 * 
 * PURPOSE:
 * - Create and configure main window
 * - Handle window events (close, resize, move)
 * - Save/restore window state
 * - Manage window lifecycle
 * 
 * USAGE:
 *   const wm = new WindowManager(preferencesManager, __dirname);
 *   const mainWindow = wm.createMainWindow();
 * 
 * @module electron/WindowManager
 */

const { BrowserWindow } = require("electron");
const path = require("node:path");

class WindowManager {
    constructor(preferencesManager, appPath, debugMode = false) {
        this.preferencesManager = preferencesManager;
        this.appPath = appPath;
        this.debugMode = debugMode;
        this.mainWindow = null;
    }

    /**
     * Create the main application window.
     * @returns {BrowserWindow} The created window
     */
    createMainWindow() {
        console.log("[WindowManager] Creating main window");

        // Get saved window bounds
        const bounds = this.preferencesManager.getWindowBounds();

        // Create window with saved bounds
        this.mainWindow = new BrowserWindow({
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            minWidth: 800,
            minHeight: 600,
            autoHideMenuBar: true, // Hide default Electron menu bar
            webPreferences: {
                preload: path.join(this.appPath, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
            show: false, // Don't show until ready
        });

        // Open DevTools immediately in debug mode (before loading)
        if (this.debugMode) {
            console.log("[WindowManager] Opening DevTools (debug mode enabled)");
            this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        }

        // Load the app
        this.mainWindow.loadFile(path.join(this.appPath, "index.html"));

        // Show window when ready
        this.mainWindow.once("ready-to-show", () => {
            console.log("[WindowManager] Window ready to show");
            this.mainWindow.show();
        });

        // Setup window event handlers
        this.setupWindowEvents();

        console.log("[WindowManager] Main window created");
        return this.mainWindow;
    }

    /**
     * Setup window event handlers.
     * @private
     */
    setupWindowEvents() {
        // Save window bounds on close
        this.mainWindow.on("close", () => {
            const bounds = this.mainWindow.getBounds();
            this.preferencesManager.setWindowBounds(bounds);
            console.log("[WindowManager] Window bounds saved:", bounds);
        });

        // Handle window closed
        this.mainWindow.on("closed", () => {
            console.log("[WindowManager] Window closed");
            this.mainWindow = null;
        });

        // Optional: Log window events for debugging
        this.mainWindow.on("resize", () => {
            // Don't log every resize, too noisy
        });

        this.mainWindow.on("move", () => {
            // Don't log every move, too noisy
        });

        this.mainWindow.on("focus", () => {
            console.log("[WindowManager] Window focused");
        });

        this.mainWindow.on("blur", () => {
            console.log("[WindowManager] Window blurred");
        });
    }

    /**
     * Get the main window instance.
     * @returns {BrowserWindow|null} Main window or null
     */
    getMainWindow() {
        return this.mainWindow;
    }

    /**
     * Check if main window exists and is not destroyed.
     * @returns {boolean} True if window exists
     */
    hasWindow() {
        return this.mainWindow !== null && !this.mainWindow.isDestroyed();
    }

    /**
     * Close the main window.
     */
    closeWindow() {
        if (this.hasWindow()) {
            console.log("[WindowManager] Closing window");
            this.mainWindow.close();
        }
    }

    /**
     * Minimize the main window.
     */
    minimizeWindow() {
        if (this.hasWindow()) {
            this.mainWindow.minimize();
        }
    }

    /**
     * Maximize the main window.
     */
    maximizeWindow() {
        if (this.hasWindow()) {
            if (this.mainWindow.isMaximized()) {
                this.mainWindow.unmaximize();
            } else {
                this.mainWindow.maximize();
            }
        }
    }

    /**
     * Open DevTools.
     */
    openDevTools() {
        if (this.hasWindow()) {
            this.mainWindow.webContents.openDevTools();
        }
    }
}

module.exports = { WindowManager };
