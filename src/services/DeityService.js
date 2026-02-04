import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

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
		await this.initWithLoader(
			async () => {
				const data = await DataLoader.loadJSON('deities.json');
				return { deities: data?.deity || [] };
			},
			{
				onLoaded: (data) => {
					this.deities = data?.deities || [];
				},
				onError: () => ({ deities: [] }),
			},
		);
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
}

export const deityService = new DeityService();
