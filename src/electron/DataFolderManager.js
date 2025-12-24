/** Utility helpers for validating, fetching, and downloading 5e data folders. */

import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { MainLogger } from './MainLogger.js';

// Core required files - validation fails if missing
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

// Index files that enumerate additional JSON assets
const ENUMERATION_INDEX_FILES = [
    'class/index.json',
    'class/fluff-index.json',
    'spells/index.json',
    'spells/fluff-index.json',
];

/** @typedef {{valid: boolean, missing: string[], error?: string}} ValidationResult */

// Convert a repo/server URL to a raw data base URL (GitHub -> raw, others add /data).
function buildRawDataBaseUrl(url) {
    const urlObj = new URL(url);
    let dataUrl;

    if (urlObj.hostname.includes('github.com')) {
        let normalized = url.replace(/\/$/, '');
        if (normalized.includes('/tree/')) {
            // e.g. https://github.com/user/repo/tree/main or /tree/main/data
            normalized = normalized
                .replace(/github\.com/, 'raw.githubusercontent.com')
                .replace(/\/tree\//, '/');
        } else {
            // e.g. https://github.com/user/repo
            normalized = `${normalized.replace(/github\.com/, 'raw.githubusercontent.com')}/main`;
        }
        if (/\/data\/?$/.test(normalized)) {
            dataUrl = normalized;
        } else {
            dataUrl = `${normalized}/data`;
        }
    } else {
        const normalized = url.replace(/\/$/, '');
        if (/\/data\/?$/.test(normalized)) {
            dataUrl = normalized;
        } else {
            dataUrl = `${normalized}/data`;
        }
    }
    return dataUrl;
}

// Read local index files to collect referenced data file paths.
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

// Minimal structure checks for key JSON files (mainly races/backgrounds).
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
 * Validate a local data directory for required files, indexes, and JSON shape.
 * @param {string} folderPath absolute path to the data folder
 * @returns {Promise<{valid: boolean, missing: string[], missingIndexed?: string[], error?: string}>}
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
        MainLogger.error('DataFolderManager', 'Error validating local folder:', error?.message || error);
        return {
            valid: false,
            missing: [...CORE_REQUIRED_FILES, ...CORE_REQUIRED_FOLDERS],
            error: error?.message || String(error),
        };
    }
}

/**
 * Quick existence check for the bundled src/data folder.
 * @param {string} defaultDataPath path to check
 * @returns {Promise<boolean>} true if races.json exists
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
 * Fetch and parse JSON from a URL with timeout/error handling.
 * @param {string} urlString full URL to JSON resource
 * @param {number} [timeout=5000] request timeout in ms
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
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
 * Build a download manifest combining core files and entries from remote indexes.
 * @param {string} remoteUrl repo/server base URL
 * @returns {Promise<string[]>} relative paths to fetch
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

/** Fetch plain text from a URL with timeout/error handling. */
function fetchTextFromUrl(urlString, timeout = 10000) {
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
 * Download manifest files to a target folder (incremental, tolerant of partial failures).
 * @param {string} url remote base URL
 * @param {string} targetDir local directory to write
 * @param {string[]} manifest relative paths to download
 * @param {(progress: {completed: number, total: number, file: string, success: boolean, skipped?: boolean, error?: string}) => void} [onProgress]
 * @returns {Promise<{success: boolean, downloaded: number, skipped?: number, failed?: Array<{file: string, error: string}>, error?: string, warning?: string}>}
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
 * Validate a remote data source URL by fetching and checking races.json.
 * @param {string} url repo/server URL to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateDataSourceURL(url) {
    try {
        // First validate URL format
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
        }


        // Always treat the input as a folder (repo root or data folder)
        const baseUrl = buildRawDataBaseUrl(url);
        const racesUrl = `${baseUrl}/races.json`;

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
