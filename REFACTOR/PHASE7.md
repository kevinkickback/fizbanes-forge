# Phase 7: Feats and Optional Features Integration

## Overview
Enhance feat and optional feature handling using the unified data processing system.

## Implementation Steps

### 1. Update Feat Data Loading
Update data-loader.js:

```javascript
// Update loadFeats function
async function loadFeats() {
    if (dataCache.feats) {
        return dataCache.feats;
    }

    try {
        // Load main feat data and fluff
        const featData = await loadJsonFile('data/feats.json');
        const fluffData = await loadJsonFile('data/fluff-feats.json').catch(() => ({}));

        // Process feats
        const processedFeats = await Promise.all((featData.feat || []).map(async feat => {
            const fluff = fluffData.featFluff?.find(f => 
                f.name === feat.name && f.source === feat.source
            );
            return processEntityData(feat, 'feat', fluff);
        }));

        // Cache and return
        dataCache.feats = processedFeats;
        return processedFeats;
    } catch (error) {
        console.error('Error loading feat data:', error);
        throw error;
    }
}

async function loadOptionalFeatures() {
    if (dataCache.optionalFeatures) {
        return dataCache.optionalFeatures;
    }

    try {
        // Load main optional feature data and fluff
        const featureData = await loadJsonFile('data/optionalfeatures.json');
        const fluffData = await loadJsonFile('data/fluff-optionalfeatures.json').catch(() => ({}));

        // Process features
        const processedFeatures = await Promise.all((featureData.optionalfeature || []).map(async feature => {
            const fluff = fluffData.optionalFeatureFluff?.find(f => 
                f.name === feature.name && f.source === feature.source
            );
            return processEntityData(feature, 'optfeature', fluff);
        }));

        // Cache and return
        dataCache.optionalFeatures = processedFeatures;
        return processedFeatures;
    } catch (error) {
        console.error('Error loading optional feature data:', error);
        throw error;
    }
}
```

### 2. Update Character Feat Management
Add to character.js:

```javascript
// Add to character.js
class FeatManager {
    constructor(character) {
        this.character = character;
        this.feats = new Map();
        this.optionalFeatures = new Map();
    }

    async addFeat(featId) {
        try {
            const feats = await window.dndDataLoader.loadFeats();
            const feat = feats.find(f => f.id === featId);
            if (!feat) return false;

            // Check prerequisites
            if (!this.checkPrerequisites(feat)) {
                return false;
            }

            // Check if repeatable
            if (!feat.repeatable && this.feats.has(featId)) {
                return false;
            }

            // Apply feat
            this.feats.set(featId, {
                feat,
                count: (this.feats.get(featId)?.count || 0) + 1
            });

            // Apply ability score increases
            if (feat.ability) {
                await this.applyAbilityScoreIncreases(feat.ability);
            }

            return true;
        } catch (error) {
            console.error('Error adding feat:', error);
            return false;
        }
    }

    async addOptionalFeature(featureId) {
        try {
            const features = await window.dndDataLoader.loadOptionalFeatures();
            const feature = features.find(f => f.id === featureId);
            if (!feature) return false;

            // Check prerequisites
            if (!this.checkPrerequisites(feature)) {
                return false;
            }

            // Check class and level requirements
            if (feature.className && feature.level) {
                const classLevel = this.character.getClassLevel(feature.className);
                if (!classLevel || classLevel < feature.level) {
                    return false;
                }
            }

            // Add feature
            this.optionalFeatures.set(featureId, feature);

            return true;
        } catch (error) {
            console.error('Error adding optional feature:', error);
            return false;
        }
    }

    checkPrerequisites(item) {
        if (!item.prerequisite) return true;

        // This is a placeholder - actual prerequisite checking would need to be implemented
        // based on the specific format of prerequisites in your data
        return true;
    }

    async applyAbilityScoreIncreases(abilities) {
        for (const ability of abilities) {
            if (ability.mode === 'fixed') {
                for (const score of ability.scores) {
                    this.character.addAbilityScore(score, ability.amount, 'Feat');
                }
            } else if (ability.mode === 'choose') {
                // Store choice for UI
                this.character.pendingChoices.featAbilityScores = {
                    scores: ability.scores,
                    amount: ability.amount
                };
            }
        }
    }

    removeFeat(featId) {
        const featData = this.feats.get(featId);
        if (!featData) return false;

        if (featData.count > 1) {
            featData.count--;
            this.feats.set(featId, featData);
        } else {
            this.feats.delete(featId);
        }

        // Remove ability score increases
        if (featData.feat.ability) {
            for (const ability of featData.feat.ability) {
                if (ability.mode === 'fixed') {
                    for (const score of ability.scores) {
                        this.character.removeAbilityScore(score, ability.amount, 'Feat');
                    }
                }
            }
        }

        return true;
    }

    removeOptionalFeature(featureId) {
        return this.optionalFeatures.delete(featureId);
    }

    getFeats() {
        return Array.from(this.feats.entries()).map(([id, data]) => ({
            ...data.feat,
            count: data.count
        }));
    }

    getOptionalFeatures() {
        return Array.from(this.optionalFeatures.values());
    }
}
```

### 3. Update Feat UI
Update the existing FeatUI class to use EntityCard:

```javascript
class FeatUI {
    constructor(container, featManager) {
        this.container = container;
        this.manager = featManager;
        this.initialize();
    }

    async initialize() {
        this.container.innerHTML = `
            <div class="feat-section">
                <div class="feat-list"></div>
                <div class="feat-details"></div>
                <div class="optional-features"></div>
            </div>
        `;

        await this.render();
    }

    async render() {
        await this.renderFeatList();
        await this.renderOptionalFeatures();
    }

    async renderFeatList() {
        const feats = this.manager.getFeats();
        const list = this.container.querySelector('.feat-list');

        list.innerHTML = `
            <div class="section-header">
                <h3>Feats</h3>
                <button class="btn btn-primary" id="addFeatBtn">Add Feat</button>
            </div>
            <div class="feat-grid">
                ${feats.map(feat => new EntityCard(this.container, feat, this.manager).render()).join('')}
            </div>
        `;

        this.attachFeatListeners();
    }

    async renderOptionalFeatures() {
        const features = this.manager.getOptionalFeatures();
        const container = this.container.querySelector('.optional-features');

        container.innerHTML = `
            <div class="section-header">
                <h3>Optional Features</h3>
                <button class="btn btn-primary" id="addFeatureBtn">Add Feature</button>
            </div>
            <div class="feature-grid">
                ${features.map(feature => new EntityCard(this.container, feature, this.manager).render()).join('')}
            </div>
        `;

        this.attachFeatureListeners();
    }

    attachFeatListeners() {
        // Add feat button
        const addBtn = this.container.querySelector('#addFeatBtn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const feats = await window.dndDataLoader.loadFeats();
                // Show feat selection dialog (implementation depends on your UI framework)
                // For now, just show a simple prompt
                const featId = prompt('Enter feat ID:');
                if (featId) {
                    await this.manager.addFeat(featId);
                    await this.render();
                }
            });
        }

        // Remove feat buttons
        this.container.querySelectorAll('.feat-card .remove-btn').forEach(btn => {
            const card = btn.closest('.feat-card');
            const featId = card.dataset.id;
            btn.addEventListener('click', async () => {
                await this.manager.removeFeat(featId);
                await this.render();
            });
        });
    }

    attachFeatureListeners() {
        // Add feature button
        const addBtn = this.container.querySelector('#addFeatureBtn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const features = await window.dndDataLoader.loadOptionalFeatures();
                // Show feature selection dialog (implementation depends on your UI framework)
                // For now, just show a simple prompt
                const featureId = prompt('Enter feature ID:');
                if (featureId) {
                    await this.manager.addOptionalFeature(featureId);
                    await this.render();
                }
            });
        }

        // Remove feature buttons
        this.container.querySelectorAll('.optfeature-card .remove-btn').forEach(btn => {
            const card = btn.closest('.optfeature-card');
            const featureId = card.dataset.id;
            btn.addEventListener('click', async () => {
                await this.manager.removeOptionalFeature(featureId);
                await this.render();
            });
        });
    }
}
```

## Testing Steps
1. Test feat loading:
```javascript
const feats = await window.dndDataLoader.loadFeats();
console.log('Loaded feats:', feats);
```

2. Test feat management:
```javascript
const manager = character.feats;
await manager.addFeat('alert');
console.log('Character after feat update:', character);
```

3. Test optional feature loading:
```javascript
const features = await window.dndDataLoader.loadOptionalFeatures();
console.log('Loaded optional features:', features);
```

4. Test UI display:
```javascript
const ui = new FeatUI(document.getElementById('featSection'), manager);
```

## Implementation Order
1. Update feat and optional feature data loading to use unified system
2. Update feat management
3. Update UI components to use EntityCard
4. Test with various feats and features