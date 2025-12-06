/**
 * DataFolderManager.js
 * Utility for checking and validating D&D data folder configuration
 *
 * @module src/electron/DataFolderManager
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { MainLogger } from './MainLogger.js';

// Core required files - validation fails if missing
// All root-level JSON files needed for character creation
const CORE_REQUIRED_FILES = [
    // Essential character creation files
    'races.json',
    'fluff-races.json',
    'backgrounds.json',
    'fluff-backgrounds.json',
    'feats.json',
    'fluff-feats.json',
    'skills.json',
    'books.json',
    'items.json',
    'items-base.json',
    'fluff-items.json',
    'actions.json',
    'conditionsdiseases.json',
    'fluff-conditionsdiseases.json',
    'languages.json',
    'fluff-languages.json',
    'optionalfeatures.json',
    'fluff-optionalfeatures.json',
    'senses.json',
    // Index files for subdirectories
    'class/index.json',
    'class/fluff-index.json',
    'spells/index.json',
    'spells/fluff-index.json',
];
// Core required folders
const CORE_REQUIRED_FOLDERS = ['class', 'spells'];

/**
 * Validation result
 * @typedef {object} ValidationResult
 * @property {boolean} valid - True if core files present
 * @property {string[]} missing - Missing core files
 * @property {string} [error] - Error message if validation failed
 */

/**
 * Build a raw base URL that points at the remote data folder.
 * Supports GitHub URLs by converting to raw.githubusercontent.com.
 * @param {string} url
 * @returns {string} base URL ending with /data
 */
function buildRawDataBaseUrl(url) {
    const urlObj = new URL(url);
    let dataUrl;

    if (urlObj.hostname.includes('github.com')) {
        let normalized = url.replace(/\/$/, '');
        if (normalized.includes('/tree/')) {
            normalized = normalized
                .replace(/github\.com/, 'raw.githubusercontent.com')
                .replace(/\/tree\//, '/');
        } else {
            normalized = `${normalized.replace(/github\.com/, 'raw.githubusercontent.com')}/main`;
        }
        dataUrl = `${normalized}/data`;
    } else {
        const normalized = url.replace(/\/$/, '');
        dataUrl = `${normalized}/data`;
    }

    return dataUrl;
}

/**
 * Recursively collect all files (relative paths) under the provided data root.
 * Used as a manifest for downloading remote data.
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
export async function collectDataManifest(rootDir) {
    const manifest = [];

    async function walk(currentDir, prefix = '') {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.join(prefix, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath, relPath);
            } else {
                manifest.push(relPath.replace(/\\/g, '/'));
            }
        }
    }

    await walk(rootDir);
    return manifest;
}

/**
 * Validate basic JSON structure for 5etools data files.
 * Note: Using basic structure validation instead of full schema validation because:
 * - 5etools-utils schema validator is designed for homebrew format
 * - App uses official site format which has different structure
 * - Official data is already validated by the 5etools team
 * @private
 * @param {object} data - JSON data to validate
 * @param {string} fileName - File name (e.g., 'races.json')
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateJsonStructure(data, fileName) {
    // Basic check: ensure it's a valid object
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: 'File is not valid JSON' };
    }

    // For races.json, check for required structure
    if (fileName === 'races.json') {
        if (!data.race || !Array.isArray(data.race)) {
            return {
                valid: false,
                error: 'races.json must contain a "race" array',
            };
        }
        if (data.race.length === 0) {
            return { valid: false, error: 'races.json "race" array is empty' };
        }
    }

    // For backgrounds.json, check for required structure
    if (fileName === 'backgrounds.json') {
        if (!data.background || !Array.isArray(data.background)) {
            return {
                valid: false,
                error: 'backgrounds.json must contain a "background" array',
            };
        }
    }

    return { valid: true };
}

/**
 * Recursively search for a file in a directory and its subdirectories
 * @private
 * @param {string} dir - Directory to search
 * @param {string} fileName - File name to find
 * @param {number} maxDepth - Maximum depth to search
 * @param {number} currentDepth - Current search depth
 * @returns {Promise<boolean>}
 */
async function fileExists(dir, fileName, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return false;

    try {
        const filePath = path.join(dir, fileName);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) return true;
    } catch {
        // File not found at this level, continue searching subdirectories
    }

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const subDir = path.join(dir, entry.name);
                if (await fileExists(subDir, fileName, maxDepth, currentDepth + 1)) {
                    return true;
                }
            }
        }
    } catch {
        // Unable to read directory
    }

    return false;
}

/**
 * Find the full path to a file in a directory and its subdirectories
 * @private
 * @param {string} dir - Directory to search
 * @param {string} fileName - File name to find
 * @param {number} maxDepth - Maximum depth to search
 * @param {number} currentDepth - Current search depth
 * @returns {Promise<string|null>}
 */
async function findFilePath(dir, fileName, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return null;

    try {
        const filePath = path.join(dir, fileName);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) return filePath;
    } catch {
        // File not found at this level, continue searching subdirectories
    }

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const subDir = path.join(dir, entry.name);
                const found = await findFilePath(
                    subDir,
                    fileName,
                    maxDepth,
                    currentDepth + 1,
                );
                if (found) return found;
            }
        }
    } catch {
        // Unable to read directory
    }

    return null;
}

/**
 * Check if a local data folder exists and contains required files.
 * All other files will be used if available.
 * @param {string} folderPath - Path to the data folder
 * @returns {Promise<{valid: boolean, missing: Array<string>, error?: string}>}
 */
export async function validateLocalDataFolder(folderPath) {
    try {
        const stats = await fs.stat(folderPath);

        if (!stats.isDirectory()) {
            return {
                valid: false,
                missing: [],
                error: 'Path is not a directory',
            };
        }

        const missingCore = [];

        // Check for CORE required files
        for (const file of CORE_REQUIRED_FILES) {
            const found = await fileExists(folderPath, file);
            if (!found) {
                missingCore.push(file);
            }
        }

        // Check for CORE required folders
        for (const folder of CORE_REQUIRED_FOLDERS) {
            const folderPath2 = path.join(folderPath, folder);
            try {
                const folderStats = await fs.stat(folderPath2);
                if (!folderStats.isDirectory()) {
                    missingCore.push(folder);
                }
            } catch {
                missingCore.push(folder);
            }
        }

        // Fail if CORE files missing
        if (missingCore.length > 0) {
            MainLogger.info('DataFolderManager', 'Local folder validation: FAIL - missing core files', {
                folderPath,
                missingCore,
            });
            return { valid: false, missing: missingCore };
        }

        // Validate JSON structure for races.json
        const racesPath = await findFilePath(folderPath, 'races.json');
        if (racesPath) {
            try {
                const racesContent = await fs.readFile(racesPath, 'utf8');
                const racesData = JSON.parse(racesContent);
                const structureCheck = await validateJsonStructure(
                    racesData,
                    'races.json',
                );

                if (!structureCheck.valid) {
                    MainLogger.warn(
                        'DataFolderManager',
                        'Structure validation failed for races.json:',
                        structureCheck.error,
                    );
                    return {
                        valid: false,
                        missing: [],
                        error: structureCheck.error || 'races.json has invalid structure',
                    };
                }
            } catch (error) {
                MainLogger.warn(
                    'DataFolderManager',
                    'Failed to validate races.json:',
                    error,
                );
                return {
                    valid: false,
                    missing: [],
                    error: 'races.json is not valid JSON',
                };
            }
        }

        MainLogger.info('DataFolderManager', 'Local folder validation: PASS', {
            folderPath,
        });

        return { valid: true, missing: [] };
    } catch (error) {
        MainLogger.error(
            'DataFolderManager',
            'Error validating local folder:',
            error,
        );
        return {
            valid: false,
            missing: [...CORE_REQUIRED_FILES, ...CORE_REQUIRED_FOLDERS],
            error: error.message,
        };
    }
}

/**
 * Check if the default data folder exists and is valid
 * @param {string} defaultDataPath - Default data path (usually src/data/)
 * @returns {Promise<boolean>}
 */
export async function hasDefaultDataFolder(defaultDataPath) {
    try {
        const stats = await fs.stat(defaultDataPath);
        if (!stats.isDirectory()) {
            return false;
        }

        // Quick check - just see if races.json exists
        const racesPath = path.join(defaultDataPath, 'races.json');
        await fs.stat(racesPath);
        MainLogger.info('DataFolderManager', 'Default data folder is valid');
        return true;
    } catch {
        MainLogger.warn(
            'DataFolderManager',
            'Default data folder not found or invalid',
        );
        return false;
    }
}

/**
 * Fetch JSON content from a URL
 * @private
 * @param {string} urlString - URL to fetch from
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function fetchJsonFromUrl(urlString, timeout = 5000) {
    return new Promise((resolve) => {
        const urlObj = new URL(urlString);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout,
        };

        let data = '';

        const request = protocol.request(options, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                resolve({ success: false, error: `HTTP ${response.statusCode}` });
                return;
            }

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ success: true, data: json });
                } catch {
                    resolve({ success: false, error: 'Invalid JSON' });
                }
            });
        });

        request.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        request.on('timeout', () => {
            request.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        request.end();
    });
}

/**
 * Fetch plain text content from a URL
 * @param {string} urlString
 * @param {number} timeout
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function fetchTextFromUrl(urlString, timeout = 10000) {
    return new Promise((resolve) => {
        const urlObj = new URL(urlString);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout,
        };

        let data = '';

        const request = protocol.request(options, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                resolve({ success: false, error: `HTTP ${response.statusCode}` });
                return;
            }

            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => resolve({ success: true, data }));
        });

        request.on('error', (error) => resolve({ success: false, error: error.message }));
        request.on('timeout', () => {
            request.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        request.end();
    });
}

/**
 * Download data files from a remote URL into a local folder using a manifest.
 * Performs incremental updates - only downloads new or changed files.
 * @param {string} url - Remote root URL (repo or base)
 * @param {string} targetDir - Local directory to write files into
 * @param {string[]} manifest - Relative file paths to download
 * @param {(progress: {completed: number, total: number, file: string, success: boolean, skipped?: boolean, error?: string}) => void} [onProgress]
 * @returns {Promise<{success: boolean, downloaded: number, skipped?: number, failed?: Array<{file: string, error: string}>, error?: string}>}
 */
export async function downloadDataFromUrl(url, targetDir, manifest, onProgress) {
    const baseUrl = buildRawDataBaseUrl(url);
    const failed = [];
    let skippedCount = 0;

    try {
        // Check if target directory exists (incremental update case)
        let targetExists = false;
        try {
            const stats = await fs.stat(targetDir);
            targetExists = stats.isDirectory();
        } catch {
            // Directory doesn't exist - will create it
        }

        if (!targetExists) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        let completed = 0;
        const total = manifest.length;

        for (const relPath of manifest) {
            const remoteUrl = `${baseUrl}/${relPath.replace(/\\/g, '/')}`;
            const localPath = path.join(targetDir, relPath);
            const localDir = path.dirname(localPath);

            let success = false;
            let skipped = false;
            let errorMessage;

            try {
                // Check if file already exists
                let existingContent = null;
                try {
                    existingContent = await fs.readFile(localPath, 'utf8');
                } catch {
                    // File doesn't exist - will download
                }

                // Fetch remote file
                const result = await fetchTextFromUrl(remoteUrl);
                if (!result.success || result.data === undefined) {
                    errorMessage = result.error || 'Unknown error';
                    failed.push({ file: relPath, error: errorMessage });
                } else {
                    // Compare content if file exists
                    if (existingContent !== null && existingContent === result.data) {
                        // File unchanged - skip write
                        skipped = true;
                        skippedCount += 1;
                        success = true;
                    } else {
                        // File is new or changed - write it
                        await fs.mkdir(localDir, { recursive: true });
                        await fs.writeFile(localPath, result.data, 'utf8');
                        success = true;
                    }
                }
            } catch (error) {
                errorMessage = error.message;
                failed.push({ file: relPath, error: errorMessage });
            } finally {
                completed += 1;
                if (typeof onProgress === 'function') {
                    onProgress({ completed, total, file: relPath, success, skipped, error: errorMessage });
                }
            }
        }

        // Allow download to succeed with partial failures (some files may not exist upstream)
        // Log failures but continue - use what was downloaded
        const downloadedCount = manifest.length - failed.length - skippedCount;
        if (failed.length > 0) {
            MainLogger.info('DataFolderManager', `Download completed with ${failed.length} missing file(s)`, {
                downloaded: downloadedCount,
                skipped: skippedCount,
                total: manifest.length,
                failedSample: failed.slice(0, 5),
            });
        } else if (skippedCount > 0) {
            MainLogger.info('DataFolderManager', 'Incremental download completed', {
                downloaded: downloadedCount,
                skipped: skippedCount,
                total: manifest.length,
            });
        }

        return { 
            success: true, 
            downloaded: downloadedCount,
            skipped: skippedCount,
            failed, 
            warning: failed.length > 0 ? `${failed.length} file(s) not available upstream` : null 
        };
    } catch (error) {
        MainLogger.error('DataFolderManager', 'Download failed:', error);
        return { success: false, downloaded: 0, error: error.message };
    }
}

/**
 * Validate a URL-based data source by checking if it contains required files
 * @param {string} url - URL to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateDataSourceURL(url) {
    try {
        // First validate URL format
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
        }

        let racesUrl;

        // Check if it's a GitHub URL - special handling for GitHub raw content
        if (urlObj.hostname.includes('github.com')) {
            let dataUrl = url.replace(/\/$/, ''); // Remove trailing slash

            // Convert standard GitHub URL to raw content URL
            if (dataUrl.includes('/tree/')) {
                // Handle tree URLs like: https://github.com/owner/repo/tree/main
                dataUrl = dataUrl
                    .replace(/github\.com/, 'raw.githubusercontent.com')
                    .replace(/\/tree\//, '/');
            } else {
                // Handle regular repo URLs like: https://github.com/owner/repo
                dataUrl = `${dataUrl.replace(/github\.com/, 'raw.githubusercontent.com')}/main`;
            }

            racesUrl = `${dataUrl}/data/races.json`;
        } else {
            // For non-GitHub URLs, try to fetch races.json from /data/ subdirectory
            const dataUrl = url.replace(/\/$/, ''); // Remove trailing slash
            racesUrl = `${dataUrl}/data/races.json`;
        }

        MainLogger.info('DataFolderManager', 'Testing URL:', { url, racesUrl });

        // Try to fetch and validate the JSON
        const result = await fetchJsonFromUrl(racesUrl);

        if (!result.success) {
            MainLogger.warn('DataFolderManager', 'URL validation: FAIL', {
                url,
                racesUrl,
                error: result.error,
            });
            return {
                valid: false,
                error: `Could not reach or parse data files at ${racesUrl}. Make sure the URL contains a 'data' folder with valid JSON files. (Error: ${result.error})`,
            };
        }

        // Validate JSON structure
        const structureCheck = await validateJsonStructure(
            result.data,
            'races.json',
        );
        if (!structureCheck.valid) {
            MainLogger.warn(
                'DataFolderManager',
                'URL validation: FAIL - Structure check failed:',
                structureCheck.error,
            );
            return {
                valid: false,
                error: structureCheck.error || 'races.json has invalid structure',
            };
        }

        MainLogger.info('DataFolderManager', 'URL validation: PASS', {
            url,
            racesUrl,
        });
        return { valid: true };
    } catch (error) {
        MainLogger.warn('DataFolderManager', 'URL validation failed:', error);
        return {
            valid: false,
            error: 'Invalid URL format',
        };
    }
}
