/** DataLoader.js - Caches and loads game data JSON via Electron IPC (requires preload bridge). */

const state = {
	cache: {},
	loading: {},
	baseUrl: '', // Base URL now empty since data is at root
	persisted: null,
	version: '1', // Cache version for invalidation
	ttl: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

const PERSIST_KEY = 'ff:data-cache:v1';

function _loadPersistedCache() {
	if (state.persisted) return state.persisted;
	try {
		const raw = window?.localStorage?.getItem(PERSIST_KEY);
		if (!raw) {
			state.persisted = {};
			return state.persisted;
		}
		state.persisted = JSON.parse(raw) || {};
	} catch (error) {
		console.warn('DataLoader', 'Failed to load persisted cache', error);
		state.persisted = {};
	}
	return state.persisted;
}

function _savePersistedCache() {
	try {
		if (!state.persisted) return;
		window?.localStorage?.setItem(PERSIST_KEY, JSON.stringify(state.persisted));
	} catch (error) {
		console.warn('DataLoader', 'Failed to save persisted cache', error);
	}
}

async function _hashData(data) {
	try {
		const json = JSON.stringify(data || {});
		const encoded = new TextEncoder().encode(json);
		const digest = await crypto.subtle.digest('SHA-256', encoded);
		const bytes = new Uint8Array(digest);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	} catch (error) {
		console.warn('DataLoader', 'Hashing failed, skipping version tag', error);
		return null;
	}
}

function _getPersistedEntry(url) {
	const persisted = _loadPersistedCache();
	return persisted?.[url] || null;
}

function _isCacheEntryValid(entry, ttlOverride = null) {
	if (!entry) return false;

	// Check version mismatch (invalidates all old cache versions)
	if (entry.version !== state.version) {
		return false;
	}

	// Check TTL expiration (default 7 days, overrideable per call)
	if (entry.timestamp) {
		const age = Date.now() - entry.timestamp;
		const ttlToUse = ttlOverride ?? state.ttl;
		if (age > ttlToUse) {
			return false;
		}
	}

	return true;
}

function _setPersistedEntry(url, data, hash) {
	const persisted = _loadPersistedCache();
	persisted[url] = {
		data,
		hash: hash || null,
		version: state.version,
		timestamp: Date.now(),
	};
	_savePersistedCache();
}

function setBaseUrl(url) {
	state.baseUrl = url;
	return dataLoader;
}

async function loadJSON(url, { ttl } = {}) {
	if (state.cache[url]) return state.cache[url];

	const persisted = _getPersistedEntry(url);
	const ttlOverride = typeof ttl === 'number' && ttl > 0 ? ttl : null;
	if (_isCacheEntryValid(persisted, ttlOverride)) {
		state.cache[url] = persisted.data;
		return persisted.data;
	}

	// Persisted entry is invalid; clear it
	if (persisted) {
		delete _loadPersistedCache()[url];
		_savePersistedCache();
	}

	if (state.loading[url]) return state.loading[url];

	state.loading[url] = (async () => {
		try {
			let data;

			// Check if running in Electron with data API available
			if (
				typeof window !== 'undefined' &&
				window.data &&
				window.data.loadJSON
			) {
				try {
					const result = await window.data.loadJSON(url);
					if (result.success) {
						data = result.data;
					} else {
						throw new Error(result.error || `Failed to load ${url}`);
					}
				} catch (electronError) {
					console.error(
						'DataLoader',
						`Electron IPC load failed for ${url}:`,
						electronError,
					);
					throw electronError;
				}
			} else {
				throw new Error(
					`DataLoader: window.data.loadJSON not available. ` +
						`This is an Electron app and requires the preload bridge. ` +
						`Ensure the preload script is properly loaded.`,
				);
			}

			const hash = await _hashData(data);
			state.cache[url] = data;
			_setPersistedEntry(url, data, hash);
			delete state.loading[url];
			return data;
		} catch (error) {
			delete state.loading[url];
			console.error('DataLoader', `Failed to load ${url}:`, error);
			throw error;
		}
	})();

	return state.loading[url];
}

async function loadJSONs(urls) {
	return Promise.all(urls.map((url) => loadJSON(url)));
}

async function loadSpells(source = 'PHB') {
	return loadJSON(`${state.baseUrl}spells/spells-${source.toLowerCase()}.json`);
}

async function loadItems() {
	const data = await loadJSON(`${state.baseUrl}items.json`);
	return data;
}

async function loadBaseItems() {
	const data = await loadJSON(`${state.baseUrl}items-base.json`);
	return data;
}

async function loadSkills() {
	const data = await loadJSON(`${state.baseUrl}skills.json`);
	return data;
}

async function loadActions() {
	const data = await loadJSON(`${state.baseUrl}actions.json`);
	return data;
}

async function loadMonsters() {
	// Bestiary is optional - not downloaded by default for performance
	// Check if bestiary files exist before attempting load to avoid error logs
	if (typeof window !== 'undefined' && window.data?.fileExists) {
		const exists = await window.data.fileExists('bestiary/index.json');
		if (!exists) {
			console.debug(
				'[DataLoader]',
				'Bestiary not available (not downloaded), skipping monster load',
			);
			return { monster: [] };
		}
	}

	try {
		const index = await loadJSON(`${state.baseUrl}bestiary/index.json`);
		if (!index || Object.keys(index).length === 0) {
			console.debug(
				'[DataLoader]',
				'Bestiary index empty or missing, skipping monster load',
			);
			return { monster: [] };
		}
		const files = Object.values(index);

		// Load all bestiary chunks in parallel, filtering out failures
		const datasets = await Promise.all(
			files.map((file) =>
				loadJSON(`${state.baseUrl}bestiary/${file}`).catch(() => null),
			),
		);

		// Merge array fields (primarily `monster`) across datasets
		const aggregated = {};
		for (const data of datasets) {
			if (!data || typeof data !== 'object') continue;
			for (const [key, value] of Object.entries(data)) {
				if (Array.isArray(value)) {
					aggregated[key] = aggregated[key] || [];
					aggregated[key].push(...value);
				}
			}
		}

		return aggregated;
	} catch {
		console.debug(
			'[DataLoader]',
			'Bestiary data unavailable, continuing without monsters',
		);
		return { monster: [] };
	}
}

async function loadRaces() {
	return loadJSON(`${state.baseUrl}races.json`);
}

async function loadRaceFluff() {
	return loadJSON(`${state.baseUrl}fluff-races.json`);
}

// Note: Use ClassManager for aggregated class data
async function loadClasses(className = 'Fighter') {
	return loadJSON(
		`${state.baseUrl}class/class-${className.toLowerCase()}.json`,
	);
}

async function loadBackgrounds() {
	return loadJSON(`${state.baseUrl}backgrounds.json`);
}

async function loadFeats() {
	const data = await loadJSON(`${state.baseUrl}feats.json`);
	return data;
}

async function loadConditions() {
	const data = await loadJSON(`${state.baseUrl}conditionsdiseases.json`);
	return data;
}

async function loadFluffFeats() {
	return loadJSON(`${state.baseUrl}fluff-feats.json`);
}

async function loadOptionalFeatures() {
	const data = await loadJSON(`${state.baseUrl}optionalfeatures.json`);
	return data;
}

async function loadFluffOptionalFeatures() {
	return loadJSON(`${state.baseUrl}fluff-optionalfeatures.json`);
}

async function loadRewards() {
	const data = await loadJSON(`${state.baseUrl}rewards.json`);
	return data;
}

async function loadTrapsHazards() {
	return loadJSON(`${state.baseUrl}trapshazards.json`);
}

async function loadVehicles() {
	const data = await loadJSON(`${state.baseUrl}vehicles.json`);
	return data;
}

async function loadObjects() {
	const data = await loadJSON(`${state.baseUrl}objects.json`);
	return data;
}

async function loadVariantRules() {
	return loadJSON(`${state.baseUrl}variantrules.json`);
}

async function loadSources() {
	try {
		return await loadJSON(`${state.baseUrl}books.json`);
	} catch (error) {
		console.warn('DataLoader', 'Could not find sources data', error);
		return { source: [] };
	}
}

async function loadSubclassSpells(subclassId) {
	try {
		return await loadJSON(`${state.baseUrl}spells/sources.json`);
	} catch (error) {
		console.warn(
			'DataLoader',
			`Could not find subclass spells for ${subclassId}:`,
			error,
		);
		return { spell: [] };
	}
}

function clearCache() {
	state.cache = {};
	state.loading = {};
	state.persisted = {};
	try {
		window?.localStorage?.removeItem(PERSIST_KEY);
	} catch (error) {
		console.warn('DataLoader', 'Failed to clear persisted cache', error);
	}
	return dataLoader;
}

function clearCacheForUrl(url) {
	delete state.cache[url];
	delete state.loading[url];
	const persisted = _loadPersistedCache();
	delete persisted[url];
	_savePersistedCache();
	return dataLoader;
}

/** Increment cache version to invalidate all cached data. */
function invalidateAllCache() {
	const oldVersion = state.version;
	state.version = String(Number(state.version) + 1);
	console.debug(
		'DataLoader',
		`Cache invalidated: v${oldVersion} → v${state.version}. All cached data will be reloaded on next access.`,
	);
	return state.version;
}

function setTTL(milliseconds) {
	if (milliseconds < 0) {
		console.warn('DataLoader', 'TTL must be non-negative; ignoring');
		return dataLoader;
	}
	state.ttl = milliseconds;
	return dataLoader;
}

function getCacheSettings() {
	return {
		version: state.version,
		ttl: state.ttl,
		ttlDays: Math.round(state.ttl / (24 * 60 * 60 * 1000)),
	};
}

function getCacheStats() {
	return {
		cachedUrls: Object.keys(state.cache).length,
		loadingUrls: Object.keys(state.loading).length,
		totalSize: JSON.stringify(state.cache).length,
	};
}

const dataLoader = {
	setBaseUrl,
	loadJSON,
	loadJSONs,
	loadSpells,
	loadItems,
	loadBaseItems,
	loadSkills,
	loadActions,
	loadMonsters,
	loadRaces,
	loadRaceFluff,
	loadClasses,
	loadBackgrounds,
	loadFeats,
	loadConditions,
	loadFluffFeats,
	loadOptionalFeatures,
	loadFluffOptionalFeatures,
	loadRewards,
	loadTrapsHazards,
	loadVehicles,
	loadObjects,
	loadVariantRules,
	loadSources,
	loadSubclassSpells,
	clearCache,
	clearCacheForUrl,
	getCacheStats,
	invalidateAllCache,
	setTTL,
	getCacheSettings,
};

// Legacy convenience alias for DataLoader exports
const DataLoader = dataLoader;

export {
	clearCache,
	clearCacheForUrl,
	DataLoader,
	dataLoader,
	getCacheSettings,
	getCacheStats,
	invalidateAllCache,
	loadActions,
	loadBackgrounds,
	loadBaseItems,
	loadClasses,
	loadConditions,
	loadFeats,
	loadFluffFeats,
	loadFluffOptionalFeatures,
	loadItems,
	loadJSON,
	loadJSONs,
	loadMonsters,
	loadObjects,
	loadOptionalFeatures,
	loadRaceFluff,
	loadRaces,
	loadRewards,
	loadSkills,
	loadSources,
	loadSpells,
	loadSubclassSpells,
	loadTrapsHazards,
	loadVariantRules,
	loadVehicles,
	setBaseUrl,
	setTTL,
};
