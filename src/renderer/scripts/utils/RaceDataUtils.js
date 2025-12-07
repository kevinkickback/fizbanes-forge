/**
 * Utility functions for processing and deriving race and subrace data.
 * 
 * This module handles the complex logic of deriving subrace variants from race data,
 * particularly dealing with the 5etools data format which includes:
 * - Named subraces (e.g., "High Elf", "Wood Elf")
 * - Base/unnamed subraces (generic race data without a specific subrace name)
 * - Version variants (e.g., different dragon colors for Dragonborn)
 * - Abstract/implementation patterns for variant generation
 */

/**
 * Groups subraces by their parent race for efficient lookup.
 * 
 * @param {Array<Object>} subraceArray - Array of subrace data from JSON
 * @returns {Map<string, Array<Object>>} Map keyed by "racename:source" containing arrays of subraces
 * 
 * @example
 * // Input: [{ raceName: "Elf", raceSource: "PHB", name: "High Elf" }]
 * // Output: Map { "elf:PHB" => [{ raceName: "Elf", ... }] }
 */
export function groupSubracesByRace(subraceArray) {
    const groups = new Map();

    for (const subrace of subraceArray) {
        if (!subrace?.raceName) continue;

        const raceSource = subrace.raceSource || subrace.source || 'PHB';
        const key = createRaceKey(subrace.raceName, raceSource);

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(subrace);
    }

    return groups;
}

/**
 * Derives subrace variants from a race's _versions array.
 * 
 * The 5etools format supports two version patterns:
 * 1. Abstract/Implementation pattern: Used for variants like Dragonborn colors
 *    - _abstract: Contains template data
 *    - _implementations: Array of variants with _variables (e.g., color names)
 * 2. Simple version pattern: Direct variant definitions with their own names
 * 
 * @param {Object} race - The race object containing _versions
 * @param {string} source - The source book identifier
 * @returns {Array<Object>} Array of derived subrace objects
 * 
 * @example
 * // For Dragonborn with color variants:
 * // Returns: [
 * //   { name: "Black", raceName: "Dragonborn", _isVersion: true, ... },
 * //   { name: "Blue", raceName: "Dragonborn", _isVersion: true, ... }
 * // ]
 */
export function deriveVersionSubracesFromRace(race, source) {
    if (!race?._versions) return [];

    const derived = [];

    for (const version of race._versions) {
        // Pattern 1: Abstract/Implementation with variables (e.g., Dragonborn colors)
        if (version._abstract && version._implementations) {
            derived.push(...deriveFromAbstractImplementation(
                version._abstract,
                version._implementations,
                race.name,
                source
            ));
        }
        // Pattern 2: Simple version with direct name
        else {
            derived.push(deriveFromSimpleVersion(version, race.name, source));
        }
    }

    return derived;
}

/**
 * Derives subrace variants from a subrace entry's _versions array.
 * Only processes abstract/implementation patterns from the first version entry.
 * 
 * @param {Object} subraceEntry - The subrace entry containing _versions
 * @param {string} raceName - Name of the parent race
 * @param {string} raceSource - Source of the parent race
 * @returns {Array<Object>} Array of derived subrace objects
 */
export function deriveVersionSubracesFromSubraceEntry(subraceEntry, raceName, raceSource) {
    const firstVersion = subraceEntry?._versions?.[0];
    if (!firstVersion?._implementations) return [];

    return deriveFromAbstractImplementation(
        firstVersion._abstract,
        firstVersion._implementations,
        raceName,
        subraceEntry.source || subraceEntry.raceSource || raceSource
    );
}

/**
 * Creates a standardized race lookup key from name and source.
 * 
 * @param {string} name - Race name
 * @param {string} source - Source identifier (defaults to 'PHB')
 * @returns {string} Lowercase key in format "name:source"
 */
export function createRaceKey(name, source = 'PHB') {
    return `${name?.toLowerCase()}:${source}`;
}

/**
 * Builds a complete race bundle containing the race and all its subraces.
 * Merges subraces from multiple sources:
 * - Named subraces (explicitly defined, e.g., "High Elf")
 * - Derived subraces from race versions (e.g., Dragonborn colors)
 * - Derived subraces from base subrace versions
 * 
 * @param {Object} race - The race object
 * @param {Array<Object>} explicitSubraces - Subraces from the subrace data array
 * @param {string} raceSource - Source identifier for the race
 * @returns {Object} Bundle containing { race, subraces, baseSubrace }
 */
export function buildRaceBundle(race, explicitSubraces, raceSource) {
    // Separate named subraces (complete variants) from base subraces (generic data)
    const namedSubraces = explicitSubraces.filter(sr => sr.name);
    const baseSubraces = explicitSubraces.filter(sr => !sr.name);

    // Derive version subraces from the race itself
    const derivedFromRace = deriveVersionSubracesFromRace(race, raceSource);

    // Derive version subraces from base (unnamed) subrace entries
    // Named subraces are complete variants and shouldn't have versions derived
    const derivedFromSubrace = baseSubraces.flatMap(entry =>
        deriveVersionSubracesFromSubraceEntry(entry, race.name, raceSource)
    );

    // Merge all subrace sources
    const allSubraces = [
        ...namedSubraces,
        ...derivedFromRace,
        ...derivedFromSubrace,
    ];

    return {
        race,
        subraces: allSubraces,
        baseSubrace: baseSubraces[0] || null,
    };
}

// ============================================================================
// Private helper functions
// ============================================================================

/**
 * Derives subraces from abstract/implementation pattern.
 * Used for variants like Dragonborn colors where multiple implementations
 * share a common abstract template.
 * 
 * @private
 */
function deriveFromAbstractImplementation(abstractTemplate, implementations, raceName, source) {
    return implementations
        .filter(impl => impl._variables?.color)
        .map(impl => ({
            name: impl._variables.color,
            source,
            raceName,
            raceSource: source,
            _isVersion: true,
            _implementation: impl,
            _abstract: abstractTemplate,
        }));
}

/**
 * Derives a subrace from a simple version entry.
 * Handles version names that may include semicolons (extracts the part after ';').
 * 
 * @private
 */
function deriveFromSimpleVersion(version, raceName, source) {
    let variantName = version.name;

    // Some versions have names like "Dragonborn; Black" - extract the variant name
    if (variantName?.includes(';')) {
        variantName = variantName.split(';')[1].trim();
    }

    return {
        name: variantName || version.name,
        source: version.source || source,
        raceName,
        raceSource: source,
        _isVersion: true,
        _versionData: version,
    };
}
