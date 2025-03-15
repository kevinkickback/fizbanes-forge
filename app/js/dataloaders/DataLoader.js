// Import all individual loaders
import { SpellLoader } from './SpellLoader.js';
import { SourceLoader } from './SourceLoader.js';
import { FeatureLoader } from './FeatureLoader.js';
import { DeityLoader } from './DeityLoader.js';
import { ClassLoader } from './ClassLoader.js';
import { BackgroundLoader } from './BackgroundLoader.js';
import { ItemLoader } from './ItemLoader.js';
import { RaceLoader } from './RaceLoader.js';

let instance = null;

export class DataLoader {
    constructor() {
        if (instance) {
            throw new Error('DataLoader is a singleton. Use DataLoader.getInstance() instead.');
        }

        // Initialize all loaders
        this.spellLoader = new SpellLoader();
        this.sourceLoader = new SourceLoader();
        this.featureLoader = new FeatureLoader();
        this.deityLoader = new DeityLoader();
        this.classLoader = new ClassLoader();
        this.backgroundLoader = new BackgroundLoader();
        this.itemLoader = new ItemLoader();
        this.raceLoader = new RaceLoader();

        instance = this;
    }

    // Proxy methods to individual loaders
    async loadSpells() {
        return this.spellLoader.loadSpells();
    }

    async loadSources() {
        return this.sourceLoader.loadSources();
    }

    async loadFeatures() {
        return this.featureLoader.loadFeatures();
    }

    async loadDeities() {
        return this.deityLoader.loadDeities();
    }

    async loadClasses() {
        return this.classLoader.loadClasses();
    }

    async loadBackgrounds() {
        return this.backgroundLoader.loadBackgrounds();
    }

    async loadItems() {
        return this.itemLoader.loadItems();
    }

    async loadRaces() {
        return this.raceLoader.loadRaces();
    }

    static getInstance() {
        if (!instance) {
            instance = new DataLoader();
        }
        return instance;
    }
}

export const dataLoader = DataLoader.getInstance(); 