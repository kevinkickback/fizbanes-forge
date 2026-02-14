import {
    ABILITY_ABBREVIATIONS,
    attAbvToFull,
    formatModifierNumber,
    numberToWords,
    toSentenceCase,
} from './5eToolsParser.js';

//=============================================================================
// Helper Functions
//=============================================================================

const ABILITIES = ABILITY_ABBREVIATIONS;

export { formatModifierNumber as formatModifier };

const POINT_BUY_COSTS = new Map([
    [8, 0],
    [9, 1],
    [10, 2],
    [11, 3],
    [12, 4],
    [13, 5],
    [14, 7],
    [15, 9],
]);

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;

export function getPointBuyCost(score) {
    return POINT_BUY_COSTS.get(score) || 0;
}

export function calculatePointBuyTotal(scores) {
    if (!scores || typeof scores !== 'object') {
        return 0;
    }

    let total = 0;
    for (const score of Object.values(scores)) {
        if (typeof score === 'number') {
            total += getPointBuyCost(score);
        }
    }
    return total;
}

//=============================================================================
// 5etools Race Ability Parsing Helpers
//=============================================================================

function normalizeAbilityNameHelper(abb) {
    const fullName = attAbvToFull(abb);
    return fullName ? fullName.toLowerCase() : abb;
}

export function getRaceAbilityData(race, subrace) {
    const fixed = [];
    const choices = [];

    // Process race abilities
    if (race?.ability && Array.isArray(race.ability)) {
        for (const entry of race.ability) {
            // Fixed bonuses
            for (const ability of ABILITIES) {
                if (entry[ability] && !entry.choose) {
                    fixed.push({
                        ability: normalizeAbilityNameHelper(ability),
                        value: entry[ability],
                        source: 'race',
                    });
                }
            }

            // Ability choices
            if (entry.choose) {
                choices.push({
                    count: entry.choose.count || 1,
                    amount: entry.choose.amount || 1,
                    from: (entry.choose.from || ABILITIES).map(
                        normalizeAbilityNameHelper,
                    ),
                    source: 'race',
                });
            }
        }
    }

    // Process subrace abilities
    if (subrace?.ability && Array.isArray(subrace.ability)) {
        for (const entry of subrace.ability) {
            // Fixed bonuses
            for (const ability of ABILITIES) {
                if (entry[ability] && !entry.choose) {
                    fixed.push({
                        ability: normalizeAbilityNameHelper(ability),
                        value: entry[ability],
                        source: 'subrace',
                    });
                }
            }

            // Ability choices
            if (entry.choose) {
                choices.push({
                    count: entry.choose.count || 1,
                    amount: entry.choose.amount || 1,
                    from: (entry.choose.from || ABILITIES).map(
                        normalizeAbilityNameHelper,
                    ),
                    source: 'subrace',
                });
            }
        }
    }

    return { fixed, choices };
}

export function getAbilityData(abilityArray, options = {}) {
    const { isOnlyShort = false, isCurrentLineage = false } = options;

    if (
        !abilityArray ||
        !Array.isArray(abilityArray) ||
        abilityArray.length === 0
    ) {
        return {
            asText: '',
            asTextShort: '',
            asCollection: [],
        };
    }

    const asCollection = [];
    const asTextParts = [];
    const asTextShortParts = [];

    // Process each ability entry
    for (const abilityEntry of abilityArray) {
        // Handle "choose" entries (e.g., Variant Human, Half-Elf)
        if (abilityEntry.choose) {
            const processed = processChoose(abilityEntry.choose);
            asCollection.push({ choose: processed.data });
            asTextParts.push(processed.text);
            asTextShortParts.push(processed.textShort);
            continue;
        }

        // Handle fixed ability scores
        const fixed = processFixed(abilityEntry);
        if (fixed.data) {
            asCollection.push(fixed.data);
            if (fixed.text) asTextParts.push(fixed.text);
            if (fixed.textShort) asTextShortParts.push(fixed.textShort);
        }
    }

    // Handle lineage special case (Tasha's Custom Lineage)
    if (isCurrentLineage && asCollection.length === 0) {
        return {
            asText: 'Choose one ability score. That score increases by 2.',
            asTextShort: 'Choose one +2',
            asCollection: [{ choose: { from: ABILITIES, count: 1, amount: 2 } }],
        };
    }

    // Combine parts
    const asText =
        asTextParts.length > 0 ? `${toSentenceCase(asTextParts.join(', '))}.` : '';
    const asTextShort = asTextShortParts.join(', ');

    return {
        asText: isOnlyShort ? '' : asText,
        asTextShort,
        asCollection,
    };
}

function processChoose(choose) {
    const amount = choose.amount || 1;
    const count = choose.count || 1;
    const weighted = choose.weighted;

    // Handle weighted choices (rare)
    if (weighted) {
        const weights = Object.entries(weighted.weights).map(
            ([ability, value]) => `${attAbvToFull(ability)} +${value}`,
        );
        return {
            data: { choose: { weighted: weighted.weights, from: choose.from } },
            text: `increase ${weights.join(' or ')}`,
            textShort: weights.join(' or '),
        };
    }

    // Handle standard choices
    const from = choose.from || ABILITIES;

    // Build text description
    let text;
    let textShort;

    if (count === 1) {
        // Choose one ability
        if (from.length === ABILITIES.length) {
            text = `increase one ability score of your choice by ${amount}`;
            textShort = `choose one +${amount}`;
        } else {
            const abilities = from.map(attAbvToFull).join(' or ');
            text = `increase your ${abilities} score by ${amount}`;
            // Use full name format: "Strength or Dexterity +2"
            const fullNames = from.map(attAbvToFull).join(' or ');
            textShort = `${fullNames} +${amount}`;
        }
    } else {
        // Choose multiple abilities
        if (from.length === ABILITIES.length) {
            text = `increase ${numberToWords(count)} ability ${count === 1 ? 'score' : 'scores'} of your choice by ${amount}`;
            textShort = `choose ${numberToWords(count)} +${amount}`;
        } else {
            const abilities = from.map(attAbvToFull).join(', ');
            text = `increase ${numberToWords(count)} of the following by ${amount}: ${abilities}`;
            // Use full name format for choices
            const fullNames = from.map(attAbvToFull).join(', ');
            textShort = `choose ${numberToWords(count)} from ${fullNames} +${amount}`;
        }
    }

    return {
        data: { from, count, amount },
        text,
        textShort,
    };
}

function processFixed(abilityEntry) {
    const fixed = {};
    const parts = [];
    const shortParts = [];

    for (const ability of ABILITIES) {
        if (abilityEntry[ability]) {
            const value = abilityEntry[ability];
            fixed[ability] = value;
            parts.push(`your ${attAbvToFull(ability)} score increases by ${value}`);
            // Use full name format for display: "Strength +2"
            shortParts.push(`${attAbvToFull(ability)} +${value}`);
        }
    }

    if (parts.length === 0) {
        return { data: null, text: '', textShort: '' };
    }

    return {
        data: fixed,
        text: parts.join(', and '),
        textShort: shortParts.join(', '),
    };
}

/** Get only the fixed ability improvements (no choices). */
export function getFixedAbilities(abilityArray) {
    if (!abilityArray || !Array.isArray(abilityArray)) {
        return {};
    }

    const fixed = {};

    for (const entry of abilityArray) {
        // Skip choose entries
        if (entry.choose) continue;

        // Collect fixed scores
        for (const ability of ABILITIES) {
            if (entry[ability]) {
                fixed[ability] = (fixed[ability] || 0) + entry[ability];
            }
        }
    }

    return fixed;
}

/** Get ability score choices for UI selection. */
export function getAbilityChoices(abilityArray) {
    if (!abilityArray || !Array.isArray(abilityArray)) {
        return [];
    }

    const choices = [];

    for (const entry of abilityArray) {
        if (entry.choose) {
            const choose = entry.choose;
            choices.push({
                from: choose.from || ABILITIES,
                count: choose.count || 1,
                amount: choose.amount || 1,
                weighted: choose.weighted,
            });
        }
    }

    return choices;
}

/** Validate ability score selections against race requirements. */
export function validateAbilitySelections(abilityArray, selections) {
    const errors = [];
    const final = { ...getFixedAbilities(abilityArray) };
    const choices = getAbilityChoices(abilityArray);

    // No choices to validate
    if (choices.length === 0) {
        return { valid: true, errors: [], final };
    }

    // Validate each choice
    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const selected = selections[`choice_${i}`] || [];

        // Check count
        if (selected.length !== choice.count) {
            errors.push(
                `Must select exactly ${choice.count} ${choice.count === 1 ? 'ability' : 'abilities'} for choice ${i + 1}`,
            );
            continue;
        }

        // Check valid abilities
        const invalid = selected.filter(
            (ability) => !choice.from.includes(ability),
        );
        if (invalid.length > 0) {
            errors.push(`Invalid ability selection: ${invalid.join(', ')}`);
            continue;
        }

        // Check duplicates within this choice
        const unique = new Set(selected);
        if (unique.size !== selected.length) {
            errors.push(`Cannot select the same ability twice in choice ${i + 1}`);
            continue;
        }

        // Apply selections
        for (const ability of selected) {
            if (choice.weighted) {
                final[ability] =
                    (final[ability] || 0) + choice.weighted.weights[ability];
            } else {
                final[ability] = (final[ability] || 0) + choice.amount;
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        final,
    };
}
