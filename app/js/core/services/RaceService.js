import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';

export class RaceService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.raceCache = new Map();
        this.subraceCache = new Map();
    }

    async loadRace(raceId) {
        // Check cache first
        if (this.raceCache.has(raceId)) {
            return this.raceCache.get(raceId);
        }

        // Load race data
        const races = await this.dataLoader.loadRaces();
        const raceData = races.find(r => r.id === raceId);

        if (!raceData) {
            throw new Error(`Race not found: ${raceId}`);
        }

        // Create race instance
        const race = new Race(raceData);
        this.raceCache.set(raceId, race);
        return race;
    }

    async loadSubrace(subraceId, parentRaceId) {
        // Check cache first
        const cacheKey = `${parentRaceId}:${subraceId}`;
        if (this.subraceCache.has(cacheKey)) {
            return this.subraceCache.get(cacheKey);
        }

        // Load parent race first
        const parentRace = await this.loadRace(parentRaceId);
        const subraceData = parentRace.subraces.find(s => s.id === subraceId);

        if (!subraceData) {
            throw new Error(`Subrace not found: ${subraceId}`);
        }

        // Create subrace instance
        const subrace = new Subrace(subraceData, parentRace);
        this.subraceCache.set(cacheKey, subrace);
        return subrace;
    }

    async getAvailableRaces() {
        const races = await this.dataLoader.loadRaces();
        return races.map(raceData => new Race(raceData));
    }

    async getAvailableSubraces(raceId) {
        const race = await this.loadRace(raceId);
        return race.subraces.map(subraceData => new Subrace(subraceData, race));
    }

    clearCache() {
        this.raceCache.clear();
        this.subraceCache.clear();
    }
} 