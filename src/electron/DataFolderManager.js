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

// Frequently referenced index files that can enumerate additional JSON assets
const ENUMERATION_INDEX_FILES = [
    'class/index.json',
    'class/fluff-index.json',
    'spells/index.json',
    'spells/fluff-index.json',
];

/**
 * Validation result
 * @typedef {object} ValidationResult
 * @property {boolean} valid - True if core files present
 * @property {string[]} missing - Missing core files
 * @property {string} [error] - Error message if validation failed
 */

/**
 * Build a raw base URL that points at the remote data folder.
 * Handles GitHub URLs specially by converting to raw.githubusercontent.com format.
 * For non-GitHub URLs, appends /data to the normalized URL.
 *
 * @param {string} url - User-provided repository URL (GitHub URL, direct server URL, etc.)
 * @returns {string} Fully qualified URL to the data directory (e.g., 'https://raw.githubusercontent.com/owner/repo/main/data')
 *
 * @example
 * // GitHub URL with tree structure
 * buildRawDataBaseUrl('https://github.com/owner/repo/tree/main')
 * // => 'https://raw.githubusercontent.com/owner/repo/main/data'
 *
 * @example
 * // Direct server URL
 * buildRawDataBaseUrl('https://example.com/5edata/')
 * // => 'https://example.com/5edata/data'
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
 * Build a manifest of files referenced by local enumeration indexes.
 * Reads class/spells index files to discover all data files that will be loaded.
 * Used during validation to ensure referenced files exist locally.
 *
 * @param {string} rootDir - Absolute path to the data root directory
 * @returns {Promise<{manifest: string[], indexErrors: Array<{indexPath: string, error: string}>}>}
 *          manifest: List of discovered file paths (relative to rootDir)
 *          indexErrors: Any errors encountered while reading indexes
 *
 * @private
 */
async function buildLocalIndexManifest(rootDir) {
    const manifest = [];
    const indexErrors = [];

    for (const indexPath of ENUMERATION_INDEX_FILES) {
        const localIndexPath = path.join(rootDir, indexPath);
        try {
            const content = await fs.readFile(localIndexPath, 'utf8');
            const json = JSON.parse(content);
            const values = Object.values(json || {});
            for (const relPath of values) {
                if (typeof relPath === 'string' && relPath.trim()) {
                    const baseFolder = indexPath.split('/')[0];
                    manifest.push(`${baseFolder}/${relPath}`);
                }
            }
        } catch (error) {
            indexErrors.push({ indexPath, error: error?.message || 'Invalid index JSON' });
            MainLogger.warn('DataFolderManager', 'Failed to read local index for manifest', {
                indexPath,
                error: error?.message,
            });
        }
    }

    return { manifest, indexErrors };
}

/**
 * Validate basic JSON structure for 5etools data files.
 * Checks that the file is valid JSON and contains expected data structures.
 * Note: Uses basic structure validation instead of full schema validation because:
 * - 5etools-utils schema validator is designed for homebrew format
 * - App uses official site format which has different structure
 * - Official data is already validated by the 5etools team
 *
 * @param {object} data - Parsed JSON data to validate
 * @param {string} fileName - File name (e.g., 'races.json') for targeted validation
 * @returns {Promise<{valid: boolean, error?: string}>}
 *          valid: true if structure is acceptable, false otherwise
 *          error: Description of validation failure (if valid is false)
 *
 * @private
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
 * Check if a local data folder exists and contains all required files.
 * Validates core required files, folders, and verifies JSON structure.
 * Files referenced in class/spell indexes must also be present.
 *
 * @param {string} folderPath - Absolute path to the data folder to validate
 * @returns {Promise<{valid: boolean, missing: string[], missingIndexed?: string[], error?: string}>}
 *          valid: true if all required files are present and valid
 *          missing: Array of missing core and indexed files
 *          missingIndexed: Files referenced in indexes that are missing (separate from missing)
 *          error: Description of validation failure (if valid is false)
 *
 * @example
 * const result = await validateLocalDataFolder('/path/to/data');
 * if (!result.valid) {
 *   console.log('Missing files:', result.missing);
 * }
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

        // Check for CORE required files (exact expected locations)
        for (const file of CORE_REQUIRED_FILES) {
            const expectedPath = path.join(folderPath, file);
            try {
                const fileStats = await fs.stat(expectedPath);
                if (!fileStats.isFile()) {
                    missingCore.push(file);
                }
            } catch {
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

        const missingFromIndex = [];
        const { manifest: indexedManifest, indexErrors } = await buildLocalIndexManifest(folderPath);
        if (indexErrors.length > 0) {
            return {
                valid: false,
                missing: CORE_REQUIRED_FILES,
                error: `Index files are unreadable or invalid: ${indexErrors.map((e) => e.indexPath).join(', ')}`,
            };
        }
        for (const relPath of indexedManifest) {
            const expectedPath = path.join(folderPath, relPath);
            try {
                const statsFile = await fs.stat(expectedPath);
                if (!statsFile.isFile()) {
                    missingFromIndex.push(relPath);
                }
            } catch {
                missingFromIndex.push(relPath);
            }
        }

        // Fail if required/indexed files missing
        const missing = [...missingCore, ...missingFromIndex];
        if (missing.length > 0) {
            MainLogger.info('DataFolderManager', 'Local folder validation: FAIL - missing files', {
                folderPath,
                missingCore,
                missingFromIndex,
            });
            return { valid: false, missing, missingIndexed: missingFromIndex };
        }

        // Validate JSON structure for races.json
        const racesPath = path.join(folderPath, 'races.json');
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
 * Check if the default/bundled data folder exists and is valid.
 * Quick check to see if src/data/ folder is populated with at least races.json.
 *
 * @param {string} defaultDataPath - Path to check (typically src/data/)
 * @returns {Promise<boolean>} true if folder exists and contains races.json, false otherwise
 *
 * @private
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
 * Fetch JSON content from a remote URL.
 * Handles HTTP/HTTPS requests with timeout and proper error handling.
 *
 * @param {string} urlString - Full URL to JSON resource
 * @param {number} timeout - Request timeout in milliseconds (default: 5000)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 *          success: true if fetch and parse succeeded
 *          data: Parsed JSON object (if success is true)
 *          error: Error message describing what went wrong (if success is false)
 *
 * @private
 */
export async function fetchJsonFromUrl(urlString, timeout = 5000) {
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
 * Build a complete manifest of files to download from a remote data source.
 * Starts with core required files, then expands using remote index files (class/spells).
 * This ensures we pick up all newly added files that might not be in the core set.
 *
 * @param {string} remoteUrl - User-provided base URL (repo root or server root)
 * @returns {Promise<string[]>} Array of relative file paths to download
 *
 * @example
 * const manifest = await buildDataManifest('https://github.com/5etools-mirror-3/5etools-src');
 * // Returns: ['races.json', 'backgrounds.json', 'class/artificer.json', ...]
 *
 * @private
 */
export async function buildDataManifest(remoteUrl) {
    const manifestSet = new Set(CORE_REQUIRED_FILES);

    // Expand manifest using remote index files (class/spells) to pick up newly added files
    const baseUrl = buildRawDataBaseUrl(remoteUrl);
    for (const indexPath of ENUMERATION_INDEX_FILES) {
        const fullUrl = `${baseUrl}/${indexPath}`;
        const remoteIndex = await fetchJsonFromUrl(fullUrl);
        if (!remoteIndex.success || !remoteIndex.data) {
            MainLogger.warn('DataFolderManager', 'Could not fetch remote index', {
                indexPath,
                error: remoteIndex.error,
            });
            continue;
        }

        try {
            const values = Object.values(remoteIndex.data || {});
            for (const relPath of values) {
                if (typeof relPath === 'string' && relPath.trim()) {
                    manifestSet.add(`${indexPath.split('/')[0]}/${relPath}`);
                }
            }
        } catch (error) {
            MainLogger.warn('DataFolderManager', 'Failed to expand manifest from index', {
                indexPath,
                error: error?.message,
            });
        }
    }

    return Array.from(manifestSet);
}

/**
 * Fetch plain text content from a remote URL.
 * Used for downloading data files as text before parsing as JSON.
 *
 * @param {string} urlString - Full URL to text resource
 * @param {number} timeout - Request timeout in milliseconds (default: 10000)
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 *          success: true if fetch succeeded
 *          data: Plain text content (if success is true)
 *          error: Error message (if success is false)
 *
 * @private
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
 * Download data files from a remote URL into a local folder.
 * Performs incremental updates - only downloads new or changed files (compares content).
 * Allows partial failures (some files may not exist upstream); returns results with warnings.
 *
 * @param {string} url - Remote root URL (repo root or server root)
 * @param {string} targetDir - Local directory to write files into (created if needed)
 * @param {string[]} manifest - Relative file paths to download
 * @param {(progress: {completed: number, total: number, file: string, success: boolean, skipped?: boolean, error?: string}) => void} [onProgress]
 *        Optional callback invoked for each file download attempt
 *
 * @returns {Promise<{success: boolean, downloaded: number, skipped?: number, failed?: Array<{file: string, error: string}>, error?: string, warning?: string}>}
 *          success: true if download completed (even with partial failures)
 *          downloaded: Number of successfully downloaded/updated files
 *          skipped: Number of unchanged files that were not re-downloaded
 *          failed: List of files that could not be downloaded
 *          error: Critical error message (if success is false)
 *          warning: Non-critical warning if some files were missing upstream
 *
 * @example
 * const result = await downloadDataFromUrl(
 *   'https://github.com/5etools-mirror-3/5etools-src',
 *   '/local/data',
 *   manifest,
 *   (progress) => console.log(`Downloaded: ${progress.file}`)
 * );
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
 * Validate a URL-based data source by checking accessibility and structure.
 * Attempts to reach races.json at the remote source and validates its structure.
 * Handles GitHub URLs specially (converts to raw.githubusercontent.com format).
 *
 * @param {string} url - URL to validate (repo URL, server URL, etc.)
 * @returns {Promise<{valid: boolean, error?: string}>}
 *          valid: true if URL is reachable and contains valid data files
 *          error: Description of validation failure (if valid is false)
 *
 * @example
 * const result = await validateDataSourceURL('https://github.com/5etools-mirror-3/5etools-src');
 * if (result.valid) {
 *   console.log('URL is valid and contains required files');
 * } else {
 *   console.error(result.error);
 * }
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
