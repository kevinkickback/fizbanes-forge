// Edition-aware filtering for 5etools data that ships both classic and 2024 reprints.
//
// Source pairs where the classic edition was reprinted in a 2024 book.
// Key = classic source, Value = 2024 reprint source.

const REPRINT_SOURCE_PAIRS = new Map([
    ['PHB', 'XPHB'],
    ['DMG', 'XDMG'],
    ['MM', 'XMM'],
]);

// Reverse lookup: 2024 source → classic source
const REPRINT_REVERSE = new Map();
for (const [classic, modern] of REPRINT_SOURCE_PAIRS) {
    REPRINT_REVERSE.set(modern, classic);
}

export const EDITION_MODES = {
    ALL: 'all',
    LATEST: 'latest',
    CLASSIC: 'classic',
};

/**
 * Checks whether a character's allowed sources contain at least one conflicting
 * pair (e.g. both PHB and XPHB). Used to decide whether to show the edition filter.
 * @param {string[]} allowedSources
 * @returns {boolean}
 */
export function hasConflictingSources(allowedSources) {
    const upper = new Set(allowedSources.map((s) => (s || '').toUpperCase()));
    for (const [classic, modern] of REPRINT_SOURCE_PAIRS) {
        if (upper.has(classic) && upper.has(modern)) return true;
    }
    return false;
}

/**
 * Converts an edition checkbox Set (containing '2024' and/or '2014') to an edition mode string.
 * Both checked or neither checked → ALL; only '2024' → LATEST; only '2014' → CLASSIC.
 */
export function editionSetToMode(editionSet) {
    const has2024 = editionSet.has('2024');
    const has2014 = editionSet.has('2014');
    if ((has2024 && has2014) || (!has2024 && !has2014)) return EDITION_MODES.ALL;
    if (has2024) return EDITION_MODES.LATEST;
    return EDITION_MODES.CLASSIC;
}

/**
 * Filters an array of data entries by edition mode.
 *
 * - 'all'     — no filtering
 * - 'latest'  — hide classic entries whose 2024 reprint source is in the list
 * - 'classic' — hide 2024 reprint entries whose classic source is in the list
 *
 * Only affects items whose source belongs to a known reprint pair.
 * Items from non-paired sources (e.g. XGE, TCE) are always included.
 *
 * @param {Array} items - Array of data objects with a `source` property
 * @param {string} mode - One of EDITION_MODES values
 * @param {string[]} allowedSources - The character's allowed sources
 * @returns {Array} Filtered array
 */
export function filterByEdition(items, mode, allowedSources) {
    if (!items || mode === EDITION_MODES.ALL) return items;

    const upper = new Set(allowedSources.map((s) => (s || '').toUpperCase()));

    if (mode === EDITION_MODES.LATEST) {
        // Hide classic items when their 2024 reprint source is also allowed
        return items.filter((item) => {
            const src = (item.source || '').toUpperCase();
            const modernSource = REPRINT_SOURCE_PAIRS.get(src);
            // If this is a classic source and the modern reprint source is allowed, hide it
            if (modernSource && upper.has(modernSource)) return false;
            return true;
        });
    }

    if (mode === EDITION_MODES.CLASSIC) {
        // Hide 2024 reprint items when their classic source is also allowed
        return items.filter((item) => {
            const src = (item.source || '').toUpperCase();
            const classicSource = REPRINT_REVERSE.get(src);
            // If this is a 2024 source and the classic source is allowed, hide it
            if (classicSource && upper.has(classicSource)) return false;
            return true;
        });
    }

    return items;
}

/**
 * For reprint entries that lack their own description (entries), inherit from
 * the original (classic) version. Must be called before edition filtering so
 * that classic entries are still in the array.
 */
export function inheritReprintDescriptions(items) {
    if (!items?.length) return items;

    // Build lookup: "name|source" (lowercase) → classic item with entries
    const classicByReprint = new Map();
    for (const item of items) {
        if (!item.reprintedAs) continue;
        for (const ref of item.reprintedAs) {
            const key = typeof ref === 'string' ? ref : ref?.uid;
            if (key) classicByReprint.set(key.toLowerCase(), item);
        }
    }

    for (const item of items) {
        const hasEntries =
            item.entries &&
            (!Array.isArray(item.entries) || item.entries.length > 0);
        if (hasEntries) continue;

        const key = `${item.name}|${item.source}`.toLowerCase();
        const classic = classicByReprint.get(key);
        if (classic?.entries) {
            item.entries = classic.entries;
        }
    }

    return items;
}
