/**
 * DataLoader.js
 * Core data loading functionality for the D&D Character Creator
 */

export class DataLoader {
    constructor() {
        this.dataCache = new Map();
    }

    async loadJsonFile(path) {
        try {
            const basePath = '../../../data/';
            const fullPath = new URL(basePath + path, import.meta.url).href;
            const response = await fetch(fullPath);
            return await response.json();
        } catch (error) {
            console.error(`Error loading JSON file ${path}:`, error);
            throw error;
        }
    }

    async loadRaces() {
        if (this.dataCache.has('races')) {
            return this.dataCache.get('races');
        }

        const raceData = await this.loadJsonFile('races.json');
        const fluffData = await this.loadJsonFile('fluff-races.json').catch(() => ({}));

        // Process and cache races
        const races = await this.processRaceData(raceData, fluffData);
        this.dataCache.set('races', races);
        return races;
    }

    async loadClasses() {
        if (this.dataCache.has('classes')) {
            return this.dataCache.get('classes');
        }

        const classData = await this.loadJsonFile('classes.json');
        const fluffData = await this.loadJsonFile('fluff-classes.json').catch(() => ({}));

        // Process and cache classes
        const classes = await this.processClassData(classData, fluffData);
        this.dataCache.set('classes', classes);
        return classes;
    }

    async loadBackgrounds() {
        if (this.dataCache.has('backgrounds')) {
            return this.dataCache.get('backgrounds');
        }

        const backgroundData = await this.loadJsonFile('backgrounds.json');
        const fluffData = await this.loadJsonFile('fluff-backgrounds.json').catch(() => ({}));

        // Process and cache backgrounds
        const backgrounds = await this.processBackgroundData(backgroundData, fluffData);
        this.dataCache.set('backgrounds', backgrounds);
        return backgrounds;
    }

    clearCache() {
        this.dataCache.clear();
    }
} 