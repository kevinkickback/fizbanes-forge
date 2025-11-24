/**
 * FileNameSanitizer.js
 * Utilities for sanitizing filenames to ensure OS compatibility
 * 
 * @module utils/FileNameSanitizer
 */

/**
 * Sanitizes a string to be safe for use as a filename across all OS platforms
 * Removes or replaces invalid characters and ensures compatibility
 * 
 * @param {string} filename - The filename to sanitize
 * @param {string} fallback - Fallback name if sanitization results in empty string (default: 'character')
 * @returns {string} Sanitized filename
 */
export function sanitizeFileName(filename, fallback = 'character') {
    if (typeof filename !== 'string' || filename.trim().length === 0) {
        return fallback;
    }

    // Remove invalid characters for Windows/Mac/Linux
    // Invalid: < > : " / \ | ? *
    // Also remove control characters and leading/trailing spaces
    let sanitized = filename
        .trim()
        .replace(/[\x00-\x1f\x7f]/g, '')  // Remove control characters
        .replace(/[<>:"/\\|?*]/g, '')      // Remove invalid filesystem characters
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .trim();

    // Remove leading dots and spaces (reserved in some filesystems)
    sanitized = sanitized.replace(/^[\s.]+/, '');

    // Limit length to 200 characters (well below OS limits which are typically 255)
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200);
    }

    // If result is empty after sanitization, use fallback
    return sanitized.length > 0 ? sanitized : fallback;
}
