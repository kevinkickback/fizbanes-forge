/**
 * D&D 5e Alignment Constants
 */

export const ALIGNMENTS = [
    { value: 'LG', label: 'Lawful Good' },
    { value: 'NG', label: 'Neutral Good' },
    { value: 'CG', label: 'Chaotic Good' },
    { value: 'LN', label: 'Lawful Neutral' },
    { value: 'N', label: 'True Neutral' },
    { value: 'CN', label: 'Chaotic Neutral' },
    { value: 'LE', label: 'Lawful Evil' },
    { value: 'NE', label: 'Neutral Evil' },
    { value: 'CE', label: 'Chaotic Evil' },
    { value: 'U', label: 'Unaligned' },
    { value: 'A', label: 'Any alignment' },
];

/**
 * Get alignment label from value
 * @param {string} value - Alignment abbreviation (e.g., 'LG', 'N')
 * @returns {string} Full alignment name
 */
export function getAlignmentLabel(value) {
    const alignment = ALIGNMENTS.find((a) => a.value === value);
    return alignment ? alignment.label : value;
}

/**
 * Get alignment value from label
 * @param {string} label - Full alignment name (e.g., 'Lawful Good')
 * @returns {string} Alignment abbreviation
 */
export function getAlignmentValue(label) {
    const alignment = ALIGNMENTS.find((a) => a.label === label);
    return alignment ? alignment.value : label;
}
