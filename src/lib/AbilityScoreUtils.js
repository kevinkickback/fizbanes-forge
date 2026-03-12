import {
    ABILITY_ABBREVIATIONS,
    attAbvToFull,
    formatModifierNumber,
    numberToWords,
    toSentenceCase,
} from './5eToolsParser.js';
import {
    POINT_BUY_BUDGET,
    POINT_BUY_COSTS,
    STANDARD_ARRAY,
} from './GameRules.js';

const ABILITIES = ABILITY_ABBREVIATIONS;

export { formatModifierNumber as formatModifier, POINT_BUY_BUDGET, STANDARD_ARRAY };

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

function normalizeAbilityNameHelper(abb) {
    const fullName = attAbvToFull(abb);
    return fullName ? fullName.toLowerCase() : abb;
}

export function getRaceAbilityData(race, subrace) {
    const fixed = [];
    const choices = [];

    if (race?.ability && Array.isArray(race.ability)) {
        for (const entry of race.ability) {
            for (const ability of ABILITIES) {
                if (entry[ability] && !entry.choose) {
                    fixed.push({
                        ability: normalizeAbilityNameHelper(ability),
                        value: entry[ability],
                        source: 'race',
                    });
                }
            }

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

    if (subrace?.ability && Array.isArray(subrace.ability)) {
        for (const entry of subrace.ability) {
            for (const ability of ABILITIES) {
                if (entry[ability] && !entry.choose) {
                    fixed.push({
                        ability: normalizeAbilityNameHelper(ability),
                        value: entry[ability],
                        source: 'subrace',
                    });
                }
            }

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

    for (const abilityEntry of abilityArray) {
        if (abilityEntry.choose) {
            const processed = processChoose(abilityEntry.choose);
            asCollection.push({ choose: processed.data });
            asTextParts.push(processed.text);
            asTextShortParts.push(processed.textShort);
            continue;
        }

        const fixed = processFixed(abilityEntry);
        if (fixed.data) {
            asCollection.push(fixed.data);
            if (fixed.text) asTextParts.push(fixed.text);
            if (fixed.textShort) asTextShortParts.push(fixed.textShort);
        }
    }

    // Tasha's Custom Lineage fallback
    if (isCurrentLineage && asCollection.length === 0) {
        return {
            asText: 'Choose one ability score. That score increases by 2.',
            asTextShort: 'Choose one +2',
            asCollection: [{ choose: { from: ABILITIES, count: 1, amount: 2 } }],
        };
    }

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

    const from = choose.from || ABILITIES;

    let text;
    let textShort;

    if (count === 1) {
        if (from.length === ABILITIES.length) {
            text = `increase one ability score of your choice by ${amount}`;
            textShort = `choose one +${amount}`;
        } else {
            const abilities = from.map(attAbvToFull).join(' or ');
            text = `increase your ${abilities} score by ${amount}`;
            const fullNames = from.map(attAbvToFull).join(' or ');
            textShort = `${fullNames} +${amount}`;
        }
    } else {
        if (from.length === ABILITIES.length) {
            text = `increase ${numberToWords(count)} ability ${count === 1 ? 'score' : 'scores'} of your choice by ${amount}`;
            textShort = `choose ${numberToWords(count)} +${amount}`;
        } else {
            const abilities = from.map(attAbvToFull).join(', ');
            text = `increase ${numberToWords(count)} of the following by ${amount}: ${abilities}`;
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

export function getFixedAbilities(abilityArray) {
    if (!abilityArray || !Array.isArray(abilityArray)) {
        return {};
    }

    const fixed = {};

    for (const entry of abilityArray) {
        if (entry.choose) continue;

        for (const ability of ABILITIES) {
            if (entry[ability]) {
                fixed[ability] = (fixed[ability] || 0) + entry[ability];
            }
        }
    }

    return fixed;
}

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

export function validateAbilitySelections(abilityArray, selections) {
    const errors = [];
    const final = { ...getFixedAbilities(abilityArray) };
    const choices = getAbilityChoices(abilityArray);

    if (choices.length === 0) {
        return { valid: true, errors: [], final };
    }

    for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const selected = selections[`choice_${i}`] || [];

        if (selected.length !== choice.count) {
            errors.push(
                `Must select exactly ${choice.count} ${choice.count === 1 ? 'ability' : 'abilities'} for choice ${i + 1}`,
            );
            continue;
        }

        const invalid = selected.filter(
            (ability) => !choice.from.includes(ability),
        );
        if (invalid.length > 0) {
            errors.push(`Invalid ability selection: ${invalid.join(', ')}`);
            continue;
        }

        const unique = new Set(selected);
        if (unique.size !== selected.length) {
            errors.push(`Cannot select the same ability twice in choice ${i + 1}`);
            continue;
        }

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
