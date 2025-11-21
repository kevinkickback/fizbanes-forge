/**
 * TextFormatter.js
 * Utility functions for formatting text strings
 */

/**
 * Capitalizes the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalizes the first letter of each word in a string
 * @param {string} str - The string to format
 * @returns {string} Title-cased string
 */
export function toTitleCase(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    return str.toLowerCase().split(' ').map(word => capitalize(word)).join(' ');
}

/**
 * Converts a camelCase or PascalCase string to readable text
 * @param {string} str - The string to convert
 * @returns {string} Readable string with spaces
 */
export function camelToReadable(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    // Insert space before uppercase letters
    const result = str.replace(/([A-Z])/g, ' $1').trim();

    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Converts a string to kebab-case
 * @param {string} str - The string to convert
 * @returns {string} Kebab-cased string
 */
export function toKebabCase(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/\s+/g, '-')
        .toLowerCase();
}

/**
 * Converts a string to snake_case
 * @param {string} str - The string to convert
 * @returns {string} Snake-cased string
 */
export function toSnakeCase(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/\s+/g, '_')
        .toLowerCase();
}

/**
 * Converts a string to camelCase
 * @param {string} str - The string to convert
 * @returns {string} camelCased string
 */
export function toCamelCase(str) {
    if (typeof str !== 'string' || str.length === 0) {
        return '';
    }

    return str
        .toLowerCase()
        .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase());
}

/**
 * Pluralizes a word (simple English rules)
 * @param {string} word - The word to pluralize
 * @param {number} count - The count (pluralizes if count !== 1)
 * @returns {string} Pluralized word
 */
export function pluralize(word, count) {
    if (typeof word !== 'string' || word.length === 0) {
        return '';
    }

    if (count === 1) {
        return word;
    }

    // Handle special cases
    const irregulars = {
        'man': 'men',
        'woman': 'women',
        'child': 'children',
        'tooth': 'teeth',
        'foot': 'feet',
        'person': 'people',
        'leaf': 'leaves',
        'mouse': 'mice',
        'goose': 'geese',
        'half': 'halves',
        'knife': 'knives',
        'wife': 'wives',
        'life': 'lives',
        'elf': 'elves',
        'loaf': 'loaves',
        'potato': 'potatoes',
        'tomato': 'tomatoes',
        'cactus': 'cacti',
        'focus': 'foci',
        'fungus': 'fungi',
        'nucleus': 'nuclei',
        'radius': 'radii',
        'stimulus': 'stimuli',
        'axis': 'axes',
        'crisis': 'crises',
        'criterion': 'criteria',
        'phenomenon': 'phenomena'
    };

    const lowerWord = word.toLowerCase();

    if (irregulars[lowerWord]) {
        return irregulars[lowerWord];
    }

    // Standard pluralization rules
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
        return `${word}es`;
    }

    if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
        return `${word.slice(0, -1)}ies`;
    }

    if (word.endsWith('f')) {
        return `${word.slice(0, -1)}ves`;
    }

    if (word.endsWith('fe')) {
        return `${word.slice(0, -2)}ves`;
    }

    if (word.endsWith('o') && !/[aeiou]o$/i.test(word)) {
        return `${word}es`;
    }

    return `${word}s`;
}

/**
 * Truncates a string to a maximum length with ellipsis
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add when truncated
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
    if (typeof str !== 'string' || str.length <= maxLength) {
        return str;
    }

    return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Wraps text to a specific line length
 * @param {string} text - The text to wrap
 * @param {number} maxLineLength - Maximum characters per line
 * @returns {string} Wrapped text with newlines
 */
export function wrapText(text, maxLineLength) {
    if (typeof text !== 'string' || text.length <= maxLineLength) {
        return text;
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + word).length <= maxLineLength) {
            currentLine += (currentLine.length > 0 ? ' ' : '') + word;
        } else {
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
            currentLine = word;
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    return lines.join('\n');
}

/**
 * Removes HTML tags from a string
 * @param {string} html - The HTML string
 * @returns {string} Plain text without tags
 */
export function stripHtml(html) {
    if (typeof html !== 'string') {
        return '';
    }

    return html.replace(/<[^>]*>/g, '');
}

/**
 * Escapes HTML special characters
 * @param {string} text - The text to escape
 * @returns {string} Escaped text safe for HTML
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Converts a string to an array of words
 * @param {string} str - The string to split
 * @returns {Array<string>} Array of words
 */
export function toWords(str) {
    if (typeof str !== 'string') {
        return [];
    }

    return str.match(/[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)/g) || [];
}

/**
 * Joins an array with commas and "and" for the last item
 * @param {Array<string>} items - Array of items to join
 * @param {string} [conjunction='and'] - Word to use before last item
 * @returns {string} Joined string
 */
export function joinWithAnd(items, conjunction = 'and') {
    if (!Array.isArray(items) || items.length === 0) {
        return '';
    }

    if (items.length === 1) {
        return items[0];
    }

    if (items.length === 2) {
        return `${items[0]} ${conjunction} ${items[1]}`;
    }

    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];

    return `${allButLast}, ${conjunction} ${last}`;
}

/**
 * Abbreviates ability score names
 * @param {string} ability - Full ability name
 * @returns {string} Abbreviated ability (e.g., "STR", "DEX")
 */
export function abbreviateAbility(ability) {
    if (typeof ability !== 'string') {
        return '';
    }

    const abbr = {
        'strength': 'STR',
        'dexterity': 'DEX',
        'constitution': 'CON',
        'intelligence': 'INT',
        'wisdom': 'WIS',
        'charisma': 'CHA'
    };

    return abbr[ability.toLowerCase()] || ability.substring(0, 3).toUpperCase();
}

/**
 * Formats a source abbreviation with full name
 * @param {string} source - Source abbreviation (e.g., "PHB")
 * @returns {string} Full source name
 */
export function expandSource(source) {
    if (typeof source !== 'string') {
        return '';
    }

    const sources = {
        'PHB': 'Player\'s Handbook',
        'DMG': 'Dungeon Master\'s Guide',
        'MM': 'Monster Manual',
        'XGTE': 'Xanathar\'s Guide to Everything',
        'TCOE': 'Tasha\'s Cauldron of Everything',
        'VGTM': 'Volo\'s Guide to Monsters',
        'MTOF': 'Mordenkainen\'s Tome of Foes',
        'SCAG': 'Sword Coast Adventurer\'s Guide',
        'EE': 'Elemental Evil Player\'s Companion'
    };

    return sources[source.toUpperCase()] || source;
}
