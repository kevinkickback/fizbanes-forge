import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages deity data from 5etools. */
class DeityService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'deities',
			loadEvent: 'deities:loaded',
			loggerScope: 'DeityService',
		});
		this.deities = [];
	}

	async initialize() {
		console.debug('DeityService', 'Initializing deity data');

		try {
			// Try to hydrate from cache first
			const cached = this.hydrateFromCache();
			if (cached) {
				this.deities = cached.deities || [];
				console.debug('DeityService', 'Deities loaded from cache', {
					count: this.deities.length,
				});
				return;
			}

			// Load from JSON
			const data = await DataLoader.loadJSON('deities.json');
			if (!data?.deity) {
				console.warn('DeityService', 'No deity data found');
				return;
			}

			// Store raw deity data
			this.deities = data.deity;

			// Cache the data
			this.setData({ deities: this.deities });

			console.debug('DeityService', 'Deities loaded successfully', {
				count: this.deities.length,
				fromCache: false,
			});
		} catch {
			// Gracefully handle missing file - deities are optional
			console.warn(
				'[DeityService]',
				'Deity data unavailable, continuing without deities',
			);
			this.deities = [];
		}
	}

	getAllDeities() {
		return this.deities || [];
	}

	/** Get unique deity names sorted alphabetically. */
	getDeityNames() {
		const names = new Set();
		for (const deity of this.deities) {
			if (deity.name) {
				names.add(deity.name);
			}
		}
		return Array.from(names).sort();
	}

	/** Get deities by pantheon. */
	getByPantheon(pantheon) {
		return this.deities.filter((d) => d.pantheon === pantheon);
	}

	/** Search deities by name. */
	searchByName(query) {
		if (!query) return [];
		const lowerQuery = query.toLowerCase();
		return this.deities.filter((d) =>
			d.name?.toLowerCase().includes(lowerQuery),
		);
	}

	/** Get deity by exact name. */
	getByName(name) {
		return this.deities.find((d) => d.name === name) || null;
	}
}

// Singleton instance
export const deityService = new DeityService();
