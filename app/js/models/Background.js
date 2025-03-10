/**
 * Background.js
 * Model class for character backgrounds
 */

export class Background {
    constructor(data) {
        console.log('Creating Background model with data:', data);

        // Basic properties
        this.id = data.id;
        this.name = data.name;
        this.source = data.source || 'PHB';
        this.page = data.page;
        this.description = data.description || '';

        // Process proficiencies
        this.proficiencies = data.proficiencies || {
            skills: {
                fixed: [],
                choices: { count: 0, from: [] }
            },
            tools: {
                fixed: [],
                choices: { count: 0, from: [] }
            }
        };

        // Process languages
        this.languages = data.languages || {
            fixed: [],
            choices: { count: 0, from: [] }
        };

        // Process equipment
        this.equipment = data.equipment || [];

        // Process feature
        this.feature = data.feature || {
            name: '',
            description: '',
            entries: []
        };

        // Process characteristics
        this.characteristics = data.characteristics || {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };

        // Process variants
        this.variants = (data.variants || []).map(v => new Background({
            ...v,
            source: v.source || this.source
        }));

        // Store fluff data
        this.fluff = data.fluff;

        console.log('Background model created:', this);
    }

    hasProficiencyChoice() {
        return (this.proficiencies.skills.choices?.count || 0) > 0 ||
            (this.proficiencies.tools.choices?.count || 0) > 0;
    }

    hasLanguageChoice() {
        return (this.languages.choices?.count || 0) > 0;
    }

    getFixedProficiencies() {
        return {
            skills: this.proficiencies.skills.fixed || [],
            tools: this.proficiencies.tools.fixed || []
        };
    }

    getFixedLanguages() {
        return this.languages.fixed || [];
    }

    getVariants() {
        return this.variants;
    }

    getFeature() {
        return this.feature;
    }

    getCharacteristics() {
        return this.characteristics;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            page: this.page,
            description: this.description,
            proficiencies: this.proficiencies,
            languages: this.languages,
            equipment: this.equipment,
            feature: this.feature,
            characteristics: this.characteristics,
            variants: this.variants.map(v => v.toJSON())
        };
    }
} 