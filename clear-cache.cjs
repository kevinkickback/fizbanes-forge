// Script to clear Fizbane's Forge cache before app launch (CommonJS)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const cacheDir = path.join(os.homedir(), "AppData/Roaming/Fizbane's Forge");

try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log(`[clear-cache] Removed cache directory: ${cacheDir}`);
} catch (err) {
    console.error(`[clear-cache] Failed to remove cache directory:`, err);
}
