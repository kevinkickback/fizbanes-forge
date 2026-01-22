export function isPlainObject(value) {
	if (value === null || typeof value !== 'object') return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

export function deepClone(value) {
	if (value === null || typeof value !== 'object') return value;
	if (typeof globalThis.structuredClone === 'function') {
		return globalThis.structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value));
}

export function deepClonePlain(value) {
	if (Array.isArray(value)) {
		return value.map((v) => deepClonePlain(v));
	}
	if (!isPlainObject(value)) {
		return deepClone(value);
	}
	const result = {};
	for (const key of Object.keys(value)) {
		const val = value[key];
		result[key] = deepClonePlain(val);
	}
	return result;
}
