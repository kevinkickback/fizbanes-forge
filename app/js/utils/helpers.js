// Utility functions

export function formatAbilityScore(score) {
    const modifier = Math.floor((score - 10) / 2);
    return `${score} (${modifier >= 0 ? '+' : ''}${modifier})`;
}

export function capitalizeWord(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function validateRequiredFields(fields) {
    for (const field of fields) {
        const element = document.getElementById(field);
        if (!element || !element.value) {
            return false;
        }
    }
    return true;
} 